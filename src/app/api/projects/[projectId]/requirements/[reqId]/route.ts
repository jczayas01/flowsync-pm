export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  status:   z.enum(["DRAFT","APPROVED","IMPLEMENTED","VERIFIED","REJECTED"]).optional(),
  priority: z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).optional(),
  title:    z.string().max(300).optional(),
  description: z.string().max(3000).optional().nullable(),
  category: z.string().max(60).optional().nullable(),
  source:   z.string().max(200).optional().nullable(),
  acceptanceCriteria: z.string().max(3000).optional().nullable(),
  linkedTaskId: z.string().optional().nullable(),
})

async function update(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const req = await db.requirement.update({
    where:{ id:params!.reqId }, data:parsed.data
  })
  return ok(req)
}

async function remove(ctx: ApiContext, params?: Record<string,string>) {
  { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const existing = await db.requirement.findFirst({
    where: { id: params!.reqId, projectId: params!.projectId }, select: { id: true, code: true, title: true },
  })
  if (!existing) return notFound("Requirement")
  await db.requirement.delete({ where: { id: existing.id } })
  await audit(ctx.workspaceId, ctx.userId, "requirement.deleted", "project", params!.projectId,
    { code: existing.code, title: existing.title }).catch(() => {})
  return ok({ deleted: true })
}

export const PATCH  = (req: NextRequest, { params }:any) => withWorkspace(req, update, params)
export const DELETE = (req: NextRequest, { params }:any) => withWorkspace(req, remove, params)
