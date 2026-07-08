// src/app/api/projects/[projectId]/members/route.ts
// GET  /api/projects/:projectId/members — list members with roles
// POST /api/projects/:projectId/members — add a member to the project

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { dispatchEvent } from "@/lib/automation/dispatch"
import {
  withWorkspace, ok, err, notFound, forbidden,
  parseBody, audit, verifyProjectAccess, ApiContext,
} from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const addMemberSchema = z.object({
  userId:      z.string().min(1),
  role:        z.enum(["PM","MEMBER","VIEWER","CLIENT"]).default("MEMBER"),
  projectRole: z.enum(['EXECUTIVE_SPONSOR','SPONSOR','STEERING_COMMITTEE','PMO_DIRECTOR','PMO','PROGRAM_MANAGER','PM','PRODUCT_OWNER','BUSINESS_ANALYST','TECH_LEAD','SCRUM_MASTER','TEAM_MEMBER','STAKEHOLDER','EXTERNAL_RESOURCE','CLIENT','AUDITOR']).optional().nullable(),
  allocation:  z.number().int().min(0).max(100).default(100),
})

async function listMembers(ctx: ApiContext, params?: Record<string,string>) {
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const members = await db.projectMember.findMany({
    where:   { projectId },
    include: { user: { select:{ id:true, name:true, email:true, avatarUrl:true } } },
    orderBy: { joinedAt: "asc" },
  })

  return ok(members)
}

async function addMember(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:manage_members" as any); if (_g) return _g }
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  if (access.role && !["OWNER","ADMIN","SUPER_ADMIN","PM"].includes(access.role)) {
    return forbidden()
  }

  const parsed = await parseBody(ctx.req, addMemberSchema)
  if ("error" in parsed) return parsed.error
  const { userId, role, projectRole, allocation } = parsed.data

  // Verify user is in the workspace
  const wsMember = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId } },
  })
  if (!wsMember) return err("User is not a member of this workspace", 400)

  const member = await db.projectMember.upsert({
    where:  { projectId_userId: { projectId, userId } },
    update: { role, projectRole, allocation },
    create: { projectId, userId, role, projectRole, allocation },
    include: { user: { select:{ id:true, name:true, email:true, avatarUrl:true } } },
  })

  await audit(ctx.workspaceId, ctx.userId, "project.member_added", "project", projectId,
    undefined, { userId, role, projectRole })

  dispatchEvent(ctx.workspaceId, "MEMBER_ADDED", {
    projectId, actorId: ctx.userId,
    title: `Member added to project`, link: `/projects/${projectId}`,
    data: { userId, projectRole },
  }).catch(() => {})

  return ok(member, 201)
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, listMembers, params)
}
export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, addMember, params)
}
