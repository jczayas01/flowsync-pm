import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  title:       z.string().min(1).max(300).optional(),
  description: z.string().max(3000).optional().nullable(),
  category:    z.string().max(100).optional().nullable(),
  priority:    z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).optional(),
  status:      z.enum(["OPEN","IN_PROGRESS","ESCALATED","RESOLVED","CLOSED"]).optional(),
  impact:      z.string().max(2000).optional().nullable(),
  resolution:  z.string().max(3000).optional().nullable(),
  ownerId:     z.string().min(1).optional().nullable(),
  dueDate:     z.string().datetime().optional().nullable(),
}).strict()

async function update(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, issueId } = params || {}
  if (!projectId || !issueId) return err("IDs required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const existing = await db.issue.findUnique({ where:{ id:issueId } })
  if (!existing || existing.projectId !== projectId) return notFound("Issue")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const data: any = { ...parsed.data }
  if (data.dueDate !== undefined) data.dueDate = data.dueDate ? new Date(data.dueDate) : null
  if (data.status === "RESOLVED" || data.status === "CLOSED") data.resolvedAt = new Date()
  const updated = await db.issue.update({ where:{ id:issueId }, data,
    include: { owner: { select:{ id:true, name:true, avatarUrl:true } }, raisedBy: { select:{ id:true, name:true, avatarUrl:true } } } })
  return ok(updated)
}

async function remove(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, issueId } = params || {}
  if (!projectId || !issueId) return err("IDs required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  await db.issue.delete({ where:{ id:issueId } })
  return ok({ deleted: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId:string; issueId:string } }) { return withWorkspace(req, update, params) }
export async function DELETE(req: NextRequest, { params }: { params: { projectId:string; issueId:string } }) { return withWorkspace(req, remove, params) }
