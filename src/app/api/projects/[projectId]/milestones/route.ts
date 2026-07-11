// src/app/api/projects/[projectId]/milestones/route.ts
// GET  — list milestones
// POST — create a milestone

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const createSchema = z.object({
  name:        z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  dueDate:     z.string().datetime(),
  color:       z.string().optional().default("#F59E0B"),
})

async function listMilestones(ctx: ApiContext, params?: Record<string,string>) {
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const milestones = await db.milestone.findMany({
    where:   { projectId },
    orderBy: { dueDate: "asc" },
    include: { acceptedBy: { select:{ id:true, name:true, avatarUrl:true } } },
  })

  return ok(milestones)
}

async function createMilestone(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const parsed = await parseBody(ctx.req, createSchema)
  if ("error" in parsed) return parsed.error

  const milestone = await db.milestone.create({
    data: {
      projectId,
      name:        parsed.data.name,
      description: parsed.data.description,
      dueDate:     new Date(parsed.data.dueDate),
      color:       parsed.data.color,
      status:      "UPCOMING",
    },
  })

  await audit(ctx.workspaceId, ctx.userId, "milestone.created", "project", projectId,
    undefined, { name: parsed.data.name })

  return ok(milestone, 201)
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, listMilestones, params)
}
export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, createMilestone, params)
}
