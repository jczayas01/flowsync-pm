export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const updateSchema = z.object({
  vendorName:    z.string().min(1).max(200).optional(),
  vendorContact: z.string().max(200).optional().nullable(),
  vendorEmail:   z.string().email().optional().nullable().or(z.literal("")),
  vendorPhone:   z.string().max(50).optional().nullable(),
  vendorLocation: z.string().max(300).optional().nullable(),
  type:          z.enum(["CONTRACT","PURCHASE_ORDER","SOW","MSA","NDA","OTHER"]).optional(),
  title:         z.string().min(1).max(300).optional(),
  poNumber:      z.string().max(100).optional().nullable(),
  contractRef:   z.string().max(100).optional().nullable(),
  value:         z.number().min(0).optional().nullable(),
  currency:      z.string().optional(),
  startDate:     z.string().optional().nullable(),
  endDate:       z.string().optional().nullable(),
  status:        z.enum(["DRAFT","ACTIVE","COMPLETED","CANCELLED","ON_HOLD"]).optional(),
  deliverables:  z.string().max(3000).optional().nullable(),
  notes:         z.string().max(3000).optional().nullable(),
  ownerId:       z.string().optional().nullable(),
})

async function update(ctx: ApiContext, params?: Record<string,string>) {
  { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, itemId } = params || {}
  if (!projectId || !itemId) return err("IDs required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error
  const d = parsed.data
  try {
    const item = await db.procurementItem.update({
      where: { id: itemId },
      data: {
        ...d,
        vendorEmail: d.vendorEmail === "" ? null : d.vendorEmail,
        ownerId:     d.ownerId === "" ? null : d.ownerId,
        startDate:   d.startDate === undefined ? undefined : (d.startDate ? new Date(d.startDate) : null),
        endDate:     d.endDate   === undefined ? undefined : (d.endDate   ? new Date(d.endDate)   : null),
      },
    })
    return ok({ id: item.id })
  } catch (e: any) {
    return err(e?.message || "Failed to update procurement item", 500)
  }
}

async function remove(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, itemId } = params || {}
  if (!projectId || !itemId) return err("IDs required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  await db.procurementItem.delete({ where:{ id:itemId } })
  return ok({ deleted:true })
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId:string; itemId:string } }) {
  return withWorkspace(req, update, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId:string; itemId:string } }) {
  return withWorkspace(req, remove, params)
}
