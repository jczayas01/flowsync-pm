// POST /api/projects/:id/budget — create budget item
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  description:   z.string().min(1).max(300),
  category:      z.string().default("OTHER"),
  plannedAmount: z.number().min(0).default(0),
  recurrence:    z.enum(["MONTHLY"]).optional().nullable(),
  actualAmount:  z.number().min(0).default(0),
  notes:         z.string().optional().nullable(),
  earnRule: z.enum(["EFFORT","ZERO_HUNDRED","FIFTY_FIFTY","MILESTONE"]).optional(),
})


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

// GET — lightweight line list (id/name/planned) for pickers like
// Procurement's "Bill against budget line".
async function list(ctx: ApiContext, params?: Record<string,string>) {
  const projectId = params?.projectId
  if (!projectId) return notFound("Project")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const items = await db.budgetItem.findMany({
    where: { projectId },
    select: { id: true, name: true, category: true, plannedCost: true },
    orderBy: { createdAt: "asc" },
  })
  // Category comes along so pickers can group: a project with eighteen budget
  // lines is unusable as one flat list.
  return ok({ items: items.map(i => ({ id: i.id, name: i.name, category: (i as any).category || "OTHER", plannedCost: Number(i.plannedCost || 0) })) })
}

async function create(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "budget:edit" as any); if (_g) return _g }
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  try {
    const item = await db.budgetItem.create({
      data: {
        projectId,
        name:        parsed.data.description,
        description: parsed.data.description,
        category:    parsed.data.category as any,
        plannedCost: parsed.data.plannedAmount,
        earnRule: parsed.data.earnRule
          ?? (["EQUIPMENT","MATERIALS"].includes(String(parsed.data.category))
                ? "ZERO_HUNDRED" : "EFFORT"),
        // A new line's first figure is its approved baseline; later edits move
        // plannedCost and the difference becomes visible variance.
        approvedCost: parsed.data.plannedAmount,
        approvedAt:   new Date(),
        actualCost:  parsed.data.actualAmount,
        recurrence:  parsed.data.recurrence ?? null,
        earnedValue: 0,
        currency:    "USD",
        notes:       parsed.data.notes ?? null,
      },
    })
    await syncProjectBudget(projectId)
    return ok(item, 201)
  } catch(e:any) {
    return err(e?.message||"Failed to create budget item", 500)
  }
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, list, params)
}
export async function POST(req: NextRequest, { params }: { params: { projectId:string } }) {
  return withWorkspace(req, create, params)
}
