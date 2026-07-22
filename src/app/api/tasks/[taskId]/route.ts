// src/app/api/tasks/[taskId]/route.ts
// GET   /api/tasks/:id  — get task
// PATCH /api/tasks/:id  — update task (including % complete)

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { fireTrigger } from "@/lib/automation/trigger"
import { dispatchEvent } from "@/lib/automation/dispatch"
import {
  withWorkspace, ok, err, notFound, forbidden,
  parseBody, audit, verifyProjectAccess, ApiContext,
} from "@/lib/api"
import { requirePermission, mapDbRoleToRbac } from "@/lib/rbac/guards"
import { can } from "@/lib/rbac/roles"
import { notifyMany } from "@/lib/notify"

const updateTaskSchema = z.object({
  title:          z.string().min(1).max(500).optional(),
  description:    z.string().max(5000).optional().nullable(),
  status:         z.enum(["BACKLOG","TODO","IN_PROGRESS","IN_REVIEW","DONE","CANCELLED"]).optional(),
  priority:       z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).optional(),
  startDate:      z.string().datetime().optional().nullable(),
  dueDate:        z.string().datetime().optional().nullable(),
  completedAt:    z.string().datetime().optional().nullable(),
  estimatedHours: z.number().min(0).optional().nullable(),
  actualHours:    z.number().min(0).optional().nullable(),
  storyPoints:    z.number().int().min(0).optional().nullable(),
  percentComplete:z.number().int().min(0).max(100).optional(),
  phaseId:        z.string().min(1).optional().nullable(),
  sprintId:       z.string().min(1).optional().nullable(),
  parentId:       z.string().min(1).optional().nullable(),
  sortOrder:      z.number().int().optional(),
  isCriticalPath: z.boolean().optional(),
  isMilestone:    z.boolean().optional(),
  assigneeIds:    z.array(z.string().min(1)).optional(),
}).strict()

async function getTask(ctx: ApiContext, params?: Record<string,string>) {
  const task = await db.task.findUnique({
    where: { id: params?.taskId },
    include: {
      owner:        { select: { id:true, name:true, avatarUrl:true } },
      assignees:    { include: { projectMember: { include: { user: { select: { id:true, name:true, avatarUrl:true } } } } } },
      subtasks:     { orderBy: { createdAt: "asc" } },
      dependencies: { include: { precedingTask: { select: { id:true, code:true, title:true, status:true } } } },
      comments:     { orderBy: { createdAt: "desc" }, take: 20, include: { author: { select: { id:true, name:true, avatarUrl:true } } } },
      timeEntries:  { orderBy: { date: "desc" }, take: 10 },
      phase:        true,
      sprint:       true,
    },
  })
  if (!task) return notFound("Task")

  const access = await verifyProjectAccess(task.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return forbidden()

  return ok(task)
}

async function updateTask(ctx: ApiContext, params?: Record<string,string>) {
  const id = params?.taskId
  if (!id) return err("Task ID required")

  const task = await db.task.findUnique({
    where: { id },
    include: { assignees: { where: { userId: ctx.userId }, select: { id: true } } },
  })
  if (!task) return notFound("Task")

  const role = mapDbRoleToRbac(ctx.userRole as any)
  const isAssignee = task.assignees.length > 0
  // Allow: broad editors, or the person assigned to this task (their own work)
  if (!can(role, "tasks:edit_any") && !can(role, "tasks:edit_assigned") && !isAssignee) {
    return forbidden()
  }

  const access = await verifyProjectAccess(task.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return forbidden()

  const parsed = await parseBody(ctx.req, updateTaskSchema)
  if ("error" in parsed) return parsed.error

  const { assigneeIds, ...rest } = parsed.data

  let prevAssignees: string[] = []
  if (assigneeIds !== undefined) {
    const existing = await db.taskAssignee.findMany({ where: { taskId: id }, select: { userId: true } })
    prevAssignees = existing.map(a => a.userId)
  }

  const updated = await db.$transaction(async tx => {
    const t = await tx.task.update({
      where: { id },
      data: {
        ...rest,
        // Auto-set completedAt to now only if status changed to DONE and user didn't already provide one
        ...(rest.status === "DONE" && rest.completedAt === undefined && { completedAt: new Date(), percentComplete: 100 }),
        ...(rest.status === "DONE" && rest.completedAt !== undefined && { percentComplete: 100 }),
        ...(rest.startDate   !== undefined && { startDate:   rest.startDate   ? new Date(rest.startDate)   : null }),
        ...(rest.dueDate     !== undefined && { dueDate:     rest.dueDate     ? new Date(rest.dueDate)     : null }),
        ...(rest.completedAt !== undefined && { completedAt: rest.completedAt ? new Date(rest.completedAt) : null }),
      },
    })

    // Update assignees if provided
    if (assigneeIds !== undefined) {
      await tx.taskAssignee.deleteMany({ where: { taskId: id } })
      if (assigneeIds.length) {
        const members = await tx.projectMember.findMany({
          where: { projectId: task.projectId, userId: { in: assigneeIds } },
        })
        await tx.taskAssignee.createMany({
          data: members.map(m => ({
            taskId: id,
            userId: m.userId,        // ← was missing, required field
            projectMemberId: m.id,
          })),
          skipDuplicates: true,
        })
      }
    }

    // Auto-update project percent complete
    const allTasks = await tx.task.findMany({
      where:  { projectId: task.projectId, parentId: null, status: { notIn: ["CANCELLED"] } },
      select: { percentComplete: true, estimatedHours: true },
    })
    if (allTasks.length) {
      const totalWeight = allTasks.reduce((s, t) => s + (Number(t.estimatedHours) || 1), 0)
      const weighted    = allTasks.reduce((s, t) => s + t.percentComplete * (Number(t.estimatedHours) || 1), 0)
      const pct         = Math.round(weighted / totalWeight)
      await tx.project.update({ where: { id: task.projectId }, data: { percentComplete: pct } })
    }

    return t
  })

  await audit(ctx.workspaceId, ctx.userId, "task.updated", "task", id, task as any, updated as any)

  // Fire automations for status changes (and completion).
  if (rest.status !== undefined && rest.status !== task.status) {
    fireTrigger("task.status_changed", ctx.workspaceId, task.projectId, "task", id, ctx.userId,
      { from: task.status, to: rest.status })
    if (rest.status === "DONE")
      fireTrigger("task.completed", ctx.workspaceId, task.projectId, "task", id, ctx.userId, {})
  }

  // Notify newly-assigned users
  if (assigneeIds !== undefined) {
    const added = assigneeIds.filter((uid: string) => !prevAssignees.includes(uid))
    if (added.length) {
      await notifyMany(added, {
        workspaceId: ctx.workspaceId,
        actorId: ctx.userId,
        type: "TASK_ASSIGNED",
        title: `You were assigned to "${(updated as any).title}"`,
        link: `/my-tasks`,
      })
    }
  }
  // Fire automation rules + webhooks when a task's status changes (non-blocking).
  if (rest.status !== undefined) {
    dispatchEvent(ctx.workspaceId, "TASK_STATUS_CHANGED", {
      projectId: task.projectId, actorId: ctx.userId,
      title: `Task status → ${rest.status}`, link: `/projects/${task.projectId}`,
      data: { taskId: id, status: rest.status },
    }).catch(() => {})
  }

  return ok(updated)
}

export async function GET(req: NextRequest, { params }: { params: { taskId: string } }) {
  return withWorkspace(req, getTask, params)
}
export async function PATCH(req: NextRequest, { params }: { params: { taskId: string } }) {
  return withWorkspace(req, updateTask, params)
}

async function deleteTask(ctx: ApiContext, params?: Record<string,string>) {
  const id = params?.taskId
  if (!id) return err("Task ID required")

  const guard = await requirePermission(ctx as any, "tasks:delete")
  if (guard) return guard

  const task = await db.task.findUnique({ where: { id } })
  if (!task) return notFound("Task")

  const access = await verifyProjectAccess(task.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return forbidden()

    if (access.locked) {
      return NextResponse.json(
        { error: "Your trial has ended — this workspace is read-only until you subscribe in Settings → Billing.", locked: true },
        { status: 402 })
    }
  await db.$transaction(async tx => {
    // Promote any subtasks up to this task's parent so they are not orphaned
    await tx.task.updateMany({ where: { parentId: id }, data: { parentId: task.parentId ?? null } })
    // Remove assignees and dependency links (both directions) before deleting
    await tx.taskAssignee.deleteMany({ where: { taskId: id } })
    await tx.taskDependency.deleteMany({ where: { OR: [{ dependentTaskId: id }, { precedingTaskId: id }] } })
    await tx.task.delete({ where: { id } })
  })

  await audit(ctx.workspaceId, ctx.userId, "task.deleted", "task", id, task as any)
  return ok({ deleted: true, id })
}
export async function DELETE(req: NextRequest, { params }: { params: { taskId: string } }) {
  return withWorkspace(req, deleteTask, params)
}
