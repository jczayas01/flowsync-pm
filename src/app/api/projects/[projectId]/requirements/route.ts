export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  code:        z.string().min(1).max(50),
  title:       z.string().min(1).max(300),
  description: z.string().max(3000).optional().nullable(),
  type:        z.enum(["FUNCTIONAL","NON_FUNCTIONAL","BUSINESS","TECHNICAL","REGULATORY","OTHER"]).default("FUNCTIONAL"),
  priority:    z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).default("MEDIUM"),
  status:      z.enum(["DRAFT","APPROVED","IMPLEMENTED","VERIFIED","REJECTED"]).default("DRAFT"),
  source:      z.string().max(200).optional().nullable(),
  acceptanceCriteria: z.string().max(2000).optional().nullable(),
  linkedTaskId: z.string().optional().nullable(),
})

async function list(ctx: ApiContext, params?: Record<string,string>) {
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const requirements = await db.requirement.findMany({
    where:   { projectId:params!.projectId },
    orderBy: { code:"asc" },
    include: { createdBy:{ select:{ id:true,name:true } } },
  })
  return ok({ requirements })
}

async function create(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const req2 = await db.requirement.create({
    data: { projectId:params!.projectId, createdById:ctx.userId, ...parsed.data },
    include: { createdBy:{ select:{ id:true,name:true } } },
  })
  return ok({ requirement:req2 }, 201)
}

export const GET  = (req: NextRequest, { params }: any) => withWorkspace(req, list,   params)
export const POST = (req: NextRequest, { params }: any) => withWorkspace(req, create, params)
