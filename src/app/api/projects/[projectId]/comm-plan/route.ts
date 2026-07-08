import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  stakeholderName:    z.string().min(1).max(200),
  role:               z.string().max(100).optional().nullable(),
  information:        z.string().min(1).max(500),
  format:             z.string().max(100).optional().nullable(),
  frequency:          z.string().max(100).optional().nullable(),
  method:             z.string().max(100).optional().nullable(),
  ownerId:            z.string().min(1).optional().nullable(),
  notes:              z.string().max(1000).optional().nullable(),
  engagementCurrent:  z.enum(["UNAWARE","RESISTANT","NEUTRAL","SUPPORTIVE","LEADING"]).optional().nullable(),
  engagementTarget:   z.enum(["UNAWARE","RESISTANT","NEUTRAL","SUPPORTIVE","LEADING"]).optional().nullable(),
  influence:          z.enum(["HIGH","MEDIUM","LOW"]).optional().nullable(),
  interest:           z.enum(["HIGH","MEDIUM","LOW"]).optional().nullable(),
})

async function list(ctx: ApiContext, params?: Record<string,string>) {
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const entries = await db.commPlanEntry.findMany({
    where: { projectId }, orderBy: { createdAt:"asc" },
    include: { owner: { select:{ id:true, name:true } } },
  })
  return ok(entries)
}

async function create(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const entry = await db.commPlanEntry.create({
    data: { projectId, ...parsed.data },
    include: { owner: { select:{ id:true, name:true } } },
  })
  return ok(entry, 201)
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) { return withWorkspace(req, list, params) }
export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) { return withWorkspace(req, create, params) }
