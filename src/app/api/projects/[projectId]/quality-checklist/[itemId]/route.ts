export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  status: z.enum(["PENDING","PASS","FAIL","NA"]).optional(),
  notes:  z.string().max(2000).optional().nullable(),
  // A checklist you can only tick is a checklist you can't correct.
  deliverable: z.string().min(1).max(300).optional(),
  criteria:    z.string().max(2000).optional().nullable(),
})

async function update(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const d = parsed.data as any
  const data: any = { ...d }
  if (d.criteria !== undefined) {
    // `items` is the stored JSON column; the form edits it as lines of text.
    data.items = String(d.criteria || "").split("\n").map(x => x.trim()).filter(Boolean)
    delete data.criteria
  }
  const item = await db.qualityChecklist.update({
    where:{ id:params!.itemId },
    data:{ ...data, reviewedAt: d.status && d.status!=="PENDING" ? new Date() : undefined },
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
