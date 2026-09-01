// src/lib/budget-cron.ts
// Budget automation #3, run daily from the cron GET handler
// (engine-independent, same pattern as evm-auto / contract-alerts).
//
// #3 Recurring budget items — an item with recurrence = "MONTHLY" posts its
//    plannedCost as an Expense once per monthly cycle (anchored to the item's
//    periodStart/createdAt day-of-month, clamped to 28 so Feb never skips).
//
// Labour is no longer posted here: it accrues from team allocation and is
// mirrored onto its budget line on read by src/lib/labor-accrual.ts, so there
// is no cron dependency and no silent 401 when CRON_SECRET is missing.

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
