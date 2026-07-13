// PATCH  /api/projects/:projectId/phases/:phaseId — rename / reorder / color / status
// DELETE /api/projects/:projectId/phases/:phaseId — delete; tasks move via ?moveTo=<phaseId|none>
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext,
} from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const updateSchema = z.object({
  name:   z.string().min(1).max(120).optional(),
  color:  z.string().max(20).optional().nullable(),
  order:  z.number().int().min(0).optional(),
  status: z.enum(["PENDING","IN_PROGRESS","COMPLETED","ON_HOLD"]).optional(),
})

async function load(ctx: ApiContext, params?: Record<string, string>) {
  const { projectId, phaseId } = params || {}
  if (!projectId || !phaseId) return { error: err("IDs required") }
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return { error: notFound("Project") }
  const phase = await db.phase.findFirst({ where: { id: phaseId, projectId } })
  if (!phase) return { error: notFound("Phase") }
  return { phase, projectId }
}

async function update(ctx: ApiContext, params?: Record<string, string>) {
  { const g = await requirePermission(ctx as any, "projects:edit" as any); if (g) return g }
  const { phase, projectId, error } = await load(ctx, params)
  if (error) return error

  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error
  const d = parsed.data

  // Reorder: swap with the phase currently holding the target order
  if (d.order !== undefined && d.order !== phase!.order) {
    const other = await db.phase.findFirst({ where: { projectId: projectId!, order: d.order } })
    if (other) await db.phase.update({ where: { id: other.id }, data: { order: phase!.order } })
  }

  const updated = await db.phase.update({
    where: { id: phase!.id },
    data: { ...d, name: d.name?.trim() },
  })
  return ok({ id: updated.id })
}

async function remove(ctx: ApiContext, params?: Record<string, string>) {
  { const g = await requirePermission(ctx as any, "projects:edit" as any); if (g) return g }
  const { phase, projectId, error } = await load(ctx, params)
  if (error) return error

  const taskCount = await db.task.count({ where: { phaseId: phase!.id } })
  const moveTo = new URL(ctx.req.url).searchParams.get("moveTo")

  if (taskCount > 0 && !moveTo) {
    return err(`This phase contains ${taskCount} task(s). Choose where to move them first.`, 409)
  }
  if (taskCount > 0 && moveTo) {
    if (moveTo === "none") {
      await db.task.updateMany({ where: { phaseId: phase!.id }, data: { phaseId: null } })
    } else {
      const target = await db.phase.findFirst({ where: { id: moveTo, projectId: projectId! } })
      if (!target) return err("Target phase not found", 400)
      await db.task.updateMany({ where: { phaseId: phase!.id }, data: { phaseId: target.id } })
    }
  }

  await db.phase.delete({ where: { id: phase!.id } })
  // Compact ordering
  const rest = await db.phase.findMany({ where: { projectId: projectId! }, orderBy: { order: "asc" } })
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].order !== i + 1)
      await db.phase.update({ where: { id: rest[i].id }, data: { order: i + 1 } })
  }
  return ok({ deleted: true, movedTasks: taskCount })
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string; phaseId: string } }) {
  return withWorkspace(req, update, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId: string; phaseId: string } }) {
  return withWorkspace(req, remove, params)
}
