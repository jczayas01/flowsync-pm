// src/lib/task-integrity.ts
// Data-integrity checks for schedule and progress fields.
//
// Why this exists: earned value is computed from percentComplete × planned cost.
// Nothing stops a task from being marked 100% before its start date, or 100%
// while its status is still To Do. When that happens EV inflates against a PV
// that has not accrued yet, and SPI/CPI blow up to numbers like 5.35 and 307
// with no error anywhere — the report looks precise and is wrong. These checks
// name the specific rows responsible so the figure can be trusted or fixed.
//
// Pure functions over plain task objects: no db, no fetch, callable from a
// server page, an API route, or the client grid.

export type IntegrityCode =
  | "finish_before_start"
  | "progress_before_start"
  | "complete_not_done"
  | "done_not_complete"
  | "progress_no_dates"
  | "no_estimate"

export type IntegritySeverity = "error" | "warning"

export type IntegrityFinding = {
  code: IntegrityCode
  severity: IntegritySeverity
  taskId: string
  taskCode: string
  title: string
  /** Short human-readable specifics, e.g. "Oct 3 → Aug 31". */
  detail: string
  /** True when the finding distorts earned value. */
  affectsEvm: boolean
}

type TaskLike = {
  id: string
  code?: string | null
  title?: string | null
  status?: string | null
  startDate?: Date | string | null
  dueDate?: Date | string | null
  percentComplete?: number | null
  estimatedHours?: unknown
  isMilestone?: boolean | null
}

const d = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null
  const dt = v instanceof Date ? v : new Date(v)
  return isNaN(dt.getTime()) ? null : dt
}

/** Midnight UTC, so a task starting "today" is not flagged as future. */
const dayStart = (dt: Date) =>
  Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())

const short = (dt: Date) =>
  dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })

export function checkTasks(tasks: TaskLike[], asOf: Date = new Date()): IntegrityFinding[] {
  const today = dayStart(asOf)
  const out: IntegrityFinding[] = []

  for (const t of tasks) {
    const start = d(t.startDate)
    const due   = d(t.dueDate)
    const pct   = Number(t.percentComplete ?? 0)
    const status = String(t.status ?? "")
    const base = { taskId: t.id, taskCode: t.code || "—", title: t.title || "—" }

    // A finish before its start makes duration negative; every downstream
    // schedule metric derived from it is meaningless.
    if (start && due && dayStart(due) < dayStart(start)) {
      out.push({ ...base, code: "finish_before_start", severity: "error",
        detail: `${short(start)} → ${short(due)}`, affectsEvm: true })
    }

    // The one that silently corrupts EVM: value earned on work that, by its own
    // dates, has not begun. PV is still 0 for this task, so SPI runs away.
    if (pct > 0 && start && dayStart(start) > today) {
      out.push({ ...base, code: "progress_before_start", severity: "error",
        detail: `${pct}% · starts ${short(start)}`, affectsEvm: true })
    }

    // 100% but not closed: either the work is done and the status is stale, or
    // the progress bar is optimistic. Both distort completion reporting.
    if (pct >= 100 && status !== "DONE" && status !== "CANCELLED") {
      out.push({ ...base, code: "complete_not_done", severity: "warning",
        detail: `100% · ${status || "no status"}`, affectsEvm: false })
    }

    // Closed but under 100%: EV under-counts finished work.
    if (status === "DONE" && pct < 100) {
      out.push({ ...base, code: "done_not_complete", severity: "warning",
        detail: `${pct}% · Done`, affectsEvm: true })
    }

    // Progress with no schedule at all — nothing to measure against.
    if (pct > 0 && !start && !due) {
      out.push({ ...base, code: "progress_no_dates", severity: "warning",
        detail: `${pct}% · no dates`, affectsEvm: true })
    }

    // Milestones legitimately carry no hours; ordinary work should not.
    const est = Number(t.estimatedHours ?? 0)
    if (!t.isMilestone && !(est > 0) && status !== "CANCELLED") {
      out.push({ ...base, code: "no_estimate", severity: "warning",
        detail: "no estimated hours", affectsEvm: false })
    }
  }

  // Errors first, then EVM-affecting warnings, then the rest.
  const rank = (f: IntegrityFinding) =>
    f.severity === "error" ? 0 : f.affectsEvm ? 1 : 2
  return out.sort((a, b) => rank(a) - rank(b) || a.taskCode.localeCompare(b.taskCode))
}

export function summarize(findings: IntegrityFinding[]) {
  return {
    total:    findings.length,
    errors:   findings.filter(f => f.severity === "error").length,
    warnings: findings.filter(f => f.severity === "warning").length,
    evm:      findings.filter(f => f.affectsEvm).length,
    tasks:    new Set(findings.map(f => f.taskId)).size,
  }
}
