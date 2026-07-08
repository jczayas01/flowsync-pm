// src/app/api/projects/[projectId]/change-requests/[crId]/route.ts
// GET   — get a single change request
// PATCH — update status (approve, reject, implement) or edit fields

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { dispatchEvent } from "@/lib/automation/dispatch"
import { withWorkspace, ok, err, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const updateSchema = z.object({
  status:          z.enum(["DRAFT","SUBMITTED","UNDER_REVIEW","APPROVED","REJECTED","IMPLEMENTED"]).optional(),
  title:           z.string().min(1).max(200).optional(),
  description:     z.string().max(5000).optional().nullable(),
  priority:        z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).optional(),
  scheduleImpact:  z.string().max(100).optional().nullable(),
  budgetImpact:    z.number().optional().nullable(),
  scopeImpact:     z.string().max(2000).optional().nullable(),
  qualityImpact:   z.string().max(2000).optional().nullable(),
  rejectedReason:  z.string().max(2000).optional().nullable(),
}).strict()

async function getChangeRequest(ctx: ApiContext, params?: Record<string,string>) {
  const { projectId, crId } = params || {}
  if (!projectId || !crId) return err("Project ID and CR ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const cr = await db.changeRequest.findUnique({
    where:   { id: crId },
    include: {
      requestedBy: { select:{ id:true, name:true, avatarUrl:true } },
      approvedBy:  { select:{ id:true, name:true, avatarUrl:true } },
      comments:    {
        orderBy: { createdAt: "asc" },
        include: { author: { select:{ id:true, name:true, avatarUrl:true } } },
      },
    },
  })
  if (!cr || cr.projectId !== projectId) return notFound("Change request")

  return ok({ ...cr, budgetImpact: cr.budgetImpact ? Number(cr.budgetImpact) : null })
}

async function updateChangeRequest(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "changes:create" as any); if (_g) return _g }
  const { projectId, crId } = params || {}
  if (!projectId || !crId) return err("Project ID and CR ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const existing = await db.changeRequest.findUnique({ where: { id: crId } })
  if (!existing || existing.projectId !== projectId) return notFound("Change request")

  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error

  const data: any = { ...parsed.data }

  // Set approval/rejection metadata automatically
  if (data.status === "APPROVED") {
    data.approvedById = ctx.userId
    data.approvedAt   = new Date()
  }
  if (data.status === "IMPLEMENTED") {
    data.implementedAt = new Date()
  }

  const updated = await db.changeRequest.update({
    where: { id: crId },
    data,
    include: {
      requestedBy: { select:{ id:true, name:true, avatarUrl:true } },
      approvedBy:  { select:{ id:true, name:true, avatarUrl:true } },
    },
  })

  await audit(ctx.workspaceId, ctx.userId, "change_request.updated", "project", projectId,
    existing as any, updated as any)

  if (data.status === "APPROVED") {
    dispatchEvent(ctx.workspaceId, "CHANGE_APPROVED", {
      projectId, actorId: ctx.userId,
      title: `Change request approved: ${updated.title}`, link: `/projects/${projectId}`,
      data: { id: updated.id, title: updated.title },
    }).catch(() => {})
  }

  return ok({ ...updated, budgetImpact: updated.budgetImpact ? Number(updated.budgetImpact) : null })
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string; crId: string } }) {
  return withWorkspace(req, getChangeRequest, params)
}
export async function PATCH(req: NextRequest, { params }: { params: { projectId: string; crId: string } }) {
  return withWorkspace(req, updateChangeRequest, params)
}
