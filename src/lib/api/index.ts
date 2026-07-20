// src/lib/api.ts
// Shared API utilities — used by all route handlers

import { trialLocked } from "@/lib/trial"
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { ZodError, z } from 'zod'
import type { UserRole } from '@prisma/client'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface ApiContext {
  userId:      string
  workspaceId: string
  userRole:    UserRole
  req:         NextRequest
}

export type ApiHandler<T = unknown> = (
  ctx: ApiContext,
  params?: Record<string, string>
) => Promise<NextResponse<T>>

// ─────────────────────────────────────────────
// RESPONSE HELPERS
// ─────────────────────────────────────────────

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status })
}

export function okList<T>(
  data: T[],
  total: number,
  page = 1,
  perPage = 50
): NextResponse {
  return NextResponse.json({
    data,
    meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
  })
}

export function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export function notFound(entity = 'Resource'): NextResponse {
  return err(`${entity} not found`, 404)
}

export function forbidden(): NextResponse {
  return err('You do not have permission to perform this action', 403)
}

export function unauthorized(): NextResponse {
  return err('Authentication required', 401)
}

export function serverError(e: unknown): NextResponse {
  console.error('[API Error]', e)
  const msg = e instanceof Error ? e.message : 'Internal server error'
  return err(msg, 500)
}

// ─────────────────────────────────────────────
// VALIDATE REQUEST BODY
// ─────────────────────────────────────────────

export async function parseBody<S extends z.ZodTypeAny>(
  req: NextRequest,
  schema: S
): Promise<{ data: z.output<S> } | { error: NextResponse }> {
  try {
    const raw = await req.json()
    const data = schema.parse(raw)
    return { data }
  } catch (e) {
    if (e instanceof ZodError) {
      const details = Object.fromEntries(
        e.errors.map(err => [err.path.join('.'), [err.message]])
      )
      return {
        error: NextResponse.json(
          { error: 'Validation failed', details },
          { status: 422 }
        ),
      }
    }
    return { error: err('Invalid request body', 400) }
  }
}

// ─────────────────────────────────────────────
// PARSE QUERY PARAMS
// ─────────────────────────────────────────────

export function getSearchParams(req: NextRequest) {
  const url  = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const per  = Math.min(100, parseInt(url.searchParams.get('per') || '50'))
  const q    = url.searchParams.get('q') || undefined
  const skip = (page - 1) * per

  return { page, perPage: per, q, skip, take: per, url }
}

// ─────────────────────────────────────────────
// WORKSPACE GUARD
// Gets workspace from header or session and validates membership
// ─────────────────────────────────────────────

export async function withWorkspace(
  req: NextRequest,
  handler: ApiHandler,
  params?: Record<string, string>,
  requiredRoles?: UserRole[]
): Promise<NextResponse> {
  try {
    // 1. Get authenticated session
    const session = await auth()
    if (!session?.user?.id) return unauthorized()

    // 2. Resolve workspace ID
    //    Priority: X-Workspace-Id header → query param → session default
    const url = new URL(req.url)
    const workspaceId =
      req.headers.get('x-workspace-id') ||
      url.searchParams.get('workspaceId') ||
      params?.workspaceId ||
      (session.user as any).activeWorkspaceId

    if (!workspaceId) {
      return err('No workspace specified', 400)
    }

    // 3. Verify membership
    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    })

    if (!membership) return forbidden()

    // 4. Check required roles if specified
    if (requiredRoles && !requiredRoles.includes(membership.role)) {
      return forbidden()
    }

    // 5. Call handler
    return handler(
      {
        userId:      session.user.id,
        workspaceId,
        userRole:    membership.role,
        req,
      },
      params
    )
  } catch (e) {
    return serverError(e)
  }
}

// ─────────────────────────────────────────────
// PROJECT ACCESS GUARD
// Verify user has access to a specific project
// ─────────────────────────────────────────────

export async function verifyProjectAccess(
  projectId: string,
  userId: string,
  workspaceId: string,
): Promise<{ ok: boolean; role?: UserRole; locked?: boolean }> {
  // First check workspace membership
  const wsm = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
  if (!wsm) return { ok: false }

  // Trial state rides along on every access check. Mutating routes reject when
  // locked (an expired, unsubscribed workspace is read-only); reads and exports
  // keep working — the legal terms promise data access. Billing/auth routes
  // don't pass through here, so subscribing is always possible.
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId }, select: { plan: true, trialEndsAt: true },
  })
  const locked = !!(ws && trialLocked(ws))

  // Workspace owners, admins, and PMO directors can access all projects
  // (matrix: projects:view_all + projects:edit for these roles).
  if (['OWNER', 'ADMIN', 'SUPER_ADMIN', 'PMO_DIRECTOR'].includes(wsm.role)) {
    return { ok: true, role: wsm.role, locked }
  }

  // Check project membership — creators, members, and (for PROGRAM_MANAGER)
  // projects inside a program they manage.
  const doors: any[] = [
    { createdById: userId },
    { members: { some: { userId } } },
  ]
  if (wsm.role === 'PROGRAM_MANAGER') doors.push({ program: { managerId: userId } })
  const project = await db.project.findFirst({
    where: {
      id:          projectId,
      workspaceId,
      OR: doors,
    },
    include: {
      members: { where: { userId }, select: { role: true } },
    },
  })

  if (!project) return { ok: false }

  const role = project.members[0]?.role || wsm.role
  return { ok: true, role, locked }
}

/**
 * Workspace-level write guard. Project-scoped routes get trial enforcement via
 * verifyProjectAccess, but creating projects, committing imports, and inviting
 * users are workspace-level — they never pass through that check, which is how
 * an expired workspace could still create projects (found in testing, Jul 2026).
 * Returns a 402 response to send back, or null when writes are allowed.
 */
export async function assertWorkspaceWritable(workspaceId: string): Promise<NextResponse | null> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId }, select: { plan: true, trialEndsAt: true },
  })
  if (ws && trialLocked(ws)) {
    return NextResponse.json(
      { error: "Your trial has ended — this workspace is read-only until you subscribe in Settings → Billing.", locked: true },
      { status: 402 })
  }
  return null
}

// ─────────────────────────────────────────────
// AUDIT LOG HELPER
// ─────────────────────────────────────────────

export async function audit(
  workspaceId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  before?: object,
  after?: object
) {
  await db.auditLog.create({
    data: {
      workspaceId,
      userId,
      action,
      entityType,
      entityId,
      before: before as any,
      after:  after  as any,
    },
  }).catch(e => console.warn('[Audit]', e))
}

// ─────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────

export function paginationMeta(
  total: number,
  page: number,
  perPage: number
) {
  return {
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
    hasNext:    page < Math.ceil(total / perPage),
    hasPrev:    page > 1,
  }
}
