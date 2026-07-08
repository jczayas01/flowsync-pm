// src/app/api/projects/[projectId]/milestones/[milestoneId]/route.ts
// PATCH — update milestone (including sign-off acceptance)
// DELETE — delete milestone

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { dispatchEvent } from "@/lib/automation/dispatch"
import { withWorkspace, ok, err, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const updateSchema = z.object({
  name:             z.string().min(1).max(300).optional(),
  description:      z.string().max(2000).optional().nullable(),
  dueDate:          z.string().datetime().optional(),
  status:           z.enum(["UPCOMING","AT_RISK","ACHIEVED","MISSED"]).optional(),
  color:            z.string().optional(),
  achievedAt:       z.string().datetime().optional().nullable(),
  // Acceptance / sign-off
  action:           z.enum(["sign_off"]).optional(),
  acceptanceNotes:  z.string().max(2000).optional().nullable(),
}).strict()

async function updateMilestone(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, milestoneId } = params || {}
  if (!projectId || !milestoneId) return err("IDs required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const existing = await db.milestone.findUnique({ where:{ id:milestoneId } })
  if (!existing || existing.projectId !== projectId) return notFound("Milestone")

  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error

  const { action, acceptanceNotes, dueDate, achievedAt, ...rest } = parsed.data

  const data: any = { ...rest }
  if (dueDate) data.dueDate = new Date(dueDate)
  if (achievedAt !== undefined) data.achievedAt = achievedAt ? new Date(achievedAt) : null

  // Sign-off action — formal PM Standard deliverable acceptance
  if (action === "sign_off") {
    data.acceptedAt      = new Date()
    data.acceptedById    = ctx.userId
    data.acceptanceNotes = acceptanceNotes || null
    data.status          = "ACHIEVED"
    data.achievedAt      = new Date()
  }

  const updated = await db.milestone.update({
    where:   { id: milestoneId },
    data,
    include: { acceptedBy: { select:{ id:true, name:true, avatarUrl:true } } },
  })

  await audit(ctx.workspaceId, ctx.userId,
    action === "sign_off" ? "milestone.signed_off" : "milestone.updated",
    "project", projectId, existing as any, updated as any)

  if (data.status === "ACHIEVED") {
    dispatchEvent(ctx.workspaceId, "MILESTONE_COMPLETED", {
      projectId, actorId: ctx.userId,
      title: `Milestone achieved: ${updated.name}`, link: `/projects/${projectId}`,
      data: { id: updated.id, name: updated.name },
    }).catch(() => {})
  }

  return ok(updated)
}

async function deleteMilestone(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, milestoneId } = params || {}
  if (!projectId || !milestoneId) return err("IDs required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const existing = await db.milestone.findUnique({ where:{ id:milestoneId } })
  if (!existing || existing.projectId !== projectId) return notFound("Milestone")

  await db.milestone.delete({ where:{ id:milestoneId } })

  return ok({ deleted: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId:string; milestoneId:string } }) {
  return withWorkspace(req, updateMilestone, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId:string; milestoneId:string } }) {
  return withWorkspace(req, deleteMilestone, params)
}
