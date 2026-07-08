import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  qualityStandards:  z.string().max(2000).optional().nullable(),
  qualityObjectives: z.string().max(2000).optional().nullable(),
  roles:             z.string().max(2000).optional().nullable(),
  processes:         z.string().max(3000).optional().nullable(),
  tools:             z.string().max(2000).optional().nullable(),
  metrics:           z.string().max(2000).optional().nullable(),
  audits:            z.string().max(2000).optional().nullable(),
  nonConformance:    z.string().max(2000).optional().nullable(),
})

async function get(ctx: ApiContext, params?: Record<string,string>) {
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const plan = await db.qualityManagementPlan.findUnique({ where:{ projectId:params!.projectId } })
  return ok({ plan })
}

async function upsert(ctx: ApiContext, params?: Record<string,string>) {
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const plan = await db.qualityManagementPlan.upsert({
    where:  { projectId:params!.projectId },
    create: { projectId:params!.projectId, createdById:ctx.userId, ...parsed.data },
    update: { ...parsed.data },
  })
  return ok({ plan })
}

export const GET  = (req: NextRequest, { params }: any) => withWorkspace(req, get,    params)
export const POST = (req: NextRequest, { params }: any) => withWorkspace(req, upsert, params)
