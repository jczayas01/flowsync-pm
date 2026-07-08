import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

async function remove(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, itemId } = params || {}
  if (!projectId || !itemId) return err("IDs required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  await db.procurementItem.delete({ where:{ id:itemId } })
  return ok({ deleted:true })
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId:string; itemId:string } }) {
  return withWorkspace(req, remove, params)
}
