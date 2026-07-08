import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  status: z.enum(["PENDING","PASS","FAIL","NA"]).optional(),
  notes:  z.string().max(2000).optional().nullable(),
})

async function update(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const item = await db.qualityChecklist.update({
    where:{ id:params!.itemId },
    data:{ ...parsed.data, inspectedAt: parsed.data.status && parsed.data.status!=="PENDING" ? new Date() : undefined },
  })
  return ok(item)
}

async function remove(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  await db.qualityChecklist.delete({ where:{ id:params!.itemId } })
  return ok({ deleted:true })
}

export const PATCH  = (req: NextRequest, { params }:any) => withWorkspace(req, update, params)
export const DELETE = (req: NextRequest, { params }:any) => withWorkspace(req, remove, params)
