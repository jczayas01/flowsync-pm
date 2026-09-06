// src/app/api/tasks/[taskId]/dependencies/route.ts
// POST /api/tasks/:taskId/dependencies — add a dependency

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { requirePermission } from "@/lib/rbac/guards"
import { z } from "zod"
import { db } from "@/lib/db"
import { wouldCycle } from "@/lib/cross-project-deps"
import {
  withWorkspace, ok, err, notFound, forbidden,
  parseBody, audit, verifyProjectAccess, ApiContext,
} from "@/lib/api"

const addDependencySchema = z.object({
  precedingTaskId: z.string().min(1),
  dependencyType:  z.enum(["FS","SS","FF","SF"]).default("FS"),
  lagDays:         z.number().int().default(0),
})

async function addDependency(ctx: ApiContext, params?: Record<string,string>) {
  const _g = await requirePermission(ctx as any, "tasks:edit_any"); if (_g) return _g
  const taskId = params?.taskId
  if (!taskId) return err("Task ID required")

  const task = await db.task.findUnique({ where: { id: taskId } })
  if (!task) return notFound("Task")

  const access = await verifyProjectAccess(task.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return forbidden()

  const parsed = await parseBody(ctx.req, addDependencySchema)
  if ("error" in parsed) return parsed.error
  const { precedingTaskId, dependencyType, lagDays } = parsed.data

  if (precedingTaskId === taskId) {
    return err("A task cannot depend on itself")
  }

  // Cross-project links are allowed — that is what makes a program a program.
  // The boundary that still matters is the workspace, plus the caller's own
  // access to the other project: a link must never become a way to learn that
  // a task exists in a project you cannot see.
  const precedingTask = await db.task.findUnique({
    where:  { id: precedingTaskId },
    select: { id: true, projectId: true, project: { select: { workspaceId: true } } },
  })
  if (!precedingTask || precedingTask.project.workspaceId !== ctx.workspaceId) {
    return err("Preceding task not found", 404)
  }
  const crossProject = precedingTask.projectId !== task.projectId
  if (crossProject) {
    const predAccess = await verifyProjectAccess(precedingTask.projectId, ctx.userId, ctx.workspaceId)
    if (!predAccess.ok) return forbidden()
  }

  // Cycle check. Inside one project a loop is visible in the Gantt; across
  // projects nobody sees it, and the critical path quietly returns 0 for every
  // task caught in it. Check the whole workspace graph before writing.
  const existing = await db.taskDependency.findMany({
    where:  { dependentTask: { project: { workspaceId: ctx.workspaceId } } },
    select: { id: true, dependentTaskId: true, precedingTaskId: true },
  })
  if (wouldCycle(existing, taskId, precedingTaskId)) {
    return err("That link would create a circular dependency", 409)
  }

  const dependency = await db.taskDependency.upsert({
    where: {
      dependentTaskId_precedingTaskId: {
        dependentTaskId: taskId,
        precedingTaskId,
      },
    },
    update: { dependencyType, lagDays },
    create: {
      dependentTaskId: taskId,
      precedingTaskId,
      dependencyType,
      lagDays,
    },
  })

  await audit(ctx.workspaceId, ctx.userId, "task.dependency_added", "task", taskId,
    undefined, { precedingTaskId, dependencyType, crossProject })

  return ok(dependency, 201)
}

export async function POST(req: NextRequest, { params }: { params: { taskId: string } }) {
  return withWorkspace(req, addDependency, params)
}
