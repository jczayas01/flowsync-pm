import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  deliverablesAccepted:  z.boolean().optional(),
  acceptanceDocSigned:   z.boolean().optional(),
  knowledgeTransferred:  z.boolean().optional(),
  documentationComplete: z.boolean().optional(),
  finalBudgetReported:   z.boolean().optional(),
  contractsClosed:       z.boolean().optional(),
  teamReleased:          z.boolean().optional(),
  performanceReviewed:   z.boolean().optional(),
  lessonsDocumented:     z.boolean().optional(),
  lessonsShared:         z.boolean().optional(),
  benefitsHandedOver:    z.boolean().optional(),
  finalReportComplete:   z.boolean().optional(),
  closureDate:           z.string().datetime().optional().nullable(),
  closureNotes:          z.string().max(3000).optional().nullable(),
})

async function getOrCreate(ctx: ApiContext, params?: Record<string,string>) {
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  let closure = await db.projectClosure.findUnique({ where: { projectId } })
  if (!closure) closure = await db.projectClosure.create({ data: { projectId, closedById: ctx.userId } })
  return ok(closure)
}

async function update(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const data: any = { ...parsed.data }
  if (data.closureDate !== undefined) data.closureDate = data.closureDate ? new Date(data.closureDate) : null
  data.closedById = ctx.userId
  const closure = await db.projectClosure.upsert({
    where:  { projectId },
    update: data,
    create: { projectId, closedById: ctx.userId, ...data },
  })
  return ok(closure)
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) { return withWorkspace(req, getOrCreate, params) }
export async function PATCH(req: NextRequest, { params }: { params: { projectId: string } }) { return withWorkspace(req, update, params) }
