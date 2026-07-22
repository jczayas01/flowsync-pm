// src/lib/projects/critical-path.ts
// Single critical-path computation shared by the Tasks grid and the Gantt so the
// two views always agree. It is dependency-aware and date-driven:
//   • early finish is computed along dependency chains (longest path)
//   • task duration comes from real start/due dates (falling back to estimatedHours)
//   • the driving chain is traced back from the project-end task(s)
//   • the manual `isCriticalPath` override is always honored
// When tasks have no dependencies it degrades gracefully to the schedule-end
// drivers instead of marking everything.
export function computeCriticalPath(tasks: any[]): Set<string> {
  const critical = new Set<string>()
  if (!tasks || !tasks.length) return critical

  const byId: Record<string, any> = {}
  for (const t of tasks) byId[t.id] = t

  // No dependency network → no path. CPM on unlinked tasks degenerates into
  // "whatever ends last", which litters imported plans with meaningless ⚡.
  // Honor manual flags only until at least one dependency exists.
  const hasDeps = tasks.some(t => (t.dependencies || []).length > 0)
  if (!hasDeps) {
    for (const t of tasks) if (t.isCriticalPath) critical.add(t.id)
    return critical
  }

  const DAY = 86400000
  const ms = (d: any) => (d ? new Date(d).getTime() : null)
  const startsAll = tasks.map(t => ms(t.startDate)).filter((v): v is number => v != null)
  const projStart = startsAll.length ? Math.min(...startsAll) : 0

  const durDays = (t: any) => {
    const s = ms(t.startDate), d = ms(t.dueDate)
    if (s != null && d != null) return Math.max(1, Math.round((d - s) / DAY))
    const h = Number(t.estimatedHours) || 0
    return h ? Math.ceil(h / 8) : 5
  }

  // Early finish (days from project start), following the longest dependency path.
  const ef: Record<string, number> = {}
  const calc = (t: any, stack: Set<string> = new Set()): number => {
    if (ef[t.id] != null) return ef[t.id]
    if (stack.has(t.id)) return 0            // guard against cycles
    stack.add(t.id)
    const deps = (t.dependencies || [])
      .map((x: any) => ({ pred: byId[x.precedingTaskId], lag: Number(x.lagDays) || 0 }))
      .filter((d: any) => d.pred)
    let es: number
    // Lag shifts the successor's earliest start: FS + lag (lead = negative lag).
    if (deps.length) es = Math.max(...deps.map((d: any) => calc(d.pred, stack) + d.lag))
    else es = ms(t.startDate) != null ? Math.round((ms(t.startDate)! - projStart) / DAY) : 0
    ef[t.id] = es + durDays(t)
    stack.delete(t.id)
    return ef[t.id]
  }
  for (const t of tasks) calc(t)

  const projectEnd = Math.max(...Object.values(ef), 0)

  // Trace the driving chain back from each end task (the predecessor with the largest EF).
  const trace = (t: any, seen: Set<string> = new Set()) => {
    if (seen.has(t.id)) return
    seen.add(t.id)
    critical.add(t.id)
    const deps = (t.dependencies || [])
      .map((x: any) => ({ pred: byId[x.precedingTaskId], lag: Number(x.lagDays) || 0 }))
      .filter((d: any) => d.pred)
    if (deps.length) {
      const driver = deps.reduce((a: any, b: any) =>
        (ef[b.pred.id] + b.lag >= ef[a.pred.id] + a.lag ? b : a))
      trace(driver.pred, seen)
    }
  }
  for (const t of tasks) if (projectEnd - ef[t.id] <= 2) trace(t)

  for (const t of tasks) if (t.isCriticalPath) critical.add(t.id) // manual override
  return critical
}
