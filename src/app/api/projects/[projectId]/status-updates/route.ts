// src/app/api/projects/[projectId]/status-updates/route.ts
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  type:            z.enum(["WEEKLY_STATUS","MONTHLY_STATUS","EXECUTIVE_BRIEF","MILESTONE"]).default("WEEKLY_STATUS"),
  health:          z.enum(["GREEN","YELLOW","RED","ON_HOLD"]).default("GREEN"),
  periodStart:     z.string().datetime(),
  periodEnd:       z.string().datetime(),
  percentComplete: z.number().int().min(0).max(100).optional(),
  summary:         z.string().min(1).max(5000),
  accomplishments: z.string().max(5000).optional().nullable(),
  nextSteps:       z.string().max(5000).optional().nullable(),
  risks:           z.string().max(5000).optional().nullable(),
  issues:          z.string().max(5000).optional().nullable(),
})

async function createStatusUpdate(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const { type, health, periodStart, periodEnd, percentComplete, summary, accomplishments, nextSteps, risks, issues } = parsed.data

  const statusUpdate = await db.statusUpdate.create({
    data: {
      projectId,
      type,
      health,
      periodStart: new Date(periodStart),
      periodEnd:   new Date(periodEnd),
      percentComplete,
      summary,
      accomplishments,
      nextSteps,
      risks,
      issues,
      createdById: ctx.userId,
      aiGenerated: false,
    },
  })

  // Also update the project's health field to match this latest status
  await db.project.update({
    where: { id: projectId },
    data:  { health, ...(percentComplete !== undefined && { percentComplete }) },
  })

  await audit(ctx.workspaceId, ctx.userId, "project.status_update_created", "project", projectId,
    undefined, { type, health, percentComplete })

  return ok(statusUpdate, 201)
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, createStatusUpdate, params)
}
