// src/app/api/projects/[projectId]/baselines/route.ts
// GET  /api/projects/:projectId/baselines — list baselines
// POST /api/projects/:projectId/baselines — create a new baseline snapshot

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  withWorkspace, ok, err, notFound, forbidden,
  parseBody, audit, verifyProjectAccess, ApiContext,
} from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const createBaselineSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
})

async function listBaselines(ctx: ApiContext, params?: Record<string,string>) {
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const baselines = await db.baseline.findMany({
    where:   { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy:  { select:{ id:true, name:true, avatarUrl:true } },
      approvedBy: { select:{ id:true, name:true, avatarUrl:true } },
    },
  })

  // Serialize Decimal fields for client components
  const serialized = baselines.map(b => ({
    ...b,
    budgetTotal: b.budgetTotal ? Number(b.budgetTotal) : 0,
  }))

  return ok(serialized)
}

async function createBaseline(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const parsed = await parseBody(ctx.req, createBaselineSchema)
  if ("error" in parsed) return parsed.error
  const { name, description } = parsed.data

  // Snapshot current project state — schedule, budget, AND scope
  const project = await db.project.findUnique({
    where:  { id: projectId },
    select: {
      budgetTotal:true, startDate:true, endDate:true,
      scope:true, outOfScope:true, objective:true,
    },
  })
  if (!project) return notFound("Project")
  if (!project.startDate || !project.endDate) {
    return err("Project must have a start and end date to create a baseline")
  }

  // Snapshot all tasks with full schedule data
  const tasks = await db.task.findMany({
    where:  { projectId },
    select: {
      id:true, code:true, title:true, phaseId:true, parentId:true,
      startDate:true, dueDate:true, percentComplete:true, status:true,
      estimatedHours:true, sortOrder:true,
    },
  })

  const snapshotData = {
    capturedAt: new Date().toISOString(),
    tasks: tasks.map(t => ({
      id:              t.id,
      code:            t.code,
      title:           t.title,
      phaseId:         t.phaseId,
      parentId:        t.parentId,
      startDate:       t.startDate,
      dueDate:         t.dueDate,
      percentComplete: t.percentComplete,
      status:          t.status,
      estimatedHours:  t.estimatedHours ? Number(t.estimatedHours) : null,
      sortOrder:       t.sortOrder,
    })),
    budget: { total: Number(project.budgetTotal) },
    schedule: { startDate: project.startDate, endDate: project.endDate },
  }

  const baseline = await db.baseline.create({
    data: {
      projectId,
      name,
      description,
      snapshotData,
      // Scope baseline — frozen at time of save
      scopeSnapshot:      project.scope,
      outOfScopeSnapshot: project.outOfScope,
      objectiveSnapshot:  project.objective,
      budgetTotal: project.budgetTotal,
      startDate:   project.startDate,
      endDate:     project.endDate,
      createdById: ctx.userId,
      isApproved:  false, // requires explicit approval
    },
    include: {
      createdBy:  { select:{ id:true, name:true, avatarUrl:true } },
      approvedBy: { select:{ id:true, name:true, avatarUrl:true } },
    },
  })

  await audit(ctx.workspaceId, ctx.userId, "project.baseline_created", "project", projectId,
    undefined, { baselineId: baseline.id, name, taskCount: tasks.length })

  return ok({ ...baseline, budgetTotal: Number(baseline.budgetTotal) }, 201)
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, listBaselines, params)
}
export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, createBaseline, params)
}
