import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  vision:             z.string().max(2000).optional().nullable(),
  objectives:         z.string().max(3000).optional().nullable(),
  values:             z.string().max(2000).optional().nullable(),
  norms:              z.string().max(2000).optional().nullable(),
  decisionMaking:     z.string().max(2000).optional().nullable(),
  conflictResolution: z.string().max(2000).optional().nullable(),
  communicationPlan:  z.string().max(2000).optional().nullable(),
  toolsAndProcesses:  z.string().max(2000).optional().nullable(),
})

async function get(ctx: ApiContext, params?: Record<string,string>) {
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const charter = await db.teamCharter.findUnique({ where:{ projectId:params!.projectId } })
  return ok({ charter })
}

async function upsert(ctx: ApiContext, params?: Record<string,string>) {
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const charter = await db.teamCharter.upsert({
    where:  { projectId:params!.projectId },
    create: { projectId:params!.projectId, createdById:ctx.userId, ...parsed.data },
    update: { ...parsed.data, updatedAt:new Date() },
  })
  return ok({ charter })
}

export const GET  = (req: NextRequest, { params }: any) => withWorkspace(req, get,    params)
export const POST = (req: NextRequest, { params }: any) => withWorkspace(req, upsert, params)
