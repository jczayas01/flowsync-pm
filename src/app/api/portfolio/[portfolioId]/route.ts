// PATCH  /api/portfolio/:portfolioId — update a portfolio
// DELETE /api/portfolio/:portfolioId — delete it (refused while programs exist — cascade protection)
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { canDelete } from "@/lib/security/delete-permissions"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const updateSchema = z.object({
  name:        z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  color:       z.string().max(20).optional(),
  ownerId:     z.string().optional().nullable(),
})

async function load(ctx: ApiContext, portfolioId?: string) {
  if (!portfolioId) return { error: err("Portfolio ID required") }
  const portfolio = await db.portfolio.findFirst({
    where: { id: portfolioId, workspaceId: ctx.workspaceId },
    include: { _count: { select: { programs: true } } },
  })
  if (!portfolio) return { error: notFound("Portfolio") }
  return { portfolio }
}

async function updatePortfolio(ctx: ApiContext, params?: Record<string, string>) {
  const guard = await requirePermission(ctx as any, "programs:create")
  if (guard) return guard
  const { portfolio, error } = await load(ctx, params?.portfolioId)
  if (error) return error
  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error
  try {
    const updated = await db.portfolio.update({
      where: { id: portfolio!.id },
      data: {
        ...parsed.data,
        ownerId: parsed.data.ownerId === "" ? null : parsed.data.ownerId,
      },
    })
    return ok({ id: updated.id })
  } catch (e: any) {
    return err(e?.message || "Failed to update portfolio", 500)
  }
}

async function deletePortfolio(ctx: ApiContext, params?: Record<string, string>) {
  // Deletion roles are workspace-configurable (Settings → Roles → Deletion
  // permissions); defaults to workspace admins.
  if (!(await canDelete(ctx.workspaceId, ctx.userRole, 'portfolio'))) return err("Not allowed", 403)
  const { portfolio, error } = await load(ctx, params?.portfolioId)
  if (error) return error
  // Deleting a portfolio cascades to its programs in the DB — refuse instead, so nothing
  // is removed implicitly. The user empties it first (delete/move programs), then deletes.
  if ((portfolio as any)._count?.programs > 0) {
    return err("This portfolio still contains programs. Delete or move its programs first — then the portfolio can be removed.", 409)
  }
  try {
    await db.portfolio.delete({ where: { id: portfolio!.id } })
    return ok({ deleted: true })
  } catch (e: any) {
    return err(e?.message || "Failed to delete portfolio", 500)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { portfolioId: string } }) {
  return withWorkspace(req, updatePortfolio, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { portfolioId: string } }) {
  return withWorkspace(req, deletePortfolio, params)
}
