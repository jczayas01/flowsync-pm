// src/app/api/projects/[projectId]/budget/recompute-ev/route.ts
//
// Recompute stored earned value for every budget line, on demand.
//
// Earned value is written when a task changes. That leaves a gap: link a task to
// a budget line without touching its progress, or change the links before the
// fix that ordered those writes correctly, and the stored figure keeps a number
// from a moment that no longer exists — a line reading "0% complete" next to an
// Earned column full of money. Rather than have the PM guess whether a number is
// current, give them a button that makes it current.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"
import { recomputeProjectEV } from "@/lib/evm-auto"

async function recompute(ctx: ApiContext, params?: Record<string, string>) {
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  { const _g = await requirePermission(ctx as any, "budget:edit" as any); if (_g) return _g }
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  // Project progress first: earned value is derived from it, so recomputing EV
  // against a stale percentage would just move the inconsistency one step along.
  const tasks = await db.task.findMany({
    where:  { projectId, parentId: null, status: { notIn: ["CANCELLED"] as any } },
    select: { percentComplete: true, estimatedHours: true },
  })
  let pct: number | undefined
  if (tasks.length) {
    const weight   = tasks.reduce((s, t) => s + (Number(t.estimatedHours) || 1), 0) || 1
    const weighted = tasks.reduce((s, t) => s + (t.percentComplete || 0) * (Number(t.estimatedHours) || 1), 0)
    pct = Math.round(weighted / weight)
    await db.project.update({ where: { id: projectId }, data: { percentComplete: pct } })
  }

  await recomputeProjectEV(db, projectId, pct)

  const items = await db.budgetItem.findMany({
    where: { projectId },
    select: { id: true, name: true, plannedCost: true, earnedValue: true },
  })
  return ok({
    percentComplete: pct ?? null,
    lines: items.map(i => ({
      id: i.id, name: i.name,
      plannedCost: Number(i.plannedCost || 0),
      earnedValue: Number(i.earnedValue || 0),
    })),
  })
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, recompute, params)
}
