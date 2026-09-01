// src/lib/labor-accrual.ts
// Labour cost from ASSIGNMENT, not from timesheets.
//
// The old model asked for hours per task per day. Nobody fills that in, so the
// budget stayed empty and the whole chain looked broken. This one asks for one
// thing per person — what percentage of their time is on this project — and
// derives the cost from the calendar:
//
//     working days elapsed × hours/day × (allocation ÷ 100) × costRate
//
// Why not derive labour from task progress instead: actual cost would then be a
// restatement of earned value, CPI would sit at exactly 1.00 forever, and the
// EVM tab would stop detecting cost overruns — the one thing it exists to do.
// Accruing against the calendar keeps AC independent of progress, so a project
// that is 60% through its schedule at 40% complete correctly shows CPI < 1.
//
// Nothing here runs on a cron. syncProjectLabor() is idempotent (it SETS the
// line, never increments), so it is safe to call on every page load.

import { db } from "@/lib/db"

export const LABOR_LINE_NAME = "Labor"
const DEFAULT_HOURS_PER_DAY = 8

/** Hours in a working day for this workspace. Stored in workspace.settings, no column needed. */
export function laborHoursPerDay(settings: unknown): number {
  const raw = settings && typeof settings === "object"
    ? (settings as any).laborHoursPerDay : undefined
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 && n <= 24 ? n : DEFAULT_HOURS_PER_DAY
}

/** Mon–Fri days in [from, to] inclusive. Returns 0 when the range is inverted. */
export function workingDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  if (b < a) return 0
  let days = 0
  for (let t = a; t <= b; t += 86_400_000) {
    const dow = new Date(t).getUTCDay()
    if (dow !== 0 && dow !== 6) days++
  }
  return days
}

export type LaborRow = {
  userId: string
  name: string
  allocation: number       // percent
  costRate: number | null  // per hour
  since: Date
  through: Date
  workingDays: number
  hours: number
  cost: number
  /** No cost rate set on the workspace member — this person accrues nothing yet. */
  missingRate: boolean
}

export type LaborSummary = {
  rows: LaborRow[]
  totalHours: number
  totalCost: number
  hoursPerDay: number
  asOf: Date
}

/**
 * Compute what each assigned person has accrued on this project so far.
 * Pure: no writes, no side effects — the panel and the sync both read it.
 */
export async function computeProjectLabor(
  projectId: string,
  asOf: Date = new Date(),
): Promise<LaborSummary> {
  const project = await db.project.findUnique({
    where:  { id: projectId },
    select: { workspaceId: true, startDate: true, endDate: true, actualEnd: true,
              workspace: { select: { settings: true } } },
  })
  if (!project) return { rows: [], totalHours: 0, totalCost: 0, hoursPerDay: DEFAULT_HOURS_PER_DAY, asOf }

  const hoursPerDay = laborHoursPerDay(project.workspace?.settings)

  const members = await db.projectMember.findMany({
    where:  { projectId },
    select: { userId: true, allocation: true, joinedAt: true,
              user: { select: { id: true, name: true } } },
  })
  if (!members.length) return { rows: [], totalHours: 0, totalCost: 0, hoursPerDay, asOf }

  // Cost rates live on the workspace membership, so one lookup covers everyone.
  const rates = await db.workspaceMember.findMany({
    where:  { workspaceId: project.workspaceId, userId: { in: members.map(m => m.userId) } },
    select: { userId: true, costRate: true },
  })
  const rateOf = new Map(rates.map(r => [r.userId, r.costRate == null ? null : Number(r.costRate)]))

  // Accrual stops at whichever comes first: today, the planned finish, or the
  // real finish. A closed project must stop billing time to itself.
  const hardEnd = project.actualEnd ?? project.endDate ?? null
  const through = hardEnd && hardEnd < asOf ? hardEnd : asOf

  const rows: LaborRow[] = members.map(m => {
    // Someone added to the project after kickoff starts accruing when they joined.
    const since = project.startDate && project.startDate > m.joinedAt ? project.startDate : m.joinedAt
    const allocation = Math.max(0, Math.min(100, Number(m.allocation ?? 100)))
    const costRate = rateOf.get(m.userId) ?? null
    const workingDays = workingDaysBetween(since, through)
    const hours = Math.round(workingDays * hoursPerDay * (allocation / 100) * 100) / 100
    const cost = costRate != null && costRate > 0 ? Math.round(hours * costRate * 100) / 100 : 0
    return {
      userId: m.userId,
      name: m.user?.name || "—",
      allocation, costRate, since, through, workingDays, hours, cost,
      missingRate: costRate == null || costRate <= 0,
    }
  })

  return {
    rows,
    totalHours: Math.round(rows.reduce((s, r) => s + r.hours, 0) * 100) / 100,
    totalCost:  Math.round(rows.reduce((s, r) => s + r.cost,  0) * 100) / 100,
    hoursPerDay,
    asOf,
  }
}

/**
 * Mirror the accrued labour onto a single auto-managed budget line so EVM's
 * actual cost includes it. Idempotent: actualCost is SET to the computed total,
 * so calling this twice cannot double-charge and stale values self-correct.
 * Returns the total posted.
 */
export async function syncProjectLabor(projectId: string, asOf: Date = new Date()): Promise<number> {
  const summary = await computeProjectLabor(projectId, asOf)
  if (!summary.rows.length && summary.totalCost === 0) {
    // Nothing assigned — leave any existing line alone rather than zeroing a
    // figure a human may have entered by hand.
    return 0
  }

  const existing = await db.budgetItem.findFirst({
    where:  { projectId, category: "LABOR", name: LABOR_LINE_NAME },
    select: { id: true, actualCost: true },
  })

  if (!existing) {
    if (summary.totalCost <= 0) return 0
    await db.budgetItem.create({ data: {
      projectId, category: "LABOR", name: LABOR_LINE_NAME,
      description: "Accrued from team allocation × cost rate",
      plannedCost: 0, actualCost: summary.totalCost,
    }})
  } else if (Number(existing.actualCost) !== summary.totalCost) {
    await db.budgetItem.update({
      where: { id: existing.id }, data: { actualCost: summary.totalCost },
    })
  } else {
    return summary.totalCost   // already current, skip the rollup write
  }

  const agg = await db.budgetItem.aggregate({ where: { projectId }, _sum: { actualCost: true } })
  await db.project.update({
    where: { id: projectId }, data: { budgetSpent: agg._sum.actualCost ?? 0 },
  }).catch(() => {})

  return summary.totalCost
}
