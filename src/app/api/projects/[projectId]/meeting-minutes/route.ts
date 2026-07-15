export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  title:       z.string().min(1).max(300),
  meetingDate: z.string(),
  meetingType: z.enum(["KICKOFF","STATUS","PHASE_GATE","RISK_REVIEW","STEERING","AD_HOC","SPRINT_PLANNING","RETROSPECTIVE","OTHER"]).default("STATUS"),
  attendees:   z.string().max(2000).optional().nullable(),
  agenda:      z.string().max(3000).optional().nullable(),
  discussion:  z.string().max(5000).optional().nullable(),
  decisions:   z.string().max(3000).optional().nullable(),
  actionItems: z.any().optional(),
  nextMeeting: z.string().optional().nullable(),
})

async function list(ctx: ApiContext, params?: Record<string,string>) {
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const minutes = await db.meetingMinutes.findMany({
    where:   { projectId:params!.projectId },
    orderBy: { meetingDate:"desc" },
    include: { createdBy:{ select:{ id:true,name:true,avatarUrl:true } } },
  })
  return ok({ minutes })
}

async function nextCode(projectId: string) {
  try {
    const all = await db.meetingMinutes.findMany({ where: { projectId }, select: { code: true } })
    const nums = all
      .map(r => parseInt((r.code || "").replace(/^MIN-/, ""), 10))
      .filter(n => !isNaN(n))
    const max = nums.length ? Math.max(...nums) : 0
    return `MIN-${String(max + 1).padStart(3, "0")}`
  } catch { return "MIN-001" }
}

async function create(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const { meetingDate, ...rest } = parsed.data
  const code = await nextCode(params!.projectId)
  const minutes = await db.meetingMinutes.create({
    data: { projectId:params!.projectId, createdById:ctx.userId, code,
            meetingDate:new Date(meetingDate), ...rest,
            attendees: (rest as any).attendees ?? [] },
    include: { createdBy:{ select:{ id:true,name:true,avatarUrl:true } } },
  })
  return ok({ minutes }, 201)
}

export const GET  = (req: NextRequest, { params }: any) => withWorkspace(req, list,   params)
export const POST = (req: NextRequest, { params }: any) => withWorkspace(req, create, params)
