import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  title:        z.string().min(1).max(300).optional(),
  description:  z.string().max(3000).optional().nullable(),
  rationale:    z.string().max(3000).optional().nullable(),
  alternatives: z.string().max(3000).optional().nullable(),
  impact:       z.string().max(2000).optional().nullable(),
  madeAt:       z.string().datetime().optional(),
}).strict()

async function update(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, decisionId } = params || {}
  if (!projectId || !decisionId) return err("IDs required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const data: any = { ...parsed.data }
  if (data.madeAt) data.madeAt = new Date(data.madeAt)
  const updated = await db.decision.update({ where:{ id:decisionId }, data,
    include: { madeBy: { select:{ id:true, name:true, avatarUrl:true } } } })
  return ok(updated)
}

async function remove(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, decisionId } = params || {}
  if (!projectId || !decisionId) return err("IDs required")
  await db.decision.delete({ where:{ id:decisionId } })
  return ok({ deleted: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId:string; decisionId:string } }) { return withWorkspace(req, update, params) }
export async function DELETE(req: NextRequest, { params }: { params: { projectId:string; decisionId:string } }) { return withWorkspace(req, remove, params) }
