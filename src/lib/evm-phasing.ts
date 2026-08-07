// src/lib/evm-phasing.ts
//
// Time-phased earned value, in one place.
//
// The old planned value was `BAC × (elapsed time / total duration)` — it assumed
// spending is linear in time, which no real project is. A project that buys
// $120K of licences in month one and spends the rest over five months looked
// "behind plan" all autumn purely because of arithmetic, and SPI lied
// systematically.
//
// What replaces it: every dollar of planned cost is attached to the work that
// consumes it, and each task's share ramps across its own start→due window.
//
//   • A budget line WITH linked tasks (a control account) phases across those
//     tasks, hours-weighted.
//   • A budget line with no linked tasks phases across the project window, so
//     nothing disappears from the curve.
//   • With no tasks at all, we fall back to the project window for everything —
//     the same shape as before, but now it's the exception rather than the rule.
//
// Both the KPI header and the S-curve read from here, so the number and the
// picture can never disagree again.

export interface PhasingTask {
  id?: string
  budgetItemId?: string | null
  /** Lines this task consumes. When several, its effort splits across them. */
  budgetLines?: { budgetItemId: string; share?: number | string | null }[] | null
  startDate?: string | Date | null
  dueDate?: string | Date | null
  estimatedHours?: number | string | null
  status?: string | null
  completedAt?: string | Date | null
  updatedAt?: string | Date | null
}

export interface PhasingLine {
  id: string
  plannedCost?: number | string | null
  plannedAmount?: number | string | null
  /** EFFORT | ZERO_HUNDRED | FIFTY_FIFTY | MILESTONE */
  earnRule?: string | null
}

/**
 * Fraction of a line's value earned, given how far its work has got.
 * Delivery-based rules ignore partial progress on purpose: half an installed
 * robot has delivered nothing, and crediting half its value hides an advance.
 */
export function earnedFraction(rule: string | null | undefined, pct: number): number {
  switch (rule) {
    case "ZERO_HUNDRED": return pct >= 0.995 ? 1 : 0
    case "FIFTY_FIFTY":  return pct >= 0.995 ? 1 : pct > 0 ? 0.5 : 0
    case "MILESTONE":    return pct >= 0.995 ? 1 : 0
    default:             return Math.min(1, Math.max(0, pct))
  }
}

const ms = (v: any): number | null => {
  if (!v) return null
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : null
}
const num = (v: any): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const planned = (l: PhasingLine) => num(l.plannedCost ?? l.plannedAmount)
const weight = (t: PhasingTask) => Math.max(num(t.estimatedHours), 0) || 1

/** Fraction of a task that is *scheduled* to be done by time x (linear ramp). */
export function taskRamp(t: PhasingTask, x: number): number {
  const s = ms(t.startDate), e = ms(t.dueDate)
  if (e == null) return s != null && x >= s ? 1 : 0   // no due date: counts once started
  if (s == null || e <= s) return x >= e ? 1 : 0      // milestone-like: step at the due date
  return Math.min(1, Math.max(0, (x - s) / (e - s)))
}

/** Whether a task was actually complete by time x (for historical EV). */
export function taskDoneBy(t: PhasingTask, x: number): boolean {
  if (t.status !== "DONE") return false
  const c = ms(t.completedAt) ?? ms(t.updatedAt)
  return c != null && c <= x
}

export interface CostWeights {
  /** Dollars attributable to each task (by id or index key). */
  taskCost: Map<PhasingTask, number>
  /** Lines with no linked tasks: their money phases over the project window. */
  unphased: number
  /** Total planned cost represented (should equal BAC when lines are given). */
  total: number
}

/**
 * Spread planned cost onto tasks: a control account's money goes to its own
 * tasks; everything else falls back to the project-wide task pool.
 */
export function costWeights(tasks: PhasingTask[], lines: PhasingLine[], bac: number): CostWeights {
  const taskCost = new Map<PhasingTask, number>()
  let unphased = 0
  let total = 0

  // A task can now sit on several lines. Its effort is divided by `share` when
  // given, evenly otherwise — so linking two lines needs no extra input and a
  // task never contributes its full weight twice.
  const linkedByLine = new Map<string, { task: PhasingTask; portion: number }[]>()
  const unlinked: PhasingTask[] = []
  for (const t of tasks) {
    if (t.status === "CANCELLED") continue
    const links = (t.budgetLines?.length
      ? t.budgetLines
      : (t.budgetItemId ? [{ budgetItemId: t.budgetItemId, share: null }] : []))
      .filter(l => l?.budgetItemId)

    if (!links.length) { unlinked.push(t); continue }

    const shares = links.map(l => {
      const n = Number(l.share)
      return Number.isFinite(n) && n > 0 ? n : 0
    })
    const given = shares.reduce((a, b) => a + b, 0)
    for (let i = 0; i < links.length; i++) {
      const portion = given > 0 ? shares[i] / given : 1 / links.length
      const id = links[i].budgetItemId
      linkedByLine.set(id, [...(linkedByLine.get(id) || []), { task: t, portion }])
    }
  }

  // Money that has no control account: spread over whatever tasks remain, or
  // held as "unphased" when there are none.
  let poolMoney = 0

  if (lines.length) {
    for (const line of lines) {
      const cost = planned(line)
      total += cost
      const own = linkedByLine.get(line.id)
      if (own?.length) {
        const w = own.reduce((s, e) => s + weight(e.task) * e.portion, 0) || 1
        for (const e of own) {
          const share = (weight(e.task) * e.portion) / w
          taskCost.set(e.task, (taskCost.get(e.task) || 0) + cost * share)
        }
      } else {
        poolMoney += cost
      }
    }
  } else {
    poolMoney = bac
    total = bac
  }

  const pool = unlinked.length ? unlinked : tasks.filter(t => t.status !== "CANCELLED")
  if (poolMoney > 0 && pool.length) {
    const w = pool.reduce((s, t) => s + weight(t), 0) || 1
    for (const t of pool) {
      taskCost.set(t, (taskCost.get(t) || 0) + poolMoney * (weight(t) / w))
    }
  } else {
    unphased += poolMoney
  }

  return { taskCost, unphased, total: total || bac }
}

/** Linear ramp over the project window — used for money with no task to sit on. */
function windowRamp(x: number, start?: number | null, end?: number | null): number {
  if (start == null || end == null || end <= start) return 0
  return Math.min(1, Math.max(0, (x - start) / (end - start)))
}

export interface PhasingInput {
  tasks: PhasingTask[]
  lines: PhasingLine[]
  bac: number
  projectStart?: string | Date | null
  projectEnd?: string | Date | null
}

/** Planned value scheduled to be complete by time x. */
export function plannedValueAt(input: PhasingInput, at: number = Date.now()): number {
  const { tasks, lines, bac } = input
  const w = costWeights(tasks, lines, bac)
  let pv = 0
  w.taskCost.forEach((cost, t) => { pv += cost * taskRamp(t, at) })
  if (w.unphased > 0) {
    pv += w.unphased * windowRamp(at, ms(input.projectStart), ms(input.projectEnd))
  }
  return Math.round(pv * 100) / 100
}

/** Earned value actually completed by time x (historical, for curves). */
export function earnedValueAt(input: PhasingInput, at: number = Date.now()): number {
  const { tasks, lines, bac } = input
  const w = costWeights(tasks, lines, bac)
  let ev = 0
  w.taskCost.forEach((cost, t) => { if (taskDoneBy(t, at)) ev += cost })
  return Math.round(ev * 100) / 100
}
