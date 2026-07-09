// src/app/api/tasks/route.ts
// GET  /api/tasks  — list tasks (filtered)
// POST /api/tasks  — create task

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac/guards'
import {
  withWorkspace, ok, okList, err, serverError,
  parseBody, getSearchParams, audit, verifyProjectAccess, ApiContext,
} from '@/lib/api'

const createTaskSchema = z.object({
  projectId:      z.string().min(1),
  phaseId:        z.string().min(1).optional().nullable(),
  sprintId:       z.string().min(1).optional().nullable(),
  parentId:       z.string().min(1).optional().nullable(),
  title:          z.string().min(1).max(500),
  description:    z.string().max(5000).optional().nullable(),
  status:         z.enum(['BACKLOG','TODO','IN_PROGRESS','IN_REVIEW','DONE','CANCELLED']).default('TODO'),
  priority:       z.enum(['CRITICAL','HIGH','MEDIUM','LOW']).default('MEDIUM'),
  startDate:      z.string().datetime().optional().nullable(),
  dueDate:        z.string().datetime().optional().nullable(),
  estimatedHours: z.number().min(0).optional().nullable(),
  storyPoints:    z.number().int().min(0).optional().nullable(),
  assigneeIds:    z.array(z.string().min(1)).optional().default([]),
  dependencyIds:  z.array(z.string().min(1)).optional().default([]),
})

async function nextTaskCode(projectId: string): Promise<string> {
  const last = await db.task.findFirst({
    where:   { projectId },
    orderBy: { createdAt: 'desc' },
    select:  { code: true },
  })
  if (!last) return 'T-001'
  const num = parseInt(last.code.replace('T-', ''), 10) + 1
  return `T-${String(num).padStart(3, '0')}`
}

async function listTasks(ctx: ApiContext) {
  const { page, perPage, skip, take, q, url } = getSearchParams(ctx.req)
  const projectId = url.searchParams.get('projectId')
  const phaseId   = url.searchParams.get('phaseId')   || undefined
  const sprintId  = url.searchParams.get('sprintId')  || undefined
  const status    = url.searchParams.get('status')    || undefined
  const priority  = url.searchParams.get('priority')  || undefined
  const assigneeId= url.searchParams.get('assigneeId')|| undefined
  const overdue   = url.searchParams.get('overdue') === 'true'
  const myTasks   = url.searchParams.get('mine')    === 'true'

  if (!projectId) return err('projectId is required')

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return err('Not found', 404)

  const where: any = {
    projectId,
    parentId: null, // top-level only by default
    ...(phaseId    && { phaseId }),
    ...(sprintId   && { sprintId }),
    ...(status     && { status }),
    ...(priority   && { priority }),
    ...(myTasks    && { OR: [{ ownerId: ctx.userId }, { assignees: { some: { projectMember: { userId: ctx.userId } } } }] }),
    ...(assigneeId && { assignees: { some: { projectMember: { userId: assigneeId } } } }),
    ...(overdue    && { dueDate: { lt: new Date() }, status: { notIn: ['DONE','CANCELLED'] } }),
    ...(q && { title: { contains: q, mode: 'insensitive' } }),
  }

  const [tasks, total] = await Promise.all([
    db.task.findMany({
      where,
      skip,
      take,
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        owner:        { select: { id:true, name:true, avatarUrl:true } },
        assignees:    { include: { projectMember: { include: { user: { select: { id:true, name:true, avatarUrl:true } } } } } },
        phase:        { select: { id:true, name:true } },
        sprint:       { select: { id:true, name:true } },
        dependencies: true,
        _count:       { select: { subtasks:true, comments:true } },
      },
    }),
    db.task.count({ where }),
  ])

  return okList(tasks, total, page, perPage)
}

async function createTask(ctx: ApiContext) {
  const guard = await requirePermission(ctx as any, "tasks:create")
  if (guard) return guard

  const parsed = await parseBody(ctx.req, createTaskSchema)
  if ('error' in parsed) return parsed.error
  const { data } = parsed

  const access = await verifyProjectAccess(data.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return err('Project not found', 404)

  const code = await nextTaskCode(data.projectId)

  const task = await db.$transaction(async tx => {
    const t = await tx.task.create({
      data: {
        projectId:      data.projectId,
        phaseId:        data.phaseId,
        sprintId:       data.sprintId,
        parentId:       data.parentId,
        code,
        title:          data.title,
        description:    data.description,
        status:         data.status,
        priority:       data.priority,
        startDate:      data.startDate  ? new Date(data.startDate) : null,
        dueDate:        data.dueDate    ? new Date(data.dueDate)   : null,
        estimatedHours: data.estimatedHours,
        storyPoints:    data.storyPoints,
        ownerId:        ctx.userId,
      },
    })

    // Add assignees
    if (data.assigneeIds.length) {
      const members = await tx.projectMember.findMany({
        where: { projectId: data.projectId, userId: { in: data.assigneeIds } },
      })
      await tx.taskAssignee.createMany({
        data: members.map(m => ({ taskId: t.id, projectMemberId: m.id, userId: m.userId })),
        skipDuplicates: true,
      })
    }

    // Add dependencies
    if (data.dependencyIds.length) {
      await tx.taskDependency.createMany({
        data: data.dependencyIds.map(depId => ({
          dependentTaskId: t.id,
          precedingTaskId: depId,
          dependencyType:  'FS',
        })),
        skipDuplicates: true,
      })
    }

    return t
  })

  await audit(ctx.workspaceId, ctx.userId, 'task.created', 'task', task.id,
    undefined, { code, title: data.title, projectId: data.projectId })

  return ok(task, 201)
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, listTasks)
}
export async function POST(req: NextRequest) {
  return withWorkspace(req, createTask)
}
