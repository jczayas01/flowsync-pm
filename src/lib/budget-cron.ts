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
  }).catch(() => [])

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
    where: { costPostedAt: null },
    select: { id: true, projectId: true, hours: true, hourlyRate: true, userId: true,
              project: { select: { workspaceId: true } } },
    take: 2000,
  }).catch(() => [])
  if (!entries.length) return 0

  // Resolve member default rates per workspace/user in one pass.
  const pairs = [...new Set(entries.map(e => `${e.project.workspaceId}::${e.userId}`))]
  const members = await db.workspaceMember.findMany({
    where: { OR: pairs.map(p => {
      const [workspaceId, userId] = p.split("::")
      return { workspaceId, userId }
    }) },
    select: { workspaceId: true, userId: true, costRate: true },
  }).catch(() => [])
  const rateOf = new Map<string, number | null>(
    members.map(m =>
      [`${m.workspaceId}::${m.userId}`, m.costRate == null ? null : Number(m.costRate)] as [string, number | null],
    ),
  )

  // Group cost per project
  const byProject = new Map<string, { cost: number; ids: string[]; count: number }>()
  for (const e of entries) {
    const rate = e.hourlyRate != null ? Number(e.hourlyRate)
      : rateOf.get(`${e.project.workspaceId}::${e.userId}`) ?? null
    if (rate == null || rate <= 0) continue          // leave unstamped for later
    const cost = Math.round(Number(e.hours || 0) * rate * 100) / 100
    if (cost <= 0) { continue }
    const g = byProject.get(e.projectId) || { cost: 0, ids: [], count: 0 }
    g.cost += cost; g.ids.push(e.id); g.count++
    byProject.set(e.projectId, g)
  }

  let projectsPosted = 0
  for (const [projectId, g] of byProject) {
    const amount = Math.round(g.cost * 100) / 100
    await db.$transaction(async tx => {
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
    await rollupSpent(projectId)
  }
  return projectsPosted
}
