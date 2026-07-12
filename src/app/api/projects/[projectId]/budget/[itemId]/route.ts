// PATCH /api/projects/:id/budget/:itemId — update budget item
// DELETE /api/projects/:id/budget/:itemId — delete budget item
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

// Keep the project's top-line budget in sync with its line items
async function syncProjectBudget(projectId: string) {
  try {
    const agg = await db.budgetItem.aggregate({
      where: { projectId },
      _sum: { plannedCost: true, actualCost: true },
    })
    await db.project.update({
      where: { id: projectId },
      data: {
        budgetTotal: agg._sum.plannedCost ?? 0,
        budgetSpent: agg._sum.actualCost ?? 0,
      },
    })
  } catch { /* rollup is best-effort */ }
}


const schema = z.object({
  description:   z.string().min(1).max(300).optional(),
  category:      z.string().optional(),
  plannedAmount: z.number().min(0).optional(),
  actualAmount:  z.number().min(0).optional(),
  notes:         z.string().optional().nullable(),
})

async function update(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "budget:edit" as any); if (_g) return _g }
  const { projectId, itemId } = params || {}
  if (!projectId || !itemId) return err("IDs required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  try {
    const item = await db.budgetItem.update({
      where: { id: itemId },
      data: {
        ...(parsed.data.description   !== undefined && { name:parsed.data.description, description:parsed.data.description }),
        ...(parsed.data.category      !== undefined && { category:parsed.data.category as any }),
        ...(parsed.data.plannedAmount !== undefined && { plannedCost:parsed.data.plannedAmount }),
        ...(parsed.data.actualAmount  !== undefined && { actualCost:parsed.data.actualAmount }),
        ...(parsed.data.notes         !== undefined && { notes:parsed.data.notes }),
      },
    })
    await syncProjectBudget(params!.projectId)
    return ok({ ...item, plannedAmount:Number(item.plannedCost), actualAmount:Number(item.actualCost) })
  } catch(e:any) {
    return err(e?.message||"Failed to update budget item", 500)
  }
}

async function remove(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "budget:edit" as any); if (_g) return _g }
  const { projectId, itemId } = params || {}
  if (!projectId || !itemId) return err("IDs required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  try {
    await db.budgetItem.delete({ where:{ id:itemId } })
    await syncProjectBudget(params!.projectId)
    return ok({ deleted:true })
  } catch(e:any) {
    return err(e?.message||"Failed to delete budget item", 500)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId:string; itemId:string } }) {
  return withWorkspace(req, update, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId:string; itemId:string } }) {
  return withWorkspace(req, remove, params)
}
