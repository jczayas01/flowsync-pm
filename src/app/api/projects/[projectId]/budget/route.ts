// POST /api/projects/:id/budget — create budget item
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  description:   z.string().min(1).max(300),
  category:      z.string().default("OTHER"),
  plannedAmount: z.number().min(0).default(0),
  actualAmount:  z.number().min(0).default(0),
  notes:         z.string().optional().nullable(),
})

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
        actualCost:  parsed.data.actualAmount,
        earnedValue: 0,
        currency:    "USD",
        notes:       parsed.data.notes ?? null,
      },
    })
    return ok(item, 201)
  } catch(e:any) {
    return err(e?.message||"Failed to create budget item", 500)
  }
}

export async function POST(req: NextRequest, { params }: { params: { projectId:string } }) {
  return withWorkspace(req, create, params)
}
