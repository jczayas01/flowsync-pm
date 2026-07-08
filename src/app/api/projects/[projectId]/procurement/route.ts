// src/app/api/projects/[projectId]/procurement/route.ts
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  vendorName:    z.string().min(1).max(200),
  vendorContact: z.string().max(200).optional().nullable(),
  vendorEmail:   z.string().email().optional().nullable().or(z.literal("")),
  type:          z.enum(["CONTRACT","PURCHASE_ORDER","SOW","MSA","NDA","OTHER"]).default("CONTRACT"),
  title:         z.string().min(1).max(300),
  poNumber:      z.string().max(100).optional().nullable(),
  contractRef:   z.string().max(100).optional().nullable(),
  value:         z.number().min(0).optional().nullable(),
  currency:      z.string().default("USD"),
  startDate:     z.string().optional().nullable(),
  endDate:       z.string().optional().nullable(),
  status:        z.enum(["DRAFT","ACTIVE","COMPLETED","CANCELLED","ON_HOLD"]).default("ACTIVE"),
  deliverables:  z.string().max(3000).optional().nullable(),
  notes:         z.string().max(3000).optional().nullable(),
  ownerId:       z.string().min(1).optional().nullable(),
})

async function list(ctx: ApiContext, params?: Record<string,string>) {
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const items = await db.procurementItem.findMany({
    where:   { projectId },
    include: {
      owner:     { select:{ id:true, name:true, avatarUrl:true } },
      createdBy: { select:{ id:true, name:true } },
    },
    orderBy: { createdAt:"desc" },
  })
  return ok({ items: items.map(i=>({ ...i, value:i.value?Number(i.value):null })) })
}

async function create(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error

  const d = parsed.data
  const item = await db.procurementItem.create({
    data: {
      projectId, createdById: ctx.userId,
      vendorName:    d.vendorName,
      vendorContact: d.vendorContact || null,
      vendorEmail:   d.vendorEmail   || null,
      type:          d.type,
      title:         d.title,
      poNumber:      d.poNumber    || null,
      contractRef:   d.contractRef || null,
      value:         d.value       ?? null,
      currency:      d.currency,
      startDate:     d.startDate   ? new Date(d.startDate) : null,
      endDate:       d.endDate     ? new Date(d.endDate)   : null,
      status:        d.status,
      deliverables:  d.deliverables || null,
      notes:         d.notes        || null,
      ownerId:       d.ownerId      || null,
    },
    include: {
      owner:     { select:{ id:true, name:true, avatarUrl:true } },
      createdBy: { select:{ id:true, name:true } },
    },
  })
  return ok({ ...item, value:item.value?Number(item.value):null }, 201)
}

export async function GET(req: NextRequest, { params }: { params: { projectId:string } }) {
  return withWorkspace(req, list, params)
}
export async function POST(req: NextRequest, { params }: { params: { projectId:string } }) {
  return withWorkspace(req, create, params)
}
