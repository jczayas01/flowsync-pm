// src/app/api/projects/[projectId]/lessons/[lessonId]/route.ts
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const updateSchema = z.object({
  title:          z.string().min(1).max(300).optional(),
  category:       z.enum(["PLANNING","EXECUTION","STAKEHOLDER","RISK","COMMUNICATION","TEAM","TECHNICAL","PROCUREMENT","QUALITY","OTHER"]).optional(),
  phase:          z.string().max(100).optional().nullable(),
  situation:      z.string().min(1).max(5000).optional(),
  lesson:         z.string().min(1).max(5000).optional(),
  recommendation: z.string().min(1).max(5000).optional(),
  impact:         z.enum(["POSITIVE","NEGATIVE"]).optional().nullable(),
}).strict()

async function updateLesson(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, lessonId } = params || {}
  if (!projectId || !lessonId) return err("IDs required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const existing = await db.lessonLearned.findUnique({ where:{ id:lessonId } })
  if (!existing || existing.projectId !== projectId) return notFound("Lesson")

  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error

  const updated = await db.lessonLearned.update({
    where: { id: lessonId }, data: parsed.data,
    include: { createdBy: { select:{ id:true, name:true, avatarUrl:true } } },
  })

  return ok(updated)
}

async function deleteLesson(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, lessonId } = params || {}
  if (!projectId || !lessonId) return err("IDs required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const existing = await db.lessonLearned.findUnique({ where:{ id:lessonId } })
  if (!existing || existing.projectId !== projectId) return notFound("Lesson")

  await db.lessonLearned.delete({ where:{ id:lessonId } })

  await audit(ctx.workspaceId, ctx.userId, "lesson.deleted", "project", projectId, existing as any, undefined)

  return ok({ deleted: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId:string; lessonId:string } }) {
  return withWorkspace(req, updateLesson, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId:string; lessonId:string } }) {
  return withWorkspace(req, deleteLesson, params)
}
