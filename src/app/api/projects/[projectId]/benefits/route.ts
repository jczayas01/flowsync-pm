export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  title:          z.string().min(1).max(300),
  description:    z.string().max(2000).optional().nullable(),
  category:       z.string().max(100).optional().nullable(),
  projectedValue: z.string().max(500).optional().nullable(),
  actualValue:    z.string().max(500).optional().nullable(),
  status:         z.enum(["PROJECTED","TRACKING","REALIZED","MISSED"]).default("PROJECTED"),
  measureBy:      z.string().datetime().optional().nullable(),
  ownerId:        z.string().min(1).optional().nullable(),
  notes:          z.string().max(2000).optional().nullable(),
})

async function list(ctx: ApiContext, params?: Record<string,string>) {
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const benefits = await db.benefit.findMany({
    where: { projectId }, orderBy: { createdAt:"asc" },
    include: { owner: { select:{ id:true, name:true, avatarUrl:true } } },
  })
  return ok(benefits)
}

async function create(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const benefit = await db.benefit.create({
    data: { projectId, ...parsed.data, measureBy: parsed.data.measureBy ? new Date(parsed.data.measureBy) : null },
    include: { owner: { select:{ id:true, name:true, avatarUrl:true } } },
  })
  return ok(benefit, 201)
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) { return withWorkspace(req, list, params) }
export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) { return withWorkspace(req, create, params) }
