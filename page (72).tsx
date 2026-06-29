// src/app/api/tasks/[taskId]/route.ts
// GET   /api/tasks/:id  — get task
// PATCH /api/tasks/:id  — update task (including % complete)

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  withWorkspace, ok, err, notFound, forbidden,
  parseBody, audit, verifyProjectAccess, ApiContext,
} from "@/lib/api"

const updateTaskSchema = z.object({
  title:          z.string().min(1).max(500).optional(),
  description:    z.string().max(5000).optional().nullable(),
  status:         z.enum(["BACKLOG","TODO","IN_PROGRESS","IN_REVIEW","DONE","CANCELLED"]).optional(),
  priority:       z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).optional(),
  startDate:      z.string().datetime().optional().nullable(),
  dueDate:        z.string().datetime().optional().nullable(),
  estimatedHours: z.number().min(0).optional().nullable(),
  actualHours:    z.number().min(0).optional().nullable(),
  storyPoints:    z.number().int().min(0).optional().nullable(),
  percentComplete:z.number().int().min(0).max(100).optional(),
  phaseId:        z.string().cuid().optional().nullable(),
  sprintId:       z.string().cuid().optional().nullable(),
  assigneeIds:    z.array(z.string().cuid()).optional(),
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

  const task = await db.task.findUnique({ where: { id } })
  if (!task) return notFound("Task")

  const access = await verifyProjectAccess(task.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return forbidden()

  const parsed = await parseBody(ctx.req, updateTaskSchema)
  if ("error" in parsed) return parsed.error

  const { assigneeIds, ...rest } = parsed.data

  const updated = await db.$transaction(async tx => {
    const t = await tx.task.update({
      where: { id },
      data: {
        ...rest,
        ...(rest.status === "DONE" && { completedAt: new Date(), percentComplete: 100 }),
        ...(rest.startDate !== undefined && { startDate: rest.startDate ? new Date(rest.startDate) : null }),
        ...(rest.dueDate   !== undefined && { dueDate:   rest.dueDate   ? new Date(rest.dueDate)   : null }),
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
          data: members.map(m => ({ taskId: id, projectMemberId: m.id })),
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
  return ok(updated)
}

export async function GET(req: NextRequest, { params }: { params: { taskId: string } }) {
  return withWorkspace(req, getTask, params)
}
export async function PATCH(req: NextRequest, { params }: { params: { taskId: string } }) {
  return withWorkspace(req, updateTask, params)
}
