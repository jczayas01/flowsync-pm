// src/lib/program-rollup.ts
// Program and portfolio rollups.
//
// Two things this fixes.
//
// 1. Completion was an unweighted mean of project.percentComplete, so a $2M
//    project and a $10K project moved the program number equally. Rolled-up
//    completion is weighted by budget at completion — the standard basis, and
//    the only one that survives a PMO director asking how it was derived.
//
// 2. There was no program-level EVM at all. Every input already exists per
//    project, and EVM sums cleanly by definition: BAC, EV, PV and AC are all
//    currency, so a program's CPI is ΣEV/ΣAC and its SPI is ΣEV/ΣPV. The
//    indices themselves must never be averaged — the mean of two CPIs is not
//    the CPI of the pair unless both carry identical cost, which they never do.
//
// Planned value reuses plannedValueAt(), the same time-phased function the
// project page and the S-curve use, so a program SPI can be reconciled against
// the projects underneath it. Falling back to elapsed-time PV here would have
// produced a program figure that quietly disagrees with its own children.

import { plannedValueAt, PhasingTask, PhasingLine } from "@/lib/evm-phasing"

export type RollupProject = {
  id: string
  name?: string | null
  percentComplete?: number | null
  budgetTotal?: unknown
  budgetSpent?: unknown
  startDate?: string | Date | null
  endDate?: string | Date | null
  health?: string | null
  status?: string | null
  budgetItems?: { id: string; plannedCost?: unknown; earnedValue?: unknown; earnRule?: string | null }[]
  tasks?: PhasingTask[]
}

export type EvmTotals = {
  bac: number; ev: number; pv: number; ac: number
  cv: number; sv: number
  cpi: number | null      // null when there is no actual cost to divide by
  spi: number | null      // null when no planned value has accrued yet
  eac: number; vac: number
  /** Budget-weighted completion, 0-100. */
  percentComplete: number
  /** Projects that contributed a BAC, i.e. the weighting basis. */
  weightedFrom: number
  /** False when no project carries a budget — indices are not yet meaningful. */
  hasBaseline: boolean
  projects: number
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** One project's EVM, using the same rules as the project budget tab. */
export function projectEvm(p: RollupProject, at: number = Date.now()) {
  const lines = p.budgetItems ?? []
  // budgetTotal is the authority; fall back to the sum of lines when a project
  // was imported without a header total.
  const bac = num(p.budgetTotal) || lines.reduce((s, l) => s + num(l.plannedCost), 0)
  const ac  = num(p.budgetSpent)

  // Earned value comes from the lines, which earn from their own tasks. Only
  // when no line reports any does the project rollup percentage stand in.
  const lineEv = lines.reduce((s, l) => s + num(l.earnedValue), 0)
  const pct    = Math.min(100, Math.max(0, num(p.percentComplete))) / 100
  const ev     = lineEv > 0 ? lineEv : bac * pct

  const tasks = p.tasks ?? []
  const pv = tasks.length
    ? plannedValueAt({
        tasks, lines: lines as unknown as PhasingLine[], bac,
        projectStart: p.startDate, projectEnd: p.endDate,
      }, at)
    : bac * elapsedFraction(p.startDate, p.endDate, at, pct)

  return { bac, ev, pv, ac }
}

/**
 * Share of the project window elapsed. Used only when a project has no tasks to
 * phase against; returns the project's own completion so SPI stays neutral
 * rather than inventing a variance out of missing dates.
 */
function elapsedFraction(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
  at: number,
  fallback: number,
): number {
  const st = start ? new Date(start).getTime() : NaN
  const en = end   ? new Date(end).getTime()   : NaN
  if (!Number.isFinite(st) || !Number.isFinite(en) || en <= st) return fallback
  return Math.min(1, Math.max(0, (at - st) / (en - st)))
}

/**
 * Roll a set of projects into one EVM picture. Safe on an empty set.
 * `eacMethod` mirrors the project-level choice; CPI-based is the default.
 */
export function rollupEvm(
  projects: RollupProject[],
  opts: { at?: number; eacMethod?: "CPI" | "PLANNED" } = {},
): EvmTotals {
  const at = opts.at ?? Date.now()
  let bac = 0, ev = 0, pv = 0, ac = 0, weightedFrom = 0

  for (const p of projects) {
    const e = projectEvm(p, at)
    bac += e.bac; ev += e.ev; pv += e.pv; ac += e.ac
    if (e.bac > 0) weightedFrom++
  }

  const round = (n: number) => Math.round(n * 100) / 100
  bac = round(bac); ev = round(ev); pv = round(pv); ac = round(ac)

  // Budget-weighted completion. With no budgets anywhere there is nothing to
  // weight by, so fall back to the plain mean rather than reporting zero.
  const percentComplete = bac > 0
    ? Math.round((ev / bac) * 100)
    : projects.length
      ? Math.round(projects.reduce((s, p) => s + num(p.percentComplete), 0) / projects.length)
      : 0

  // CPI is only meaningful once value has been earned. With EV = 0 and AC > 0 —
  // a project that has started spending but not yet completed anything — the
  // ratio is a true 0.00 that reads as catastrophic performance rather than
  // "too early to tell". Suppress it, exactly as SPI is suppressed with no PV.
  const cpi = ac > 0 && ev > 0 ? ev / ac : null
  const spi = pv > 0 && ev > 0 ? ev / pv : null
  // Nothing planned anywhere means no baseline to measure against.
  const hasBaseline = bac > 0
  const eac = opts.eacMethod === "PLANNED"
    ? ac + Math.max(0, bac - ev)
    : (cpi && cpi > 0 ? bac / cpi : bac)

  return {
    bac, ev, pv, ac,
    cv: round(ev - ac),
    sv: round(ev - pv),
    cpi: cpi == null ? null : Math.round(cpi * 100) / 100,
    spi: spi == null ? null : Math.round(spi * 100) / 100,
    eac: round(eac),
    vac: round(bac - eac),
    percentComplete,
    weightedFrom,
    hasBaseline,
    projects: projects.length,
  }
}

/** Worst-of health across projects, ignoring closed ones. */
export function rollupHealth(projects: RollupProject[]): "GREEN" | "AMBER" | "RED" {
  const live = projects.filter(p =>
    p.status !== "COMPLETED" && p.status !== "CANCELLED" && p.status !== "ARCHIVED")
  const set = live.length ? live : projects
  if (set.some(p => p.health === "RED"))   return "RED"
  if (set.some(p => p.health === "AMBER")) return "AMBER"
  return "GREEN"
}
