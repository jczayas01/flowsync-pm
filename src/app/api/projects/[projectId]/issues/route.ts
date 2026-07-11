// src/app/api/projects/[projectId]/issues/route.ts
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  title:       z.string().min(1).max(300),
  description: z.string().max(3000).optional().nullable(),
  category:    z.string().max(100).optional().nullable(),
  priority:    z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).default("MEDIUM"),
  impact:      z.string().max(2000).optional().nullable(),
  ownerId:     z.string().min(1).optional().nullable(),
  dueDate:     z.string().datetime().optional().nullable(),
})

async function nextCode(projectId: string): Promise<string> {
  try {
    const all = await db.issue.findMany({
      where:  { projectId },
      select: { code: true },
    })
    if (!all.length) return "ISS-001"
    const nums = all
      .map(r => parseInt((r.code||"").replace(/^ISS-/, ""), 10))
      .filter(n => !isNaN(n))
    const max = nums.length ? Math.max(...nums) : 0
    return `ISS-${String(max + 1).padStart(3, "0")}`
  } catch { return "ISS-001" }
}

async function list(ctx: ApiContext, params?: Record<string,string>) {
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const issues = await db.issue.findMany({
    where:   { projectId },
    orderBy: { createdAt:"desc" },
    include: {
      owner:    { select:{ id:true, name:true, avatarUrl:true } },
      raisedBy: { select:{ id:true, name:true, avatarUrl:true } },
    },
  })
  return ok(issues)
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
  try {
    const issue = await db.issue.create({
      data: {
        projectId,
        code,
        raisedById: ctx.userId,
        title:       parsed.data.title,
        description: parsed.data.description ?? null,
        category:    parsed.data.category ?? null,
        priority:    parsed.data.priority as any,
        impact:      parsed.data.impact ?? null,
        ownerId:     parsed.data.ownerId ?? null,
        dueDate:     parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      },
      include: {
        owner:    { select:{ id:true, name:true, avatarUrl:true } },
        raisedBy: { select:{ id:true, name:true, avatarUrl:true } },
      },
    })
    await audit(ctx.workspaceId, ctx.userId, "issue.created", "project", projectId,
      undefined, { code, title:parsed.data.title })
    return ok(issue, 201)
  } catch(e:any) {
    console.error("[Issue create]", e?.message)
    return err(e?.message?.includes("Unique")?`Code ${code} already exists — please retry`:"Failed to create issue", 500)
  }
}

export async function GET(req: NextRequest, { params }: { params: { projectId:string } }) {
  return withWorkspace(req, list, params)
}
export async function POST(req: NextRequest, { params }: { params: { projectId:string } }) {
  return withWorkspace(req, create, params)
}
