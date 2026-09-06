// src/lib/cross-project-deps.ts
// Cross-project dependency analysis.
//
// A program exists because its projects depend on each other — Project B's
// build cannot start until Project A's procurement lands. Until now a
// dependency could only link two tasks inside one project, so those links lived
// in people's heads and in status decks. The data model always allowed it
// (TaskDependency stores two task ids and nothing about projects); the API
// refused it.
//
// Two things have to be right once links cross a project boundary:
//
//   Cycles. Inside one project a cycle is visible in the Gantt. Across
//   projects nobody sees it, and the critical path silently returns 0 for the
//   looped tasks. Every link is checked before it is written.
//
//   Breaches. A link is only useful if someone is told when it is violated —
//   when the predecessor's finish, plus lag, lands after the successor's start.
//   That is the alert a program manager actually needs.

export type DepType = "FS" | "SS" | "FF" | "SF"

export type DepTask = {
  id: string
  code?: string | null
  title?: string | null
  projectId: string
  projectName?: string | null
  projectCode?: string | null
  startDate?: Date | string | null
  dueDate?: Date | string | null
  status?: string | null
  percentComplete?: number | null
}

export type DepLink = {
  id: string
  dependentTaskId: string
  precedingTaskId: string
  dependencyType?: string | null
  lagDays?: number | null
}

const ms = (v: Date | string | null | undefined): number | null => {
  if (!v) return null
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime()
  return Number.isFinite(t) ? t : null
}
const DAY = 86_400_000

/**
 * Would adding preceding → dependent create a cycle?
 * Walks the existing graph forward from `dependent`: if `preceding` is
 * reachable, the new edge closes a loop. Iterative, so a deep chain cannot
 * blow the stack.
 */
export function wouldCycle(
  links: DepLink[],
  dependentTaskId: string,
  precedingTaskId: string,
): boolean {
  if (dependentTaskId === precedingTaskId) return true
  // successors[x] = tasks that depend on x
  const successors = new Map<string, string[]>()
  for (const l of links) {
    const arr = successors.get(l.precedingTaskId) ?? []
    arr.push(l.dependentTaskId)
    successors.set(l.precedingTaskId, arr)
  }
  const stack = [dependentTaskId]
  const seen = new Set<string>()
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === precedingTaskId) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const nxt of successors.get(cur) ?? []) stack.push(nxt)
  }
  return false
}

export type Breach = {
  linkId: string
  type: DepType
  lagDays: number
  preceding: DepTask
  dependent: DepTask
  /** Days the successor would have to move, or the predecessor pull in. */
  slipDays: number
  /** The predecessor is late and the successor has already started. */
  active: boolean
}

export type CrossLink = {
  link: DepLink
  preceding: DepTask
  dependent: DepTask
  breach: Breach | null
}

/** The date the successor may start (or finish, for FF/SF) under this link. */
function constraintDate(type: DepType, pred: DepTask, lagDays: number): number | null {
  const s = ms(pred.startDate)
  const f = ms(pred.dueDate)
  const base = type === "SS" || type === "SF" ? s : f
  return base == null ? null : base + lagDays * DAY
}

/**
 * Cross-project links, each with its breach if it has one.
 * Same-project links are dropped: the Gantt already shows those.
 */
export function analyzeCrossLinks(links: DepLink[], tasks: DepTask[]): CrossLink[] {
  const byId = new Map(tasks.map(t => [t.id, t]))
  const out: CrossLink[] = []

  for (const l of links) {
    const pred = byId.get(l.precedingTaskId)
    const dep  = byId.get(l.dependentTaskId)
    if (!pred || !dep) continue
    if (pred.projectId === dep.projectId) continue

    const type = (l.dependencyType || "FS").toUpperCase() as DepType
    const lag  = Number(l.lagDays ?? 0)
    const required = constraintDate(type, pred, lag)
    // FF and SF constrain the successor's finish; FS and SS its start.
    const actual = type === "FF" || type === "SF" ? ms(dep.dueDate) : ms(dep.startDate)

    let breach: Breach | null = null
    if (required != null && actual != null && required > actual) {
      const slipDays = Math.ceil((required - actual) / DAY)
      const predDone = pred.status === "DONE" || Number(pred.percentComplete ?? 0) >= 100
      breach = {
        linkId: l.id, type, lagDays: lag, preceding: pred, dependent: dep, slipDays,
        // A finished predecessor cannot block anything, however its dates read.
        active: !predDone,
      }
    }
    out.push({ link: l, preceding: pred, dependent: dep, breach })
  }

  // Worst slip first — that is the one a program manager acts on.
  return out.sort((a, b) =>
    (b.breach?.active ? 1 : 0) - (a.breach?.active ? 1 : 0) ||
    (b.breach?.slipDays ?? 0) - (a.breach?.slipDays ?? 0))
}

export function summarizeCrossLinks(links: CrossLink[]) {
  const breaches = links.filter(l => l.breach)
  return {
    total:    links.length,
    breached: breaches.length,
    active:   breaches.filter(l => l.breach!.active).length,
    worstSlip: breaches.reduce((m, l) => Math.max(m, l.breach!.slipDays), 0),
    projects: new Set(links.flatMap(l => [l.preceding.projectId, l.dependent.projectId])).size,
  }
}
