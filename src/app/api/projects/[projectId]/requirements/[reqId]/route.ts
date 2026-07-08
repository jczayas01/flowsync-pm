import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  status:   z.enum(["DRAFT","APPROVED","IMPLEMENTED","VERIFIED","REJECTED"]).optional(),
  priority: z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).optional(),
  title:    z.string().max(300).optional(),
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

export const PATCH = (req: NextRequest, { params }:any) => withWorkspace(req, update, params)
