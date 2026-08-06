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
export async function recomputeProjectEV(client: Tx, projectId: string, pct?: number) {
  const project = await client.project.findUnique({
    where: { id: projectId },
    select: { autoEv: true, percentComplete: true },
  })
  if (!project || project.autoEv === false) return

  const projectFraction = Math.min(100, Math.max(0, pct ?? project.percentComplete ?? 0)) / 100

  const items = await client.budgetItem.findMany({
    where: { projectId },
    select: { id: true, plannedCost: true, earnedValue: true },
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

  for (const item of items) {
    const acc = byLine.get(item.id)
    // A line with its own tasks uses their progress; a line with none keeps the
    // proportional behaviour, so existing projects are unaffected.
    const fraction = acc && acc.weight > 0
      ? Math.min(100, Math.max(0, acc.weighted / acc.weight)) / 100
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
