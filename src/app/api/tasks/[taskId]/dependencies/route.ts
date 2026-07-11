// src/app/api/tasks/[taskId]/dependencies/route.ts
// POST /api/tasks/:taskId/dependencies — add a dependency

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { requirePermission } from "@/lib/rbac/guards"
import { z } from "zod"
import { db } from "@/lib/db"
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

  // Verify preceding task is in the same project
  const precedingTask = await db.task.findUnique({ where: { id: precedingTaskId } })
  if (!precedingTask || precedingTask.projectId !== task.projectId) {
    return err("Preceding task not found in this project", 404)
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
    undefined, { precedingTaskId, dependencyType })

  return ok(dependency, 201)
}

export async function POST(req: NextRequest, { params }: { params: { taskId: string } }) {
  return withWorkspace(req, addDependency, params)
}
