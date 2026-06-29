// src/app/api/projects/[projectId]/route.ts
// GET    /api/projects/:id  — get single project
// PATCH  /api/projects/:id  — update project
// DELETE /api/projects/:id  — delete project

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  withWorkspace, ok, err, notFound, forbidden, serverError,
  parseBody, audit, verifyProjectAccess, ApiContext,
} from '@/lib/api'

const updateSchema = z.object({
  name:            z.string().min(1).max(200).optional(),
  description:     z.string().max(2000).optional().nullable(),
  status:          z.enum(['DRAFT','ACTIVE','ON_HOLD','COMPLETED','CANCELLED','ARCHIVED']).optional(),
  health:          z.enum(['GREEN','AMBER','RED']).optional(),
  startDate:       z.string().datetime().optional().nullable(),
  endDate:         z.string().datetime().optional().nullable(),
  budgetTotal:     z.number().min(0).optional(),
  percentComplete: z.number().min(0).max(100).optional(),
}).strict()

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
  const id = params?.projectId
  if (!id) return err('Project ID required')

  const access = await verifyProjectAccess(id, ctx.userId, ctx.workspaceId)
  if (!access.ok) return forbidden()
  if (!['OWNER','ADMIN','PM'].includes(access.role!)) return forbidden()

  const parsed = await parseBody(ctx.req, updateSchema)
  if ('error' in parsed) return parsed.error

  const before = await db.project.findUnique({ where: { id } })

  const updated = await db.project.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.startDate !== undefined && { startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null }),
      ...(parsed.data.endDate   !== undefined && { endDate:   parsed.data.endDate   ? new Date(parsed.data.endDate)   : null }),
    },
  })

  await audit(ctx.workspaceId, ctx.userId, 'project.updated', 'project', id, before as any, updated as any)
  return ok(updated)
}

async function deleteProject(ctx: ApiContext, params?: Record<string,string>) {
  const id = params?.projectId
  if (!id) return err('Project ID required')

  const access = await verifyProjectAccess(id, ctx.userId, ctx.workspaceId)
  if (!access.ok) return forbidden()
  if (!['OWNER','ADMIN'].includes(access.role!)) return forbidden()

  await db.project.update({ where: { id }, data: { status: 'ARCHIVED' } })
  await audit(ctx.workspaceId, ctx.userId, 'project.archived', 'project', id)
  return ok({ success: true })
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, getProject, params)
}
export async function PATCH(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, updateProject, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, deleteProject, params, ['OWNER','ADMIN'])
}
