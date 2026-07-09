// src/app/api/projects/[projectId]/tasks/route.ts
// GET  /api/projects/:id/tasks  — list tasks (with Gantt mode)
// POST /api/projects/:id/tasks  — create task

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { dispatchEvent } from "@/lib/automation/dispatch"
import {
  withAuth, ok, handleApiError,
  requireProjectAccess, validate,
  type AuthContext
} from '@/lib/auth/middleware'

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  phaseId: z.string().min(1).optional().nullable(),
  sprintId: z.string().min(1).optional().nullable(),
  parentId: z.string().min(1).optional().nullable(),
  status: z.enum(['BACKLOG','TODO','IN_PROGRESS','IN_REVIEW','DONE','CANCELLED']).default('TODO'),
  priority: z.enum(['CRITICAL','HIGH','MEDIUM','LOW']).default('MEDIUM'),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedHours: z.number().min(0).optional(),
  storyPoints: z.number().min(0).max(100).optional(),
  assigneeIds: z.array(z.string().min(1)).optional().default([]),
  dependencies: z.array(z.object({
    precedingTaskId: z.string().min(1),
    dependencyType: z.enum(['FS','SS','FF','SF']).default('FS'),
    lagDays: z.number().int().default(0),
  })).optional().default([]),
})

const listTasksSchema = z.object({
  mode: z.enum(['list','gantt','board','sprint']).default('list'),
  phaseId: z.string().min(1).optional(),
  sprintId: z.string().min(1).optional(),
  status: z.string().optional(),
  assigneeId: z.string().min(1).optional(),
  priority: z.string().optional(),
  overdue: z.coerce.boolean().optional(),
  parentId: z.string().optional(), // 'null' for top-level only
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(200).default(50),
})

// ─────────────────────────────────────────────
// GET — List / Gantt tasks
// ─────────────────────────────────────────────

export const GET = withAuth(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const projectId = params?.projectId!
    await requireProjectAccess(projectId, ctx, 'VIEWER')

    const sp = Object.fromEntries(new URL(req.url).searchParams)
    const query = validate(sp, listTasksSchema)

    // Build where clause
    const where: any = { projectId }
    if (query.phaseId) where.phaseId = query.phaseId
    if (query.sprintId) where.sprintId = query.sprintId
    if (query.status) {
      where.status = query.status.includes(',')
        ? { in: query.status.split(',') }
        : query.status
    }
    if (query.priority) where.priority = query.priority
    if (query.parentId === 'null') where.parentId = null
    if (query.assigneeId) {
      where.assignees = { some: { projectMember: { userId: query.assigneeId } } }
    }
    if (query.overdue) {
      where.dueDate = { lt: new Date() }
      where.status = { notIn: ['DONE', 'CANCELLED'] }
    }

    // ── Gantt mode — returns all tasks structured for timeline rendering ──
    if (query.mode === 'gantt') {
      const [phases, tasks, milestones] = await Promise.all([
        prisma.phase.findMany({
          where: { projectId },
          orderBy: { order: 'asc' },
        }),
        prisma.task.findMany({
          where,
          orderBy: [{ phaseId: 'asc' }, { startDate: 'asc' }],
          include: {
            owner: { select: { id: true, name: true, avatarUrl: true } },
            assignees: {
              include: {
                projectMember: {
                  include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                },
              },
            },
            dependencies: true,
            dependents: true,
          },
        }),
        prisma.milestone.findMany({
          where: { projectId },
          orderBy: { dueDate: 'asc' },
        }),
      ])

      // Build Gantt rows — phases with nested tasks + milestones
      const ganttRows = buildGanttRows(phases, tasks, milestones)
      const criticalPath = computeCriticalPath(tasks)

      return ok({ phases, tasks, milestones, ganttRows, criticalPath })
    }

    // ── Board mode — grouped by status ──
    if (query.mode === 'board') {
      const tasks = await prisma.task.findMany({
        where: { ...where, parentId: null },
        orderBy: { createdAt: 'asc' },
        include: {
          owner: { select: { id: true, name: true, avatarUrl: true } },
          assignees: {
            include: {
              projectMember: {
                include: { user: { select: { id: true, name: true, avatarUrl: true } } },
              },
            },
          },
          _count: { select: { subtasks: true, comments: true } },
        },
      })

      const columns = {
        BACKLOG: tasks.filter(t => t.status === 'BACKLOG'),
        TODO: tasks.filter(t => t.status === 'TODO'),
        IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS'),
        IN_REVIEW: tasks.filter(t => t.status === 'IN_REVIEW'),
        DONE: tasks.filter(t => t.status === 'DONE'),
      }

      return ok(columns)
    }

    // ── Sprint mode — tasks in active sprint with burndown data ──
    if (query.mode === 'sprint') {
      const activeSprint = await prisma.sprint.findFirst({
        where: { projectId, status: 'ACTIVE' },
        include: {
          tasks: {
            include: {
              owner: { select: { id: true, name: true, avatarUrl: true } },
              assignees: {
                include: {
                  projectMember: {
                    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                  },
                },
              },
            },
          },
        },
      })

      if (!activeSprint) return ok({ sprint: null, tasks: [], burndown: [] })

      const burndown = await computeBurndown(activeSprint)
      return ok({ sprint: activeSprint, tasks: activeSprint.tasks, burndown })
    }

    // ── Default list mode ──
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
        include: {
          owner: { select: { id: true, name: true, avatarUrl: true } },
          assignees: {
            include: {
              projectMember: {
                include: { user: { select: { id: true, name: true, avatarUrl: true } } },
              },
            },
          },
          phase: { select: { id: true, name: true } },
          sprint: { select: { id: true, name: true } },
          _count: { select: { subtasks: true, comments: true } },
        },
      }),
      prisma.task.count({ where }),
    ])

    return ok(tasks, {
      total,
      page: query.page,
      perPage: query.perPage,
      totalPages: Math.ceil(total / query.perPage),
    })

  } catch (error) {
    return handleApiError(error)
  }
})

// ─────────────────────────────────────────────
// POST — Create task
// ─────────────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const projectId = params?.projectId!
    await requireProjectAccess(projectId, ctx, 'MEMBER')

    const body = await req.json()
    const data = validate(body, createTaskSchema)

    // Generate task code
    const lastTask = await prisma.task.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    })
    const nextNum = lastTask
      ? parseInt(lastTask.code.replace('T-', '')) + 1
      : 1
    const code = `T-${String(nextNum).padStart(3, '0')}`

    const task = await prisma.task.create({
      data: {
        projectId,
        code,
        title: data.title,
        description: data.description,
        phaseId: data.phaseId,
        sprintId: data.sprintId,
        parentId: data.parentId,
        status: data.status,
        priority: data.priority,
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        estimatedHours: data.estimatedHours,
        storyPoints: data.storyPoints,
        ownerId: ctx.userId,
      },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    // Add assignees
    if (data.assigneeIds.length > 0) {
      const projectMembers = await prisma.projectMember.findMany({
        where: { projectId, userId: { in: data.assigneeIds } },
      })
      for (const pm of projectMembers) {
        await prisma.taskAssignee.create({
          data: { taskId: task.id, projectMemberId: pm.id, userId: pm.userId },
        }).catch(() => {})
      }
    }

    // Add dependencies (validate no circular deps)
    for (const dep of data.dependencies) {
      const hasCycle = await detectCycle(task.id, dep.precedingTaskId)
      if (hasCycle) continue // skip circular deps silently

      await prisma.taskDependency.create({
        data: {
          dependentTaskId: task.id,
          precedingTaskId: dep.precedingTaskId,
          dependencyType: dep.dependencyType,
          lagDays: dep.lagDays,
        },
      }).catch(() => {})
    }

    // Update project percentComplete
    await updateProjectCompletion(projectId)

    dispatchEvent(ctx.workspaceId, "TASK_CREATED", {
      projectId, actorId: ctx.userId,
      title: `New task: ${task.title}`, link: `/projects/${projectId}`,
      data: { id: task.id, title: task.title },
    }).catch(() => {})

    return ok(task, undefined, 201)

  } catch (error) {
    return handleApiError(error)
  }
}, { role: 'MEMBER' })

// ─────────────────────────────────────────────
// GANTT ROW BUILDER
// ─────────────────────────────────────────────

function buildGanttRows(phases: any[], tasks: any[], milestones: any[]) {
  const rows: any[] = []

  for (const phase of phases) {
    const phaseTasks = tasks.filter(t => t.phaseId === phase.id)
    const phaseMilestones = milestones.filter(m => (m as any).phaseId === phase.id)

    // Compute phase date range from tasks
    const taskDates = phaseTasks
      .filter(t => t.startDate && t.dueDate)
      .map(t => ({ start: new Date(t.startDate), end: new Date(t.dueDate) }))

    const phaseStart = taskDates.length
      ? new Date(Math.min(...taskDates.map(d => d.start.getTime())))
      : phase.plannedStart
    const phaseEnd = taskDates.length
      ? new Date(Math.max(...taskDates.map(d => d.end.getTime())))
      : phase.plannedEnd

    // Phase % from tasks
    const phasePct = phaseTasks.length
      ? Math.round(phaseTasks.reduce((s, t) => s + t.percentComplete, 0) / phaseTasks.length)
      : phase.status === 'COMPLETED' ? 100 : 0

    rows.push({
      id: phase.id,
      type: 'phase',
      title: phase.name,
      startDate: phaseStart,
      endDate: phaseEnd,
      percentComplete: phasePct,
      status: phase.status,
      depth: 0,
    })

    for (const task of phaseTasks) {
      rows.push({
        id: task.id,
        type: 'task',
        title: task.title,
        code: task.code,
        startDate: task.startDate,
        endDate: task.dueDate,
        percentComplete: task.percentComplete,
        status: task.status,
        priority: task.priority,
        isCriticalPath: task.isCriticalPath,
        parentId: phase.id,
        depth: 1,
        assignees: task.assignees?.map((a: any) => a.projectMember?.user),
        dependencies: task.dependencies?.map((d: any) => d.precedingTaskId),
      })
    }

    for (const ms of phaseMilestones) {
      rows.push({
        id: ms.id,
        type: 'milestone',
        title: ms.name,
        startDate: ms.dueDate,
        endDate: ms.dueDate,
        status: ms.status,
        color: ms.color,
        parentId: phase.id,
        depth: 1,
      })
    }
  }

  // Tasks not assigned to any phase
  const unphased = tasks.filter(t => !t.phaseId)
  for (const task of unphased) {
    rows.push({
      id: task.id,
      type: 'task',
      title: task.title,
      code: task.code,
      startDate: task.startDate,
      endDate: task.dueDate,
      percentComplete: task.percentComplete,
      status: task.status,
      priority: task.priority,
      isCriticalPath: task.isCriticalPath,
      depth: 0,
    })
  }

  return rows
}

// ─────────────────────────────────────────────
// CRITICAL PATH (simplified — longest path)
// ─────────────────────────────────────────────

function computeCriticalPath(tasks: any[]): string[] {
  // Build dependency graph
  const graph: Record<string, string[]> = {}
  const durations: Record<string, number> = {}

  for (const task of tasks) {
    graph[task.id] = task.dependencies?.map((d: any) => d.precedingTaskId) ?? []
    const s = task.startDate ? new Date(task.startDate).getTime() : 0
    const e = task.dueDate ? new Date(task.dueDate).getTime() : 0
    durations[task.id] = Math.max(0, (e - s) / 86400000)
  }

  // Simple longest-path traversal
  const memo: Record<string, number> = {}
  function longestPath(id: string): number {
    if (memo[id] !== undefined) return memo[id]
    const preds = graph[id] ?? []
    const predMax = preds.length ? Math.max(...preds.map(longestPath)) : 0
    memo[id] = predMax + (durations[id] ?? 0)
    return memo[id]
  }

  const maxLen = Math.max(...tasks.map(t => longestPath(t.id)))
  const threshold = maxLen * 0.85 // tasks within 85% of critical path length

  return tasks
    .filter(t => longestPath(t.id) >= threshold)
    .map(t => t.id)
}

// ─────────────────────────────────────────────
// BURNDOWN CHART DATA (Scrum)
// ─────────────────────────────────────────────

async function computeBurndown(sprint: any) {
  const startDate = new Date(sprint.startDate)
  const endDate = new Date(sprint.endDate)
  const totalPoints = sprint.tasks.reduce((s: number, t: any) => s + (t.storyPoints ?? 0), 0)
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)

  const burndown: any[] = []
  for (let i = 0; i <= days; i++) {
    const date = new Date(startDate.getTime() + i * 86400000)
    const ideal = totalPoints - (totalPoints / days) * i

    // Count remaining points as of this date (simplified)
    const remaining = sprint.tasks
      .filter((t: any) => !t.completedAt || new Date(t.completedAt) > date)
      .reduce((s: number, t: any) => s + (t.storyPoints ?? 0), 0)

    burndown.push({
      date: date.toISOString().split('T')[0],
      ideal: Math.round(ideal),
      actual: i <= Math.ceil((Date.now() - startDate.getTime()) / 86400000) ? remaining : null,
    })
  }

  return burndown
}

// ─────────────────────────────────────────────
// CIRCULAR DEPENDENCY DETECTION
// ─────────────────────────────────────────────

async function detectCycle(taskId: string, precedingId: string): Promise<boolean> {
  // DFS to detect if adding taskId → precedingId creates a cycle
  const visited = new Set<string>()

  async function dfs(currentId: string): Promise<boolean> {
    if (currentId === taskId) return true  // found cycle
    if (visited.has(currentId)) return false
    visited.add(currentId)

    const deps = await prisma.taskDependency.findMany({
      where: { dependentTaskId: currentId },
      select: { precedingTaskId: true },
    })

    for (const dep of deps) {
      if (await dfs(dep.precedingTaskId)) return true
    }
    return false
  }

  return dfs(precedingId)
}

// ─────────────────────────────────────────────
// UPDATE PROJECT COMPLETION
// ─────────────────────────────────────────────

async function updateProjectCompletion(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId, status: { notIn: ['CANCELLED'] } },
    select: { percentComplete: true, estimatedHours: true },
  })

  if (tasks.length === 0) return

  // Weighted average by estimated hours
  const totalHours = tasks.reduce((s, t) => s + Number(t.estimatedHours ?? 1), 0)
  const weightedPct = tasks.reduce((s, t) => {
    const weight = Number(t.estimatedHours ?? 1) / totalHours
    return s + t.percentComplete * weight
  }, 0)

  await prisma.project.update({
    where: { id: projectId },
    data: { percentComplete: Math.round(weightedPct) },
  })
}
