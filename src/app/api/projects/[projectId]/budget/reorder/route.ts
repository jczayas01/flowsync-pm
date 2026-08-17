// src/app/api/projects/[projectId]/budget/reorder/route.ts
// Persist a new manual order for the project's budget lines. The client
// sends the full ordered id list; we write sortOrder = index for every item
// that belongs to this project, in one transaction, so a partial failure can
// never leave the list half-reordered.
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({ ids: z.array(z.string()).min(1).max(1000) })

async function reorder(ctx: ApiContext, params?: Record<string, string>) {
  { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const access = await verifyProjectAccess(params!.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error

  // Only ids that really belong to this project get written — a stray id in
  // the payload can't re-sort another project's budget.
  const owned = await db.budgetItem.findMany({
    where: { projectId: params!.projectId }, select: { id: true },
  })
  const allowed = new Set(owned.map(o => o.id))
  const ids = parsed.data.ids.filter(id => allowed.has(id))
  if (!ids.length) return err("No matching items", 400)

  await db.$transaction(ids.map((id, i) =>
    db.budgetItem.update({ where: { id }, data: { sortOrder: i } as any })))
  return ok({ updated: ids.length })
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, reorder, params)
}
