// src/lib/labor-posting.ts
// Direct-mode labour costing.
//
// The old chain was: log hours → wait for approval → wait for the daily cron
// (postLaborActuals) to lift APPROVED entries into the budget. Three silent
// failure points (missing CRON_SECRET → 401, no costRate → cost 0, nobody
// approves) made it feel like nothing happened when you logged time.
//
// Direct mode collapses that: an entry posts to the budget AT THE MOMENT it is
// logged, inside the same transaction, with no cron. Deleting the entry reverses
// the cost with a correcting expense. Approval survives only as an opt-in toggle
// (workspace.settings.requireTimeApproval); when it's on, the post happens the
// instant a PM approves instead of on a schedule.
//
// The math (hours × rate, per-entry, rounded to cents) matches postLaborActuals
// exactly, so numbers reconcile whichever path posted them.

type Tx = any // Prisma transaction client — codebase types these loosely

const AUTO_LABOUR_LINE = "Labor (time tracking)"

/** True when this workspace defers posting until a PM approves. Default: false (direct). */
export function workspaceRequiresApproval(settings: unknown): boolean {
  if (!settings || typeof settings !== "object") return false
  return (settings as any).requireTimeApproval === true
}

/** hours × rate → cents. Returns 0 when there is no usable rate. */
function entryAmount(hours: unknown, rate: unknown): number {
  const r = rate == null ? 0 : Number(rate)
  if (!(r > 0)) return 0
  const amt = Math.round(Number(hours || 0) * r * 100) / 100
  return amt > 0 ? amt : 0
}

/** Recompute project.budgetSpent from its lines (same rollup the cron uses). */
async function rollupSpent(tx: Tx, projectId: string) {
  const agg = await tx.budgetItem.aggregate({ where: { projectId }, _sum: { actualCost: true } })
  await tx.project.update({
    where: { id: projectId },
    data:  { budgetSpent: agg._sum.actualCost ?? 0 },
  })
}

/**
 * Resolve which budget line an entry charges: the task's own line when it has
 * one (control-account behaviour), otherwise the auto-managed labour line,
 * created once per project on demand. No manual mapping required.
 */
async function resolveLine(tx: Tx, projectId: string, taskId: string | null | undefined): Promise<string> {
  if (taskId) {
    const task = await tx.task.findFirst({ where: { id: taskId, projectId }, select: { budgetItemId: true } })
    const lineId = task?.budgetItemId
    if (lineId) {
      const exists = await tx.budgetItem.findFirst({ where: { id: lineId, projectId }, select: { id: true } })
      if (exists) return lineId
    }
  }
  const found = await tx.budgetItem.findFirst({
    where: { projectId, category: "LABOR", name: AUTO_LABOUR_LINE }, select: { id: true },
  })
  if (found) return found.id
  const created = await tx.budgetItem.create({
    data: { projectId, category: "LABOR", name: AUTO_LABOUR_LINE,
      description: "Auto-posted from time entries × cost rates", plannedCost: 0 },
    select: { id: true },
  })
  return created.id
}

export type PostableEntry = {
  id: string
  projectId: string
  taskId?: string | null
  hours: unknown
  hourlyRate: unknown
  billable?: boolean
}

/**
 * Post one entry's cost into the budget, in `tx`. Idempotent by costPostedAt:
 * an already-posted or rate-less or non-billable entry is a no-op. Returns the
 * amount posted (0 when nothing was posted).
 */
export async function postEntryCost(tx: Tx, entry: PostableEntry): Promise<number> {
  if (entry.billable === false) return 0
  const amount = entryAmount(entry.hours, entry.hourlyRate)
  if (amount <= 0) return 0

  // Re-read the stamp inside the tx so two concurrent posts can't double-charge.
  const fresh = await tx.timeEntry.findUnique({ where: { id: entry.id }, select: { costPostedAt: true } })
  if (!fresh || fresh.costPostedAt) return 0

  const lineId = await resolveLine(tx, entry.projectId, entry.taskId ?? null)
  await tx.expense.create({ data: {
    budgetItemId: lineId,
    description:  `Labor — ${Number(entry.hours || 0)}h @ ${Number(entry.hourlyRate)}/h`,
    amount,
    date:         new Date(),
    createdById:  "system",
  }})
  await tx.budgetItem.update({ where: { id: lineId }, data: { actualCost: { increment: amount } } })
  await tx.timeEntry.update({ where: { id: entry.id },
    data: { costPostedAt: new Date(), status: "APPROVED" as any } })
  await rollupSpent(tx, entry.projectId)
  return amount
}

/**
 * Reverse a posted entry's cost with a correcting expense, in `tx`. No-op if the
 * entry was never posted. Clears costPostedAt so the caller may then delete it.
 */
export async function reverseEntryCost(
  tx: Tx,
  entry: PostableEntry & { costPostedAt?: Date | null },
): Promise<number> {
  if (!entry.costPostedAt) return 0
  const amount = entryAmount(entry.hours, entry.hourlyRate)
  const lineId = await resolveLine(tx, entry.projectId, entry.taskId ?? null)
  if (amount > 0) {
    await tx.expense.create({ data: {
      budgetItemId: lineId,
      description:  `Labor reversal — entry ${entry.id}`,
      amount:       -amount,
      date:         new Date(),
      createdById:  "system",
    }})
    await tx.budgetItem.update({ where: { id: lineId }, data: { actualCost: { decrement: amount } } })
  }
  await tx.timeEntry.update({ where: { id: entry.id }, data: { costPostedAt: null } })
  await rollupSpent(tx, entry.projectId)
  return amount
}
