export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  title:          z.string().min(1).max(300).optional(),
  description:    z.string().max(2000).optional().nullable(),
  category:       z.string().max(100).optional().nullable(),
  projectedValue: z.string().max(500).optional().nullable(),
  actualValue:    z.string().max(500).optional().nullable(),
  status:         z.enum(["PROJECTED","TRACKING","REALIZED","MISSED"]).optional(),
  measureBy:      z.string().datetime().optional().nullable(),
  measuredAt:     z.string().datetime().optional().nullable(),
  ownerId:        z.string().min(1).optional().nullable(),
  notes:          z.string().max(2000).optional().nullable(),
}).strict()

async function update(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, benefitId } = params || {}
  if (!projectId || !benefitId) return err("IDs required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const data: any = { ...parsed.data }
  if (data.measureBy !== undefined) data.measureBy = data.measureBy ? new Date(data.measureBy) : null
  if (data.measuredAt !== undefined) data.measuredAt = data.measuredAt ? new Date(data.measuredAt) : null
  if (data.status === "REALIZED" && !data.measuredAt) data.measuredAt = new Date()
  const updated = await db.benefit.update({ where:{ id:benefitId }, data,
    include: { owner: { select:{ id:true, name:true, avatarUrl:true } } } })
  return ok(updated)
}

async function remove(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, benefitId } = params || {}
  if (!projectId || !benefitId) return err("IDs required")
  await db.benefit.delete({ where:{ id:benefitId } })
  return ok({ deleted: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId:string; benefitId:string } }) { return withWorkspace(req, update, params) }
export async function DELETE(req: NextRequest, { params }: { params: { projectId:string; benefitId:string } }) { return withWorkspace(req, remove, params) }
