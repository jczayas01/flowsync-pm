// src/app/api/projects/[projectId]/change-requests/route.ts
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const createSchema = z.object({
  title:           z.string().min(1).max(200),
  description:     z.string().max(5000).optional().nullable(),
  priority:        z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).default("MEDIUM"),
  scheduleImpact:  z.string().max(500).optional().nullable(),
  budgetImpact:    z.number().optional().nullable(),
  scopeImpact:     z.string().max(2000).optional().nullable(),
  qualityImpact:   z.string().max(2000).optional().nullable(),
  justification:   z.string().max(3000).optional().nullable(),
  // category is in the UI but NOT in the DB model — accept and ignore
  category:        z.string().optional().nullable(),
})

async function nextCRCode(projectId: string): Promise<string> {
  try {
    const all = await db.changeRequest.findMany({
      where:  { projectId },
      select: { code: true },
    })
    if (!all.length) return "CR-001"
    const nums = all
      .map(r => parseInt((r.code||"").replace(/^CR-/, ""), 10))
      .filter(n => !isNaN(n))
    const max = nums.length ? Math.max(...nums) : 0
    return `CR-${String(max + 1).padStart(3, "0")}`
  } catch { return "CR-001" }
}

async function listChangeRequests(ctx: ApiContext, params?: Record<string,string>) {
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const crs = await db.changeRequest.findMany({
    where:   { projectId },
    orderBy: { createdAt:"desc" },
    include: {
      requestedBy: { select:{ id:true, name:true, avatarUrl:true } },
      approvedBy:  { select:{ id:true, name:true, avatarUrl:true } },
      _count:      { select:{ comments:true } },
    },
  })
  return ok(crs.map(cr => ({ ...cr, budgetImpact:cr.budgetImpact?Number(cr.budgetImpact):null })))
}

async function createChangeRequest(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "changes:create" as any); if (_g) return _g }
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, createSchema)
  if ("error" in parsed) return parsed.error
  const code = await nextCRCode(projectId)
  try {
    const cr = await db.changeRequest.create({
      data: {
        projectId,
        code,
        title:          parsed.data.title,
        description:    parsed.data.description ?? null,
        priority:       parsed.data.priority as any,
        scheduleImpact: parsed.data.scheduleImpact ?? null,
        budgetImpact:   parsed.data.budgetImpact ?? null,
        scopeImpact:    parsed.data.scopeImpact ?? null,
        qualityImpact:  parsed.data.qualityImpact ?? null,
        status:         "SUBMITTED",
        requestedById:  ctx.userId,
      },
      include: { requestedBy:{ select:{ id:true, name:true, avatarUrl:true } } },
    })
    await audit(ctx.workspaceId, ctx.userId, "change_request.created", "project", projectId,
      undefined, { code, title:parsed.data.title })
    return ok({ ...cr, budgetImpact:cr.budgetImpact?Number(cr.budgetImpact):null }, 201)
  } catch(e:any) {
    console.error("[CR create]", e?.message)
    return err(e?.message?.includes("Unique")?`Code ${code} already exists — please retry`:"Failed to create change request", 500)
  }
}

export async function GET(req: NextRequest, { params }: { params: { projectId:string } }) {
  return withWorkspace(req, listChangeRequests, params)
}
export async function POST(req: NextRequest, { params }: { params: { projectId:string } }) {
  return withWorkspace(req, createChangeRequest, params)
}
