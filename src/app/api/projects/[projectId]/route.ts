// src/app/api/projects/[projectId]/route.ts
// GET    /api/projects/:id  — get single project
// PATCH  /api/projects/:id  — update project
// DELETE /api/projects/:id  — delete project

export const dynamic = "force-dynamic"

import { requirePermission } from "@/lib/rbac/guards"
import { mapDbRoleToRbac, ROLE_LEVEL } from "@/lib/rbac/roles"
import { canDelete } from "@/lib/security/delete-permissions"
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib//db'
import { dispatchEvent } from "@/lib/automation/dispatch"
import {
  withWorkspace, ok, err, notFound, forbidden, serverError,
  parseBody, audit, verifyProjectAccess, ApiContext,
} from '@/lib//api'

const updateSchema = z.object({
  name:            z.string().min(1).max(200).optional(),
  description:     z.string().max(2000).optional().nullable(),
  objective:       z.string().max(3000).optional().nullable(),
  scope:           z.string().max(3000).optional().nullable(),
  outOfScope:      z.string().max(3000).optional().nullable(),
  background:      z.string().max(3000).optional().nullable(),
  assumptions:     z.string().max(3000).optional().nullable(),
  constraints:     z.string().max(3000).optional().nullable(),
  economicImpact:  z.string().max(3000).optional().nullable(),
  priority:        z.enum(['CRITICAL','HIGH','MEDIUM','LOW']).optional(),
  isConfidential:  z.boolean().optional(),
  status:          z.enum(['DRAFT','ACTIVE','ON_HOLD','COMPLETED','CANCELLED','ARCHIVED']).optional(),
  health:          z.enum(['GREEN','AMBER','RED']).optional(),
  startDate:       z.string().datetime().optional().nullable(),
  endDate:         z.string().datetime().optional().nullable(),
  budgetTotal:     z.number().min(0).optional(),
  percentComplete: z.number().min(0).max(100).optional(),
  portfolioId:     z.string().min(1).optional().nullable(),
  programId:       z.string().min(1).optional().nullable(),
  methodology:     z.enum(['WATERFALL','AGILE','SCRUM','HYBRID']).optional(),
  settings:        z.record(z.any()).optional(),
})

async function getProject(ctx: ApiContext, params?: Record<string,string>) {
  const id = params?.projectId
  if (!id) return err('Project ID required')

  const access = await verifyProjectAccess(id, ctx.userId, ctx.workspaceId)
  if (!access.ok) return forbidden()

  const project = await db.project.findUnique({
    where: { id },
    include: {
      createdBy:    { select: { id:true, name:true, avatarUrl:true } },
      members:      { include: { user: { select: { id:true, name:true, avatarUrl:true, email:true } } }, orderBy: { joinedAt: 'asc' } },
      phases:       { orderBy: { order: 'asc' }, include: { _count: { select: { tasks:true } } } },
      milestones:   { orderBy: { dueDate: 'asc' } },
      sprints:      { orderBy: { startDate: 'asc' } },
      baselines:    { orderBy: { createdAt: 'desc' }, take: 1 },
      tags:         true,
      _count:       { select: { tasks:true, risks:true, milestones:true, changes:true } },
    },
  })

  if (!project) return notFound('Project')
  return ok(project)
}

async function updateProject(ctx: ApiContext, params?: Record<string,string>) {
  const guard = await requirePermission(ctx as any, "projects:edit")
  if (guard) return guard
  const id = params?.projectId
  if (!id) return err('Project ID required')

  const access = await verifyProjectAccess(id, ctx.userId, ctx.workspaceId)
  if (!access.ok) return forbidden()
  // access.role is the workspace role for admin-like users, otherwise the
  // PROJECT role (PM, SPONSOR, TEAM_MEMBER…). Edit: workspace admins + PMO
  // director + program managers + the project's PM.
  if (!['SUPER_ADMIN','OWNER','ADMIN','PMO_DIRECTOR','PROGRAM_MANAGER','PM'].includes(access.role!)) return forbidden()

  const parsed = await parseBody(ctx.req, updateSchema)
  if ('error' in parsed) return parsed.error

  const before = await db.project.findUnique({ where: { id } })

  // Status transitions are governance: only PMO Director and above may change
  // status directly. (Draft → Active goes through the approval workflow.)
  if (parsed.data.status !== undefined && parsed.data.status !== before?.status) {
    const level = ROLE_LEVEL[mapDbRoleToRbac(ctx.userRole as any)] ?? 0
    if (level < 68) {
      return err("Only PMO and above can change the project status", 403)
    }
  }

  const updated = await db.project.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.startDate !== undefined && { startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null }),
      ...(parsed.data.endDate   !== undefined && { endDate:   parsed.data.endDate   ? new Date(parsed.data.endDate)   : null }),
      ...(parsed.data.settings !== undefined && {
        settings: { ...(((before as any)?.settings as any) || {}), ...parsed.data.settings },
      }),
    },
  })

  await audit(ctx.workspaceId, ctx.userId, 'project.updated', 'project', id, before as any, updated as any)
  dispatchEvent(ctx.workspaceId, "PROJECT_UPDATED", {
    projectId: id, actorId: ctx.userId,
    title: `Project updated: ${updated.name}`, link: `/projects/${id}`,
    data: { id, name: updated.name },
  }).catch(() => {})
  if (parsed.data.health === "RED" && (before as any)?.health !== "RED") {
    dispatchEvent(ctx.workspaceId, "PROJECT_HEALTH_RED", {
      projectId: id, actorId: ctx.userId,
      title: `Project health went RED: ${updated.name}`, link: `/projects/${id}`,
      data: { id, name: updated.name },
    }).catch(() => {})
  }

  return ok(updated)
}

async function deleteProject(ctx: ApiContext, params?: Record<string,string>) {
  const id = params?.projectId
  if (!id) return err('Project ID required')

  const access = await verifyProjectAccess(id, ctx.userId, ctx.workspaceId)
  if (!access.ok) return forbidden()

  // Deletion roles are workspace-configurable (Settings → Roles → Deletion
  // permissions). Checked against the WORKSPACE role, not the project role.
  if (!(await canDelete(ctx.workspaceId, ctx.userRole, 'project'))) return forbidden()

  const project = await db.project.findFirst({
    where: { id, workspaceId: ctx.workspaceId }, select: { status: true },
  })
  if (!project) return notFound('Project')

  // Two-step destruction: archive first (default), then ?permanent=1 hard-
  // deletes an ARCHIVED project — no way to vaporize live work in one click.
  const permanent = new URL(ctx.req.url).searchParams.get('permanent') === '1'
  if (permanent) {
    if (project.status !== 'ARCHIVED')
      return err('Archive the project first, then delete permanently.', 409)
    await db.project.delete({ where: { id } })  // children cascade per schema
    await audit(ctx.workspaceId, ctx.userId, 'project.deleted', 'project', id)
    return ok({ deleted: true })
  }

  await db.project.update({ where: { id }, data: { status: 'ARCHIVED' } })
  await audit(ctx.workspaceId, ctx.userId, 'project.archived', 'project', id)
  return ok({ success: true, archived: true })
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, getProject, params)
}
export async function PATCH(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, updateProject, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId: string } }) {
  // Role gate lives inside deleteProject (configurable) — no static list here.
  return withWorkspace(req, deleteProject, params)
}
