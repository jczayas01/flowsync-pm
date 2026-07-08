import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  overview:          z.string().max(3000).optional().nullable(),
  operationsContact: z.string().max(500).optional().nullable(),
  systemsHandedOver: z.string().max(3000).optional().nullable(),
  documentation:     z.string().max(3000).optional().nullable(),
  trainingCompleted: z.string().max(2000).optional().nullable(),
  knownIssues:       z.string().max(3000).optional().nullable(),
  supportArrangements: z.string().max(2000).optional().nullable(),
  handoverDate:      z.string().optional().nullable(),
  acceptedById:      z.string().optional().nullable(),
  status:            z.enum(["DRAFT","PENDING_ACCEPTANCE","ACCEPTED"]).default("DRAFT"),
})

async function get(ctx: ApiContext, params?: Record<string,string>) {
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const plan = await db.transitionPlan.findUnique({ where:{ projectId:params!.projectId } })
  return ok({ plan })
}

async function upsert(ctx: ApiContext, params?: Record<string,string>) {
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const { handoverDate, ...rest } = parsed.data
  const plan = await db.transitionPlan.upsert({
    where:  { projectId:params!.projectId },
    create: { projectId:params!.projectId, createdById:ctx.userId,
              handoverDate:handoverDate?new Date(handoverDate):null, ...rest },
    update: { handoverDate:handoverDate?new Date(handoverDate):null, ...rest },
  })
  return ok({ plan })
}

export const GET  = (req: NextRequest, { params }: any) => withWorkspace(req, get,    params)
export const POST = (req: NextRequest, { params }: any) => withWorkspace(req, upsert, params)
