// src/app/api/projects/[projectId]/decisions/route.ts
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  title:        z.string().min(1).max(300),
  description:  z.string().max(3000).optional().nullable(),
  rationale:    z.string().max(3000).optional().nullable(),
  alternatives: z.string().max(3000).optional().nullable(),
  impact:       z.string().max(2000).optional().nullable(),
  madeAt:       z.string().optional().nullable(),
})

async function nextCode(projectId: string): Promise<string> {
  try {
    const all = await db.decision.findMany({
      where:  { projectId },
      select: { code: true },
    })
    if (!all.length) return "DEC-001"
    const nums = all
      .map(r => parseInt((r.code||"").replace(/^DEC-/, ""), 10))
      .filter(n => !isNaN(n))
    const max = nums.length ? Math.max(...nums) : 0
    return `DEC-${String(max + 1).padStart(3, "0")}`
  } catch { return "DEC-001" }
}

async function list(ctx: ApiContext, params?: Record<string,string>) {
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const decisions = await db.decision.findMany({
    where:   { projectId },
    orderBy: { madeAt:"desc" },
    include: { madeBy:{ select:{ id:true, name:true, avatarUrl:true } } },
  })
  return ok(decisions)
}

async function create(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const code = await nextCode(projectId)
  // Parse madeAt safely - accept date string or ISO string
  let madeAt: Date
  try {
    madeAt = parsed.data.madeAt ? new Date(parsed.data.madeAt) : new Date()
    if (isNaN(madeAt.getTime())) madeAt = new Date()
  } catch { madeAt = new Date() }
  try {
    const decision = await db.decision.create({
      data: {
        projectId,
        code,
        madeById:    ctx.userId,
        title:        parsed.data.title,
        description:  parsed.data.description  ?? null,
        rationale:    parsed.data.rationale    ?? null,
        alternatives: parsed.data.alternatives ?? null,
        impact:       parsed.data.impact       ?? null,
        madeAt,
      },
      include: { madeBy:{ select:{ id:true, name:true, avatarUrl:true } } },
    })
    await audit(ctx.workspaceId, ctx.userId, "decision.created", "project", projectId,
      undefined, { code, title:parsed.data.title })
    return ok(decision, 201)
  } catch(e:any) {
    console.error("[Decision create]", e?.message)
    return err(e?.message?.includes("Unique")?`Code ${code} already exists — please retry`:"Failed to save decision", 500)
  }
}

export async function GET(req: NextRequest, { params }: { params: { projectId:string } }) {
  return withWorkspace(req, list, params)
}
export async function POST(req: NextRequest, { params }: { params: { projectId:string } }) {
  return withWorkspace(req, create, params)
}
