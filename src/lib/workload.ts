// src/lib/workload.ts — Task-effort workload engine
// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS RULES (signed off Jul 14, 2026 — see design review):
//  D1 (Effort Split): Task.estimatedHours is the TOTAL effort for the task.
//      With N assignees, each receives estimatedHours / N. (Per-assignment
//      units %, e.g. 60/40, is a future phase via a TaskAssignee column.)
//  D2: ProjectMember.allocation% is an availability CONSTRAINT, never a
//      workload driver. Demand here is computed exclusively from task effort.
//  D3 (Remaining): capacity views use REMAINING effort =
//      remainingHours ?? estimatedHours × (1 − percentComplete/100),
//      so completed work stops consuming future capacity.
//  D4: DONE/CANCELLED tasks excluded. No estimate → contributes 0h, reported
//      under "missing estimates". Missing start or due date → "unscheduled",
//      excluded from time-phased totals (its remaining hours are reported).
//  Calendar: standard 8h/day, Mon–Fri, 40h/week. Effort is spread evenly
//      across the task's working days; a share whose daily load exceeds 8h
//      marks the task over-scheduled (impossible plan) — surfaced as warning.
// ─────────────────────────────────────────────────────────────────────────────

export const DAY_HRS = 8
export const WEEK_HRS = 40

const DAY_MS = 86400000
const utc = (d: string | Date | number) => {
  const x = new Date(d)
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())
}
const isWorkday = (t: number) => { const dow = new Date(t).getUTCDay(); return dow !== 0 && dow !== 6 }

/** Inclusive count of Mon–Fri days between two dates (order-safe). */
export function workingDaysInclusive(start: string | Date | number, end: string | Date | number): number {
  let a = utc(start), b = utc(end)
  if (b < a) [a, b] = [b, a]
  let n = 0
  for (let t = a; t <= b; t += DAY_MS) if (isWorkday(t)) n++
  return n
}

/** Monday 00:00 UTC of the week containing d. */
export function weekStartUTC(d: Date = new Date()): number {
  const t = utc(d)
  const dow = new Date(t).getUTCDay()          // 0=Sun … 6=Sat
  return t - ((dow + 6) % 7) * DAY_MS
}

export interface WorkloadTask {
  id: string
  title: string
  status: string
  percentComplete?: number | null
  estimatedHours?: any
  remainingHours?: any
  startDate?: string | Date | null
  dueDate?: string | Date | null
  projectId: string
  project?: { name?: string | null; code?: string | null } | null
  assignees: { userId: string }[]
}

export interface MemberWorkload {
  weekly: number[]                       // remaining hours per week in the window
  thisWeek: number                       // weekly[0]
  projects: { projectId: string; name: string; hours: number; thisWeek: number }[]  // window + current-week
  unscheduled: { id: string; title: string; hours: number; project: string }[]
  missingEstimate: { id: string; title: string; project: string }[]
  overScheduled: { id: string; title: string; dailyLoad: number }[]
}

export interface WorkloadResult {
  byUser: Record<string, MemberWorkload>
  weekStarts: number[]                   // UTC ms, Mondays
  unassigned: { count: number; hours: number }
}

const blank = (weeks: number): MemberWorkload => ({
  weekly: Array(weeks).fill(0), thisWeek: 0, projects: [],
  unscheduled: [], missingEstimate: [], overScheduled: [],
})

/** D3 remaining effort for a task. */
export function remainingEffort(t: WorkloadTask): number {
  const est = Number(t.estimatedHours ?? 0)
  const rem = t.remainingHours == null ? null : Number(t.remainingHours)
  if (rem != null && !Number.isNaN(rem)) return Math.max(0, rem)
  const pct = Math.min(100, Math.max(0, Number(t.percentComplete ?? 0)))
  return Math.max(0, est * (1 - pct / 100))
}

export function computeWorkload(tasks: WorkloadTask[], weeks = 8, now = new Date()): WorkloadResult {
  const w0 = weekStartUTC(now)
  const weekStarts = Array.from({ length: weeks }, (_, i) => w0 + i * 7 * DAY_MS)
  const windowEnd = w0 + weeks * 7 * DAY_MS - DAY_MS
  const byUser: Record<string, MemberWorkload> = {}
  const get = (uid: string) => (byUser[uid] ||= blank(weeks))
  const unassigned = { count: 0, hours: 0 }

  for (const t of tasks) {
    if (t.status === "DONE" || t.status === "CANCELLED") continue        // D4
    const est = Number(t.estimatedHours ?? 0)
    const projName = t.project?.name || t.project?.code || "—"
    const assignees = (t.assignees || []).map(a => a.userId).filter(Boolean)

    // D4 — no estimate: 0h, flagged per assignee
    if (!est || Number.isNaN(est) || est <= 0) {
      for (const uid of assignees)
        get(uid).missingEstimate.push({ id: t.id, title: t.title, project: projName })
      continue
    }

    const rem = remainingEffort(t)                                        // D3
    if (rem <= 0) continue

    if (!assignees.length) { unassigned.count++; unassigned.hours += rem; continue }
    const share = rem / assignees.length                                  // D1 — effort split

    // D4 — unscheduled: report hours, exclude from phased totals
    if (!t.startDate || !t.dueDate) {
      for (const uid of assignees)
        get(uid).unscheduled.push({ id: t.id, title: t.title, hours: round1(share), project: projName })
      continue
    }

    const a = utc(t.startDate), b = utc(t.dueDate)
    const wd = workingDaysInclusive(a, b) || 1
    const dailyLoad = share / wd
    const over = dailyLoad > DAY_HRS + 1e-9                               // impossible plan

    for (const uid of assignees) {
      const m = get(uid)
      if (over) m.overScheduled.push({ id: t.id, title: t.title, dailyLoad: round1(dailyLoad) })
      // phase into weekly buckets across working days that intersect the window
      let phased = 0
      const from = Math.max(a, w0), to = Math.min(b, windowEnd)
      for (let d = from; d <= to; d += DAY_MS) {
        if (!isWorkday(d)) continue
        const wi = Math.floor((d - w0) / (7 * DAY_MS))
        if (wi >= 0 && wi < weeks) { m.weekly[wi] += dailyLoad; phased += dailyLoad }
      }
      if (phased > 0) {
        let wk0 = 0
        for (let d = Math.max(a, w0); d <= Math.min(b, w0 + 7 * DAY_MS - DAY_MS); d += DAY_MS)
          if (isWorkday(d)) wk0 += dailyLoad
        const row = m.projects.find(p => p.projectId === t.projectId)
        if (row) { row.hours += phased; row.thisWeek += wk0 }
        else m.projects.push({ projectId: t.projectId, name: projName, hours: phased, thisWeek: wk0 })
      }
    }
  }

  for (const uid of Object.keys(byUser)) {
    const m = byUser[uid]
    m.weekly = m.weekly.map(round1)
    m.thisWeek = m.weekly[0] || 0
    m.projects = m.projects.map(p => ({ ...p, hours: round1(p.hours), thisWeek: round1(p.thisWeek) }))
      .sort((x, y) => y.hours - x.hours)
  }
  unassigned.hours = round1(unassigned.hours)
  return { byUser, weekStarts, unassigned }
}

const round1 = (n: number) => Math.round(n * 10) / 10
