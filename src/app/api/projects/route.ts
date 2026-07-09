// src/app/api/projects/route.ts
// GET /api/projects   — list workspace projects
// POST /api/projects  — create new project

import { requirePermission } from "@/lib/rbac/guards"
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { dispatchEvent } from '@/lib/automation/dispatch'
import {
  withAuth, ok, err, handleApiError,
  checkProjectLimit, requireProjectAccess,
  validate, type AuthContext
} from '@/lib/auth/middleware'
import type { Methodology, ProjectStatus, ProjectHealth } from '@/types'

// ─────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  methodology: z.enum(['WATERFALL', 'AGILE', 'SCRUM', 'HYBRID']),
  priority: z.enum(['CRITICAL','HIGH','MEDIUM','LOW']).optional().default('MEDIUM'),
  isConfidential: z.boolean().optional().default(false),
  economicImpact: z.string().max(3000).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  budgetTotal: z.number().min(0).optional().default(0),
  currency: z.string().length(3).optional().default('USD'),
  timezone: z.string().optional().default('America/New_York'),
  templateId: z.string().min(1).optional(),
  phaseNames: z.array(z.string().min(1)).optional(),
  teamMembers: z.array(z.object({
    userId: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: z.enum(['PM', 'MEMBER', 'VIEWER', 'CLIENT']).default('MEMBER'),
    projectRole: z.enum(['EXECUTIVE_SPONSOR','SPONSOR','STEERING_COMMITTEE','PMO_DIRECTOR','PMO','PROGRAM_MANAGER','PM','PRODUCT_OWNER','BUSINESS_ANALYST','TECH_LEAD','SCRUM_MASTER','TEAM_MEMBER','STAKEHOLDER','EXTERNAL_RESOURCE','CLIENT','AUDITOR']).optional(),
  })).optional().default([]),
})

const listProjectsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['DRAFT','ACTIVE','ON_HOLD','COMPLETED','CANCELLED','ARCHIVED']).optional(),
  methodology: z.enum(['WATERFALL','AGILE','SCRUM','HYBRID']).optional(),
  health: z.enum(['GREEN','AMBER','RED']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name','createdAt','updatedAt','endDate','percentComplete']).default('updatedAt'),
  sortDir: z.enum(['asc','desc']).default('desc'),
})

// ─────────────────────────────────────────────
// GET — List projects
// ─────────────────────────────────────────────

export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const sp = Object.fromEntries(new URL(req.url).searchParams)
    const query = validate(sp, listProjectsSchema)

    const where: any = {
      workspaceId: ctx.workspaceId,
      ...(query.status && { status: query.status }),
      ...(query.methodology && { methodology: query.methodology }),
      ...(query.health && { health: query.health }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { code: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    }

    // Non-admins only see projects they're members of
    if (!['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes((ctx as any).userRole || (ctx as any).role)) {
      where.members = { some: { userId: ctx.userId } }
    }

    // Confidential projects: only visible to members + admins
    // If user is not admin, exclude confidential projects they're not a member of
    if (!['OWNER', 'ADMIN', 'SUPER_ADMIN', 'PMO_DIRECTOR'].includes((ctx as any).userRole || (ctx as any).role)) {
      where.OR = [
        { isConfidential: false },
        { isConfidential: true, members: { some: { userId: ctx.userId } } },
      ]
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
        include: {
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
          members: {
            take: 6,
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
          _count: {
            select: {
              tasks: true,
              risks: { where: { status: 'OPEN' } },
              milestones: true,
            },
          },
        },
      }),
      prisma.project.count({ where }),
    ])

    return ok(projects, {
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
// POST — Create project
// ─────────────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const guard = await requirePermission(ctx as any, "projects:create")
    if (guard) return guard

    const body = await req.json()
    const data = validate(body, createProjectSchema)

    // Check plan limits
    await checkProjectLimit(ctx)

    // Generate sequential project code within workspace
    const lastProject = await prisma.project.findFirst({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    })
    const nextNum = lastProject
      ? parseInt(lastProject.code.replace('PRJ-', '')) + 1
      : 1
    const code = `PRJ-${String(nextNum).padStart(3, '0')}`

    // Load template if provided
    let templateData: any = null
    if (data.templateId) {
      const template = await prisma.template.findFirst({
        where: {
          id: data.templateId,
          OR: [
            { workspaceId: ctx.workspaceId },
            { workspaceId: null }, // system templates
          ],
        },
      })
      templateData = template?.templateData
    }

    // Create the project
    const project = await prisma.project.create({
      data: {
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        code,
        name: data.name,
        description: data.description,
        methodology: data.methodology as Methodology,
        priority: (data.priority || 'MEDIUM') as any,
        isConfidential: data.isConfidential || false,
        economicImpact: data.economicImpact || null,
        status: 'DRAFT',
        health: 'GREEN',
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        budgetTotal: data.budgetTotal,
        currency: data.currency,
        timezone: data.timezone,
        // Add creator as PM
        members: {
          create: {
            userId: ctx.userId,
            role: 'PM',
            allocation: 100,
          },
        },
      },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      },
    })

    // Seed from template if provided
    if (templateData) {
      await seedFromTemplate(project.id, data.methodology, templateData)
    } else {
      await seedDefaultStructure(project.id, data.methodology as Methodology, data.phaseNames)
    }

    // Invite additional team members
    if (data.teamMembers.length > 0) {
      await inviteTeamMembers(project.id, ctx.workspaceId, data.teamMembers)
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        action: 'project.created',
        entityType: 'Project',
        entityId: project.id,
        after: { code, name: data.name, methodology: data.methodology },
      },
    })

    // Fire automation rules + webhooks for project creation (non-blocking).
    dispatchEvent(ctx.workspaceId, "PROJECT_CREATED", {
      projectId: project.id, actorId: ctx.userId,
      title: `New project: ${project.name}`, link: `/projects/${project.id}`,
      data: { id: project.id, name: project.name, code: (project as any).code },
    }).catch(() => {})

    return ok(project, undefined, 201)

  } catch (error) {
    return handleApiError(error)
  }
}, { role: 'PM' })

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function seedDefaultStructure(projectId: string, methodology: Methodology, customPhases?: string[]) {
  const names = (customPhases && customPhases.length)
    ? customPhases
    : (methodology === 'WATERFALL'
        ? ['Initiation', 'Planning', 'Design', 'Execution', 'Monitoring & Control', 'Closure']
        : [])
  for (let i = 0; i < names.length; i++) {
    await prisma.phase.create({ data: { projectId, name: names[i], order: i + 1 } })
  }

  if (methodology === 'SCRUM') {
    // Create first sprint
    const now = new Date()
    const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    await prisma.sprint.create({
      data: {
        projectId,
        name: 'Sprint 1',
        status: 'PLANNING',
        startDate: now,
        endDate: twoWeeks,
      },
    })
  }
}

async function seedFromTemplate(projectId: string, methodology: string, templateData: any) {
  // Seed phases from template
  if (templateData.phases && methodology === 'WATERFALL') {
    for (let i = 0; i < templateData.phases.length; i++) {
      await prisma.phase.create({
        data: { projectId, name: templateData.phases[i], order: i + 1 },
      })
    }
  }
}

async function inviteTeamMembers(
  projectId: string,
  workspaceId: string,
  members: Array<{ userId?: string; email?: string; role: string; projectRole?: string }>
) {
  for (const member of members) {
    if (member.userId) {
      // Direct add if they're in the workspace
      const wsMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: member.userId } },
      })
      if (wsMember) {
        await prisma.projectMember.create({
          data: {
            projectId, userId: member.userId, role: member.role as any,
            ...(member.projectRole && { projectRole: member.projectRole as any }),
          },
        }).catch(() => {}) // ignore if already member
      }
    }
    // Email invitations handled via /api/workspace/invitations
  }
}
