import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  deliverable:   z.string().min(1).max(300),
  criteria:      z.string().max(2000).optional().nullable(),
  inspector:     z.string().max(200).optional().nullable(),
  scheduledDate: z.string().optional().nullable(),
})

async function list(ctx: ApiContext, params?: Record<string,string>) {
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const items = await db.qualityChecklist.findMany({
    where: { projectId:params!.projectId }, orderBy:{ createdAt:"asc" }
  })
  return ok({ items })
}

async function create(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  try {
    const item = await db.qualityChecklist.create({
      data: {
        projectId:    params!.projectId,
        createdById:  ctx.userId,
        deliverable:  parsed.data.deliverable,
        items:        [{
          criterion:     parsed.data.criteria ?? "",
          inspector:     parsed.data.inspector ?? null,
          scheduledDate: parsed.data.scheduledDate ?? null,
          passed:        false,
        }] as any,
        status:       "PENDING",
      }
    })
    return ok(item, 201)
  } catch(e:any) {
    return err(e?.message||"Failed to create checklist item", 500)
  }
}

export const GET  = (req: NextRequest, { params }:any) => withWorkspace(req, list,   params)
export const POST = (req: NextRequest, { params }:any) => withWorkspace(req, create, params)
