// src/app/api/projects/[projectId]/lessons/route.ts
// GET  — list lessons learned for a project
// POST — create a new lesson learned entry

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const createSchema = z.object({
  title:          z.string().min(1).max(300),
  category:       z.enum(["PLANNING","EXECUTION","STAKEHOLDER","RISK","COMMUNICATION","TEAM","TECHNICAL","PROCUREMENT","QUALITY","OTHER"]).default("OTHER"),
  phase:          z.string().max(100).optional().nullable(),
  situation:      z.string().min(1).max(5000),
  lesson:         z.string().min(1).max(5000),
  recommendation: z.string().min(1).max(5000),
  impact:         z.enum(["POSITIVE","NEGATIVE"]).optional().nullable(),
})

async function listLessons(ctx: ApiContext, params?: Record<string,string>) {
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const lessons = await db.lessonLearned.findMany({
    where:   { projectId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select:{ id:true, name:true, avatarUrl:true } } },
  })

  return ok(lessons)
}

async function createLesson(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const parsed = await parseBody(ctx.req, createSchema)
  if ("error" in parsed) return parsed.error

  const lesson = await db.lessonLearned.create({
    data: {
      projectId,
      createdById: ctx.userId,
      ...parsed.data,
    },
    include: { createdBy: { select:{ id:true, name:true, avatarUrl:true } } },
  })

  await audit(ctx.workspaceId, ctx.userId, "lesson.created", "project", projectId,
    undefined, { title: parsed.data.title, category: parsed.data.category })

  return ok(lesson, 201)
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, listLessons, params)
}
export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, createLesson, params)
}
