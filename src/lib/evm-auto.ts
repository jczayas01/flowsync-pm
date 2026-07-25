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

type Tx = Pick<typeof db, "project" | "budgetItem">

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

  const fraction = Math.min(100, Math.max(0, pct ?? project.percentComplete ?? 0)) / 100

  const items = await client.budgetItem.findMany({
    where: { projectId },
    select: { id: true, plannedCost: true, earnedValue: true },
  })
  for (const item of items) {
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
