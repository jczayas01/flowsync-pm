// src/lib/evm-auto.ts
// Automatic Earned Value: keeps stored BudgetItem.earnedValue in sync with
// task progress, using the same weighted-percent formula the Budget tab's
// on-screen EVM dashboard already uses (EV = plannedCost × project %).
//
// Called inline from the task update transaction (immediate consistency for
// dashboards, PDF charts and the executive CPI/SPI map) and from the daily
// cron as a catch-all reconcile. Deliberately NOT routed through the
// automation engine so it works regardless of engine env configuration.
//
// Projects can opt out with Project.autoEv = false, preserving manually
// curated earned-value entries.

import { db } from "@/lib/db"

type Tx = Pick<typeof db, "project" | "budgetItem" | "task">

/**
 * Recompute earned value for one project's budget items.
 * @param client  db or an open Prisma transaction
 * @param projectId project to recompute
 * @param pct optional already-known percent complete (0–100); fetched if omitted
 */
export async function recomputeProjectEV(
  client: Tx, projectId: string, pct?: number,
  /** Explicit user action: recompute even with Auto EV switched off. */
  force = false,
) {
  const project = await client.project.findUnique({
    where: { id: projectId },
    select: { autoEv: true, percentComplete: true },
  })
  if (!project) return
  // Auto EV off means the PM curates earned value by hand, so automatic passes
  // must leave it alone — but a deliberate "recalculate" is not an automatic pass.
  if (project.autoEv === false && !force) return

  const projectFraction = Math.min(100, Math.max(0, pct ?? project.percentComplete ?? 0)) / 100

  const items = await client.budgetItem.findMany({
    where: { projectId },
    select: { id: true, plannedCost: true, earnedValue: true, earnRule: true },
  })

  // Control accounts: when tasks are linked to a budget line, that line earns
  // value from ITS OWN work — hours-weighted, same rule as the project rollup.
  // Onboarding finished and implementation not started must not average into a
  // single percentage smeared across both lines.
  // A task can sit on several lines; its effort divides across them by share,
  // evenly when no share is set. Reading only `budgetItemId` would count a
  // multi-line task at full weight on one line and ignore the others.
  const linked = await client.task.findMany({
    where: { projectId, status: { notIn: ["CANCELLED"] } },
    select: {
      budgetItemId: true, percentComplete: true, estimatedHours: true,
      budgetLines: { select: { budgetItemId: true, share: true } },
    },
  })
  const byLine = new Map<string, { weighted: number; weight: number }>()
  for (const t of linked as any[]) {
    const links = (t.budgetLines?.length
      ? t.budgetLines
      : (t.budgetItemId ? [{ budgetItemId: t.budgetItemId, share: null }] : []))
      .filter((l: any) => l?.budgetItemId)
    if (!links.length) continue

    const shares = links.map((l: any) => {
      const n = Number(l.share)
      return Number.isFinite(n) && n > 0 ? n : 0
    })
    const given = shares.reduce((a: number, b: number) => a + b, 0)
    const base  = Number(t.estimatedHours) || 1

    links.forEach((l: any, i: number) => {
      const portion = given > 0 ? shares[i] / given : 1 / links.length
      const w = base * portion
      const acc = byLine.get(l.budgetItemId) || { weighted: 0, weight: 0 }
      acc.weighted += (t.percentComplete || 0) * w
      acc.weight   += w
      byLine.set(l.budgetItemId, acc)
    })
  }

  /**
   * Turn a line's task progress into the fraction of value it has earned.
   * Effort-based lines track progress directly. Everything else deliberately
   * ignores partial progress: a robot half-installed has delivered nothing, and
   * crediting it half its value is what lets an advance payment hide.
   */
  const applyRule = (rule: string | null | undefined, taskPct: number, started: boolean): number => {
    switch (rule) {
      case "ZERO_HUNDRED": return taskPct >= 99.5 ? 1 : 0
      case "FIFTY_FIFTY":  return taskPct >= 99.5 ? 1 : started ? 0.5 : 0
      case "MILESTONE":    return taskPct >= 99.5 ? 1 : 0
      default:             return Math.min(100, Math.max(0, taskPct)) / 100
    }
  }

  for (const item of items) {
    const acc = byLine.get(item.id)
    // A line with its own tasks uses their progress; a line with none keeps the
    // proportional behaviour, so existing projects are unaffected.
    const taskPct  = acc && acc.weight > 0 ? acc.weighted / acc.weight : null
    const fraction = taskPct !== null
      ? applyRule((item as any).earnRule, taskPct, taskPct > 0)
      // No linked tasks: the proportional fallback is an estimate, and applying
      // a delivery rule to an estimate would dress a guess as a measurement.
      : projectFraction
    const target = Math.round(Number(item.plannedCost || 0) * fraction * 100) / 100
    if (Number(item.earnedValue || 0) !== target) {
      await client.budgetItem.update({ where: { id: item.id }, data: { earnedValue: target } })
    }
  }
}

/** Daily catch-all: reconcile EV for every auto-EV project with budget items. */
export async function reconcileAllEV() {
  const projects = await db.project.findMany({
    where: {
      autoEv: true,
      status: { in: ["ACTIVE", "ON_HOLD"] },
      budget: { some: {} },
    },
    select: { id: true, percentComplete: true },
  }).catch(() => [])
  for (const p of projects) {
    await recomputeProjectEV(db, p.id, p.percentComplete).catch(() => {})
  }
  return projects.length
}
