// GET  /api/projects/:projectId/phases — phases with task counts + project settings (powers ⚙️)
// POST /api/projects/:projectId/phases — create a phase
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext,
} from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const createSchema = z.object({
  name:  z.string().min(1).max(120),
  color: z.string().max(20).optional().nullable(),
})

async function list(ctx: ApiContext, params?: Record<string, string>) {
  const { projectId } = params || {}
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const [phases, project, guard] = await Promise.all([
    db.phase.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
      include: { _count: { select: { tasks: true } } },
    }),
    db.project.findUnique({ where: { id: projectId }, select: { settings: true } }),
    requirePermission(ctx as any, "projects:edit" as any),
  ])
  return ok({ phases, settings: (project?.settings as any) || {}, canManage: !guard })
}

async function create(ctx: ApiContext, params?: Record<string, string>) {
  { const g = await requirePermission(ctx as any, "projects:edit" as any); if (g) return g }
  const { projectId } = params || {}
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const parsed = await parseBody(ctx.req, createSchema)
  if ("error" in parsed) return parsed.error

  const max = await db.phase.aggregate({ where: { projectId }, _max: { order: true } })
  const phase = await db.phase.create({
    data: {
      projectId,
      name: parsed.data.name.trim(),
      color: parsed.data.color || null,
      order: (max._max.order ?? 0) + 1,
    },
  })
  return ok({ id: phase.id }, 201)
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, list, params)
}
export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, create, params)
}
