// src/app/api/projects/[projectId]/baselines/[baselineId]/route.ts
// PATCH — approve a baseline (formal PM Standard sign-off)
// DELETE — delete a baseline

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const patchSchema = z.object({
  action:        z.enum(["approve"]),
  approvalNotes: z.string().max(1000).optional().nullable(),
}).strict()

async function patchBaseline(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, baselineId } = params || {}
  if (!projectId || !baselineId) return err("IDs required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const existing = await db.baseline.findUnique({ where:{ id:baselineId } })
  if (!existing || existing.projectId !== projectId) return notFound("Baseline")

  const parsed = await parseBody(ctx.req, patchSchema)
  if ("error" in parsed) return parsed.error

  if (parsed.data.action === "approve") {
    if (existing.isApproved) return err("Baseline is already approved")

    const updated = await db.baseline.update({
      where: { id: baselineId },
      data: {
        isApproved:    true,
        approvedById:  ctx.userId,
        approvedAt:    new Date(),
        approvalNotes: parsed.data.approvalNotes || null,
      },
      include: {
        createdBy:  { select:{ id:true, name:true, avatarUrl:true } },
        approvedBy: { select:{ id:true, name:true, avatarUrl:true } },
      },
    })

    await audit(ctx.workspaceId, ctx.userId, "project.baseline_approved", "project", projectId,
      existing as any, updated as any)

    return ok({ ...updated, budgetTotal: Number(updated.budgetTotal) })
  }

  return err("Unknown action")
}

async function remove(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, baselineId } = params || {}
  if (!projectId || !baselineId) return err("IDs required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const existing = await db.baseline.findUnique({ where:{ id:baselineId } })
  if (!existing || existing.projectId !== projectId) return notFound("Baseline")

  // Cannot delete an approved baseline — PM Standard: approved baselines are permanent records
  if (existing.isApproved) {
    return err("Approved baselines cannot be deleted. They are part of the project's permanent record.")
  }

  await db.baseline.delete({ where:{ id:baselineId } })
  return ok({ deleted: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId:string; baselineId:string } }) {
  return withWorkspace(req, patchBaseline, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId:string; baselineId:string } }) {
  return withWorkspace(req, remove, params)
}
