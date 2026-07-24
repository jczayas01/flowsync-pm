// src/lib/evm-series.ts
// Builds the weekly PV / EV / AC series for the project S-curve.
// Pure data — no chart library imports, so it stays server/client agnostic
// and unit-testable.

type TaskLike = {
  status: string
  startDate?: string | Date | null
  dueDate?: string | Date | null
  completedAt?: string | Date | null
  updatedAt?: string | Date | null
  estimatedHours?: number | string | null
}

type BudgetItemLike = {
  actualCost: number | string
  periodStart?: string | Date | null
  periodEnd?: string | Date | null
  createdAt?: string | Date | null
}

export interface SCurvePoint {
  label: string   // "Jul 6"
  t: number       // epoch ms (x axis)
  pv: number      // Planned Value $
  ev: number      // Earned Value $
  ac: number      // Actual Cost $
}

const d = (v: string | Date | null | undefined) => (v ? new Date(v).getTime() : null)
const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0

export function buildSCurveSeries(opts: {
  tasks: TaskLike[]
  budgetItems: BudgetItemLike[]
  budgetTotal: number
  projectStart?: string | Date | null
  projectEnd?: string | Date | null
}): SCurvePoint[] {
  const { tasks, budgetItems, budgetTotal } = opts
  if (!tasks.length && !budgetItems.length) return []

  // ── Window: project dates, else min/max of task dates, else last 12 weeks
  const taskTimes = tasks.flatMap(t => [d(t.startDate), d(t.dueDate)]).filter((x): x is number => x != null)
  const start = d(opts.projectStart) ?? (taskTimes.length ? Math.min(...taskTimes) : Date.now() - 84 * 864e5)
  const endRaw = d(opts.projectEnd) ?? (taskTimes.length ? Math.max(...taskTimes) : Date.now())
  const end = Math.max(endRaw, start + 7 * 864e5)

  // Weekly buckets, always including "now" if inside the window.
  const WEEK = 7 * 864e5
  const points: number[] = []
  for (let t = start; t <= end + WEEK - 1; t += WEEK) points.push(Math.min(t, end))
  if (points[points.length - 1] !== end) points.push(end)

  // ── Task weights: estimated hours when present, else equal weight
  const weight = (t: TaskLike) => Math.max(num(t.estimatedHours), 0) || 1
  const totalW = tasks.reduce((s, t) => s + weight(t), 0) || 1
  const BAC = budgetTotal > 0 ? budgetTotal : totalW // fall back to weight-units

  // PV fraction of one task at time x: linear ramp start→due (step at due if no start)
  const taskPV = (t: TaskLike, x: number) => {
    const s = d(t.startDate), e = d(t.dueDate)
    if (e == null) return s != null && x >= s ? 1 : 0
    if (s == null || e <= s) return x >= e ? 1 : 0
    return Math.min(1, Math.max(0, (x - s) / (e - s)))
  }
  // EV: full weight once complete
  const taskEV = (t: TaskLike, x: number) => {
    if (t.status !== "DONE") return 0
    const c = d(t.completedAt) ?? d(t.updatedAt)
    return c != null && c <= x ? 1 : 0
  }
  // AC: cumulative actual cost dated at periodEnd → periodStart → createdAt
  const acDate = (b: BudgetItemLike) => d(b.periodEnd) ?? d(b.periodStart) ?? d(b.createdAt) ?? start

  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })

  return points.map(x => {
    const pvW = tasks.reduce((s, t) => s + weight(t) * taskPV(t, x), 0)
    const evW = tasks.reduce((s, t) => s + weight(t) * taskEV(t, x), 0)
    const ac  = budgetItems.reduce((s, b) => s + (acDate(b) <= x ? num(b.actualCost) : 0), 0)
    return {
      label: fmt.format(new Date(x)),
      t: x,
      pv: Math.round((pvW / totalW) * BAC),
      ev: Math.round((evW / totalW) * BAC),
      ac: Math.round(ac),
    }
  })
}
