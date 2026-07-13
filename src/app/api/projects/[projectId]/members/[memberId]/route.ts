// src/app/api/projects/[projectId]/members/[memberId]/route.ts
// PATCH  /api/projects/:projectId/members/:memberId — update role/projectRole/allocation
// DELETE /api/projects/:projectId/members/:memberId — remove member from project

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  withWorkspace, ok, err, notFound, forbidden,
  parseBody, audit, verifyProjectAccess, ApiContext,
} from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const updateMemberSchema = z.object({
  role:        z.enum(["PM","MEMBER","VIEWER","CLIENT"]).optional(),
  projectRole: z.enum(['EXECUTIVE_SPONSOR','SPONSOR','STEERING_COMMITTEE','PMO_DIRECTOR','PMO','PROGRAM_MANAGER','PM','PRODUCT_OWNER','BUSINESS_ANALYST','TECH_LEAD','SCRUM_MASTER','TEAM_MEMBER','STAKEHOLDER','EXTERNAL_RESOURCE','CLIENT','AUDITOR']).optional().nullable(),
  allocation:  z.number().int().min(0).max(100).optional(),
}).strict()

async function updateMember(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:manage_members" as any); if (_g) return _g }
  const { projectId, memberId } = params || {}
  if (!projectId || !memberId) return err("Project ID and member ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  if (access.role && !["OWNER","ADMIN","SUPER_ADMIN","PM"].includes(access.role)) {
    return forbidden()
  }

  const existing = await db.projectMember.findUnique({ where: { id: memberId } })
  if (!existing || existing.projectId !== projectId) return notFound("Member")

  const parsed = await parseBody(ctx.req, updateMemberSchema)
  if ("error" in parsed) return parsed.error

  const updated = await db.projectMember.update({
    where: { id: memberId },
    data:  parsed.data,
    include: { user: { select:{ id:true, name:true, email:true, avatarUrl:true } } },
  })

  await audit(ctx.workspaceId, ctx.userId, "project.member_updated", "project", projectId,
    existing as any, updated as any)

  return ok(updated)
}

async function removeMember(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:manage_members" as any); if (_g) return _g }
  const { projectId, memberId } = params || {}
  if (!projectId || !memberId) return err("Project ID and member ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  if (access.role && !["OWNER","ADMIN","SUPER_ADMIN","PM"].includes(access.role)) {
    return forbidden()
  }

  const existing = await db.projectMember.findUnique({ where: { id: memberId } })
  if (!existing || existing.projectId !== projectId) return notFound("Member")

  await db.projectMember.delete({ where: { id: memberId } })

  await audit(ctx.workspaceId, ctx.userId, "project.member_removed", "project", projectId,
    existing as any, undefined)

  return ok({ deleted: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string; memberId: string } }) {
  return withWorkspace(req, updateMember, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId: string; memberId: string } }) {
  return withWorkspace(req, removeMember, params)
}
