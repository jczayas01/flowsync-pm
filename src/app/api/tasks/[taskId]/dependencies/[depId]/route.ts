// src/app/api/tasks/[taskId]/dependencies/[depId]/route.ts
// DELETE /api/tasks/:taskId/dependencies/:depId — remove a dependency

import { NextRequest } from "next/server"
import { requirePermission } from "@/lib/rbac/guards"
import { db } from "@/lib/db"
import {
  withWorkspace, ok, err, notFound, forbidden,
  audit, verifyProjectAccess, ApiContext,
} from "@/lib/api"

async function removeDependency(ctx: ApiContext, params?: Record<string,string>) {
  const _g = await requirePermission(ctx as any, "tasks:edit_any"); if (_g) return _g
  const { taskId, depId } = params || {}
  if (!taskId || !depId) return err("Task ID and dependency ID required")

  const task = await db.task.findUnique({ where: { id: taskId } })
  if (!task) return notFound("Task")

  const access = await verifyProjectAccess(task.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return forbidden()

  const dependency = await db.taskDependency.findUnique({ where: { id: depId } })
  if (!dependency || dependency.dependentTaskId !== taskId) {
    return notFound("Dependency")
  }

  await db.taskDependency.delete({ where: { id: depId } })

  await audit(ctx.workspaceId, ctx.userId, "task.dependency_removed", "task", taskId,
    dependency as any, undefined)

  return ok({ deleted: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { taskId: string; depId: string } }) {
  return withWorkspace(req, removeDependency, params)
}
