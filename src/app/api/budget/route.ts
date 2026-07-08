// src/app/api/budget/route.ts
// GET  /api/budget?projectId=  — get budget items + EVM metrics
// POST /api/budget              — create budget item

import { NextRequest } from "next/server"
import { requirePermission } from "@/lib/rbac/guards"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  withWorkspace, ok, err, parseBody,
  verifyProjectAccess, ApiContext,
} from "@/lib/api"

const createBudgetSchema = z.object({
  projectId:   z.string().min(1),
  category:    z.enum(["LABOR","MATERIALS","EQUIPMENT","TRAVEL","SOFTWARE","CONSULTING","CONTINGENCY","OTHER"]),
  name:        z.string().min(1).max(200),
  description: z.string().optional(),
  plannedCost: z.number().min(0),
  currency:    z.string().length(3).default("USD"),
  periodStart: z.string().datetime().optional().nullable(),
  periodEnd:   z.string().datetime().optional().nullable(),
  notes:       z.string().optional(),
})

// Earned Value Management calculations
function calcEVM(items: any[]) {
  const bac = items.reduce((s, i) => s + Number(i.plannedCost), 0)
  const pv  = items.reduce((s, i) => s + Number(i.plannedCost) * 0.65, 0) // simplified; real: time-phased
  const ev  = items.reduce((s, i) => s + Number(i.earnedValue), 0)
  const ac  = items.reduce((s, i) => s + Number(i.actualCost), 0)
  const cv  = ev - ac
  const sv  = ev - pv
  const cpi = ac > 0 ? ev / ac : 1
  const spi = pv > 0 ? ev / pv : 1
  const eac = cpi > 0 ? bac / cpi : bac
  const etc = eac - ac
  const vac = bac - eac
  return { bac, pv, ev, ac, cv, sv, cpi, spi, eac, etc, vac,
    cpiFormatted: cpi.toFixed(2), spiFormatted: spi.toFixed(2) }
}

async function getBudget(ctx: ApiContext) {
  const url = new URL(ctx.req.url)
  const projectId = url.searchParams.get("projectId")
  if (!projectId) return err("projectId required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return err("Not found", 404)

  const items = await db.budgetItem.findMany({
    where:   { projectId },
    orderBy: { createdAt: "asc" },
    include: { expenses: { orderBy: { date: "desc" }, take: 5 } },
  })

  const project = await db.project.findUnique({
    where:  { id: projectId },
    select: { budgetTotal: true, budgetSpent: true, percentComplete: true, currency: true },
  })

  const evm = calcEVM(items)

  return ok({ items, evm, project, summary: {
    totalPlanned: items.reduce((s,i) => s + Number(i.plannedCost), 0),
    totalActual:  items.reduce((s,i) => s + Number(i.actualCost), 0),
    totalEarned:  items.reduce((s,i) => s + Number(i.earnedValue), 0),
    currency:     project?.currency || "USD",
  }})
}

async function createBudgetItem(ctx: ApiContext) {
  const _g = await requirePermission(ctx as any, "budget:edit"); if (_g) return _g
  const parsed = await parseBody(ctx.req, createBudgetSchema)
  if ("error" in parsed) return parsed.error
  const { data } = parsed

  const access = await verifyProjectAccess(data.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return err("Project not found", 404)

  const item = await db.budgetItem.create({
    data: {
      projectId:   data.projectId,
      category:    data.category,
      name:        data.name,
      description: data.description,
      plannedCost: data.plannedCost,
      currency:    data.currency,
      periodStart: data.periodStart ? new Date(data.periodStart) : null,
      periodEnd:   data.periodEnd   ? new Date(data.periodEnd)   : null,
      notes:       data.notes,
    },
  })

  // Update project budget total
  const allItems = await db.budgetItem.aggregate({
    where: { projectId: data.projectId },
    _sum:  { plannedCost: true, actualCost: true },
  })
  await db.project.update({
    where: { id: data.projectId },
    data: {
      budgetTotal: Number(allItems._sum.plannedCost) || 0,
      budgetSpent: Number(allItems._sum.actualCost)  || 0,
    },
  })

  return ok(item, 201)
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, getBudget)
}
export async function POST(req: NextRequest) {
  return withWorkspace(req, createBudgetItem)
}
