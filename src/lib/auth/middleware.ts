// src/lib/auth/middleware.ts
// Reusable API middleware — auth, workspace access, roles, rate limiting

import { auth } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/db/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { UserRole } from '@/types'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface AuthContext {
  userId: string
  workspaceId: string
  role: UserRole
  plan: string
  microsoftAccessToken?: string
}

export type ApiHandler = (
  req: NextRequest,
  ctx: AuthContext,
  params?: Record<string, string>
) => Promise<NextResponse>

// ─────────────────────────────────────────────
// ROLE HIERARCHY
// ─────────────────────────────────────────────

const ROLE_LEVELS: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  OWNER: 80,
  ADMIN: 60,
  PM: 40,
  MEMBER: 20,
  VIEWER: 10,
  CLIENT: 5,
}

export function hasRole(userRole: UserRole, required: UserRole): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[required]
}

// ─────────────────────────────────────────────
// PLAN LIMITS
// ─────────────────────────────────────────────

export const PLAN_LIMITS = {
  FREE:       { maxProjects: 3,   maxMembers: 1,  ai: false, m365: false },
  PRO:        { maxProjects: 999, maxMembers: 1,  ai: true,  m365: false },
  CONSULTANT: { maxProjects: 999, maxMembers: 5,  ai: true,  m365: true  },
  BUSINESS:   { maxProjects: 999, maxMembers: 10, ai: true,  m365: true  },
  ENTERPRISE: { maxProjects: 999, maxMembers: 999,ai: true,  m365: true  },
} as const

// ─────────────────────────────────────────────
// MAIN WRAPPER — withAuth
// ─────────────────────────────────────────────

/**
 * Wraps an API handler with auth + workspace verification.
 * Usage:
 *   export const GET = withAuth(async (req, ctx) => { ... })
 *   export const POST = withAuth(async (req, ctx) => { ... }, { role: 'PM' })
 */
export function withAuth(
  handler: ApiHandler,
  options: {
    role?: UserRole       // minimum role required
    requireM365?: boolean // requires Microsoft token
    requireAI?: boolean   // requires AI-enabled plan
  } = {}
) {
  return async (req: NextRequest, { params }: { params?: Record<string, string> } = {}) => {
    try {
      // ── 1. Session check ──
      const session = await auth()
      if (!session?.user?.id) {
        return err(401, 'UNAUTHORIZED', 'Authentication required')
      }

      const userId = session.user.id
      const workspaceId = session.user.activeWorkspaceId

      if (!workspaceId) {
        return err(400, 'NO_WORKSPACE', 'No active workspace selected')
      }

      // ── 2. Workspace membership ──
      const membership = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        include: { workspace: { select: { plan: true, isActive: true } } },
      })

      if (!membership || !membership.workspace.isActive) {
        return err(403, 'FORBIDDEN', 'Workspace access denied')
      }

      const role = membership.role as UserRole
      const plan = membership.workspace.plan

      // ── 3. Role check ──
      if (options.role && !hasRole(role, options.role)) {
        return err(403, 'INSUFFICIENT_ROLE', `Requires ${options.role} role or higher`)
      }

      // ── 4. Plan feature checks ──
      const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]
      if (options.requireAI && !limits.ai) {
        return err(402, 'PLAN_LIMIT', 'AI features require Pro plan or higher')
      }
      if (options.requireM365 && !limits.m365) {
        return err(402, 'PLAN_LIMIT', 'M365 integration requires Business plan or higher')
      }
      if (options.requireM365 && !session.microsoftAccessToken) {
        return err(401, 'NO_M365_TOKEN', 'Microsoft account not connected')
      }

      // ── 5. Build context ──
      const ctx: AuthContext = {
        userId,
        workspaceId,
        role,
        plan,
        microsoftAccessToken: session.microsoftAccessToken,
      }

      // ── 6. Rate limiting (simple — production use Upstash Redis) ──
      const rateKey = `${userId}:${req.method}:${new URL(req.url).pathname}`
      // In production: check Redis here
      // For now: rely on Vercel's edge rate limiting

      // ── 7. Call handler ──
      const response = await handler(req, ctx, params)

      // ── 8. Audit log for mutations ──
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '')) {
        await auditLog(ctx, req).catch(() => {}) // non-blocking
      }

      return response

    } catch (error) {
      console.error('[withAuth] Unhandled error:', error)
      return err(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
    }
  }
}

// ─────────────────────────────────────────────
// PROJECT ACCESS GUARD
// ─────────────────────────────────────────────

/**
 * Verify user has access to a specific project.
 * Returns the project or throws.
 */
export async function requireProjectAccess(
  projectId: string,
  ctx: AuthContext,
  minRole: UserRole = 'VIEWER'
) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId: ctx.workspaceId,
    },
    include: {
      members: {
        where: { userId: ctx.userId },
        select: { role: true },
      },
    },
  })

  if (!project) {
    throw apiError(404, 'PROJECT_NOT_FOUND', 'Project not found')
  }

  // Workspace admins and owners can see all projects
  if (hasRole(ctx.role, 'ADMIN')) return project

  // Otherwise check project membership
  const projectRole = project.members[0]?.role as UserRole | undefined
  if (!projectRole || !hasRole(projectRole, minRole)) {
    throw apiError(403, 'FORBIDDEN', 'You do not have access to this project')
  }

  return project
}

// ─────────────────────────────────────────────
// PLAN LIMIT CHECKS
// ─────────────────────────────────────────────

export async function checkProjectLimit(ctx: AuthContext) {
  const limits = PLAN_LIMITS[ctx.plan as keyof typeof PLAN_LIMITS]
  if (limits.maxProjects === 999) return // unlimited

  const count = await prisma.project.count({
    where: { workspaceId: ctx.workspaceId },
  })

  if (count >= limits.maxProjects) {
    throw apiError(
      402,
      'PLAN_LIMIT',
      `Your ${ctx.plan} plan allows a maximum of ${limits.maxProjects} projects. Upgrade to create more.`
    )
  }
}

export async function checkMemberLimit(ctx: AuthContext) {
  const limits = PLAN_LIMITS[ctx.plan as keyof typeof PLAN_LIMITS]
  if (limits.maxMembers === 999) return

  const count = await prisma.workspaceMember.count({
    where: { workspaceId: ctx.workspaceId },
  })

  if (count >= limits.maxMembers) {
    throw apiError(
      402,
      'PLAN_LIMIT',
      `Your ${ctx.plan} plan allows a maximum of ${limits.maxMembers} members. Upgrade to add more.`
    )
  }
}

// ─────────────────────────────────────────────
// RESPONSE HELPERS
// ─────────────────────────────────────────────

export function ok<T>(data: T, meta?: object, status = 200): NextResponse {
  return NextResponse.json({ data, ...(meta && { meta }) }, { status })
}

export function err(
  status: number,
  code: string,
  message: string,
  details?: object
): NextResponse {
  // `error` is a human-readable string (consistent with lib/api.ts `err`), so
  // components that render {error} won't receive an object. `code` is kept as a
  // sibling field for any machine-readable consumers.
  return NextResponse.json(
    { error: message, code, ...(details && { details }) },
    { status }
  )
}

export function apiError(status: number, code: string, message: string) {
  const e = new Error(message) as any
  e.status = status
  e.code = code
  return e
}

export function handleApiError(error: unknown): NextResponse {
  const e = error as any
  if (e?.status && e?.code) {
    return err(e.status, e.code, e.message)
  }
  console.error('[API Error]', error)
  return err(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
}

// ─────────────────────────────────────────────
// AUDIT LOGGING
// ─────────────────────────────────────────────

async function auditLog(ctx: AuthContext, req: NextRequest) {
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const entityType = pathParts[2] ?? 'unknown' // /api/[entity]/...
  const entityId = pathParts[3] ?? 'unknown'

  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: `${entityType}.${req.method?.toLowerCase()}`,
      entityType,
      entityId,
      ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    },
  })
}

// ─────────────────────────────────────────────
// VALIDATION HELPER
// ─────────────────────────────────────────────

export function validate<T>(
  data: unknown,
  schema: { safeParse: (d: unknown) => { success: boolean; data?: T; error?: any } }
): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const details: Record<string, string[]> = {}
    result.error.issues.forEach((issue: any) => {
      const path = issue.path.join('.')
      if (!details[path]) details[path] = []
      details[path].push(issue.message)
    })
    throw apiError(422, 'VALIDATION_ERROR', 'Validation failed')
  }
  return result.data!
}
