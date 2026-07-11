// POST /api/projects/:projectId/tasks/reorder
// Body: { updates: [{ id, sortOrder, parentId?, phaseId? }] }
// Used by Tasks tab and Gantt to persist move-up/move-down and indent/outdent

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { requirePermission } from "@/lib/rbac/guards"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"

const reorderSchema = z.object({
  updates: z.array(z.object({
    id:        z.string().min(1),
    sortOrder: z.number().int(),
    parentId:  z.string().min(1).optional().nullable(),
    phaseId:   z.string().min(1).optional().nullable(),
  })).min(1),
})

async function reorderTasks(ctx: ApiContext, params?: Record<string,string>) {
  const _g = await requirePermission(ctx as any, "tasks:edit_any"); if (_g) return _g
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const parsed = await parseBody(ctx.req, reorderSchema)
  if ("error" in parsed) return parsed.error

  await db.$transaction(
    parsed.data.updates.map(u =>
      db.task.update({
        where: { id: u.id },
        data:  {
          sortOrder: u.sortOrder,
          ...(u.parentId !== undefined && { parentId: u.parentId }),
          ...(u.phaseId  !== undefined && { phaseId:  u.phaseId  }),
        },
      })
    )
  )

  return ok({ updated: parsed.data.updates.length })
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, reorderTasks, params)
}
