// src/lib/budget-cron.ts
// Budget automation #3 + #4, run daily from the cron GET handler
// (engine-independent, same pattern as evm-auto / contract-alerts).
//
// #3 Recurring budget items — an item with recurrence = "MONTHLY" posts its
//    plannedCost as an Expense once per monthly cycle (anchored to the item's
//    periodStart/createdAt day-of-month, clamped to 28 so Feb never skips).
//
// #4 Labor actuals — unposted TimeEntries are costed at
//    entry.hourlyRate ?? member.costRate and rolled into a per-project
//    auto-managed "Labor (time tracking)" budget item as one Expense per run.
//    Entries with no resolvable rate are left unstamped, so setting a rate
//    later still captures the backlog.

import { db } from "@/lib/db"

const clampDay = (d: number) => Math.min(d, 28)

async function rollupSpent(projectId: string) {
  const agg = await db.budgetItem.aggregate({ where: { projectId }, _sum: { actualCost: true } })
  await db.project.update({
    where: { id: projectId },
    data:  { budgetSpent: agg._sum.actualCost ?? 0 },
  }).catch(() => {})
}

// ── #3 Recurring posts ───────────────────────────────────────────────────
export async function postRecurringBudgetItems(now = new Date()): Promise<number> {
  const items = await db.budgetItem.findMany({
    where: { recurrence: "MONTHLY" },
    select: { id: true, projectId: true, name: true, plannedCost: true,
              periodStart: true, createdAt: true, lastRecurredAt: true },
  }).catch(() => [] as any[])

  let posted = 0
  const touched = new Set<string>()

  for (const it of items) {
    const amount = Number(it.plannedCost || 0)
    if (amount <= 0) continue

    const anchor = it.periodStart ?? it.createdAt
    const day = clampDay(anchor.getUTCDate())

    // Due date this month; if we're before it, the due date was last month.
    let due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day))
    if (due > now) due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, day))
    if (due < anchor) continue                       // first cycle not reached yet
    if (it.lastRecurredAt && it.lastRecurredAt >= due) continue // this cycle already posted

    await db.$transaction(async tx => {
      await tx.expense.create({ data: {
        budgetItemId: it.id,
        description:  `Recurring — ${it.name} (${due.toISOString().slice(0, 7)})`,
        amount,
        date:         due,
        createdById:  "system",
      }})
      await tx.budgetItem.update({
        where: { id: it.id },
        data:  { actualCost: { increment: amount }, lastRecurredAt: now },
      })
    }).catch(() => { posted-- })
    posted++
    touched.add(it.projectId)
  }

  for (const pid of touched) await rollupSpent(pid)
  return posted
}

// ── #4 Labor actuals ─────────────────────────────────────────────────────
export async function postLaborActuals(): Promise<number> {
  const entries = await db.timeEntry.findMany({
    // Approval gate: an unapproved entry must never move project cost. Entries
    // sit in DRAFT/SUBMITTED until a PM approves them.
    where: { costPostedAt: null, status: "APPROVED" as any },
    select: { id: true, projectId: true, hours: true, hourlyRate: true, userId: true,
              project: { select: { workspaceId: true } },
              // Control account: hours worked on a task charge that task's budget
              // line, so labour lands where the work lives instead of in one
              // undifferentiated bucket.
              task: { select: { budgetItemId: true } } },
    take: 2000,
  }).catch(() => [] as any[])
  if (!entries.length) return 0

  // Resolve member default rates per workspace/user in one pass.
  const pairs: string[] = Array.from(new Set(entries.map((e: any) => String(`${e.project.workspaceId}::${e.userId}`))))
  const members = await db.workspaceMember.findMany({
    where: { OR: pairs.map((p: string) => {
      const [workspaceId, userId] = p.split("::")
      return { workspaceId, userId }
    }) },
    select: { workspaceId: true, userId: true, costRate: true },
  }).catch(() => [] as any[])
  const rateOf = new Map<string, number | null>(
    members.map(m =>
      [`${m.workspaceId}::${m.userId}`, m.costRate == null ? null : Number(m.costRate)] as [string, number | null],
    ),
  )

  // Group cost per project AND per control account. Entries whose task has no
  // budget line (or no task at all) fall back to the auto-managed labour line.
  type Bucket = { projectId: string; budgetItemId: string | null; cost: number; ids: string[]; count: number }
  const buckets = new Map<string, Bucket>()
  for (const e of entries as any[]) {
    const rate = e.hourlyRate != null ? Number(e.hourlyRate)
      : rateOf.get(`${e.project.workspaceId}::${e.userId}`) ?? null
    if (rate == null || rate <= 0) continue          // leave unstamped for later
    const cost = Math.round(Number(e.hours || 0) * rate * 100) / 100
    if (cost <= 0) { continue }
    const lineId = (e as any).task?.budgetItemId || null
    const key = `${e.projectId}::${lineId ?? "_auto"}`
    const g: Bucket = buckets.get(key) || {
      projectId: String(e.projectId), budgetItemId: lineId, cost: 0, ids: [] as string[], count: 0 }
    g.cost += cost; g.ids.push(e.id); g.count++
    buckets.set(key, g)
  }

  let projectsPosted = 0
  const touchedProjects = new Set<string>()
  for (const g of buckets.values()) {
    const projectId = g.projectId
    const amount = Math.round(g.cost * 100) / 100
    await db.$transaction(async tx => {
      let lineId = g.budgetItemId
      if (lineId) {
        // Guard against a line deleted between the read and the post.
        const exists = await tx.budgetItem.findFirst({
          where: { id: lineId, projectId }, select: { id: true },
        })
        if (!exists) lineId = null
      }
      if (!lineId) {
        // Auto-managed labor line: reuse if present, create once otherwise.
        let item = await tx.budgetItem.findFirst({
          where: { projectId, category: "LABOR", name: "Labor (time tracking)" },
          select: { id: true },
        })
        if (!item) {
          item = await tx.budgetItem.create({
            data: { projectId, category: "LABOR", name: "Labor (time tracking)",
              description: "Auto-posted from time entries × cost rates",
              plannedCost: 0 },
            select: { id: true },
          })
        }
        lineId = item.id
      }
      const item = { id: lineId }
      await tx.expense.create({ data: {
        budgetItemId: item.id,
        description:  `Labor actuals — ${g.count} time entr${g.count === 1 ? "y" : "ies"}`,
        amount,
        date:         new Date(),
        createdById:  "system",
      }})
      await tx.budgetItem.update({
        where: { id: item.id },
        data:  { actualCost: { increment: amount } },
      })
      await tx.timeEntry.updateMany({
        where: { id: { in: g.ids } },
        data:  { costPostedAt: new Date() },
      })
    }).catch(() => { projectsPosted-- })
    projectsPosted++
    touchedProjects.add(projectId)
  }
  for (const pid of touchedProjects) await rollupSpent(pid)
  return projectsPosted
}
