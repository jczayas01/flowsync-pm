// src/app/api/m365/planner/route.ts
// GET  /api/m365/planner           — list user's Planner plans
// POST /api/m365/planner/sync      — sync a Planner plan → FlowSync PM project
// POST /api/m365/planner/push      — push a FlowSync PM task → Planner

import { NextRequest } from "next/server"
import { requirePermission } from "@/lib/rbac/guards"
import { z } from "zod"
import { withWorkspace, ok, err, ApiContext } from "@/lib/api"
import { getUserPlannerPlans, syncFromPlanner, pushTaskToPlanner } from "@/lib/m365/planner"

const syncSchema = z.object({
  projectId:     z.string().min(1),
  plannerPlanId: z.string(),
})

const pushSchema = z.object({
  taskId:        z.string().min(1),
  plannerPlanId: z.string(),
  bucketId:      z.string(),
})

async function listPlans(ctx: ApiContext) {
  const plans = await getUserPlannerPlans(ctx.userId)
  return ok(plans)
}

async function syncPlanner(ctx: ApiContext) {
  const _g = await requirePermission(ctx as any, "workspace:manage_integrations"); if (_g) return _g
  const body   = await ctx.req.json().catch(() => ({}))
  const parsed = syncSchema.safeParse(body)
  if (!parsed.success) return err("Invalid request", 422)

  const result = await syncFromPlanner(ctx.userId, parsed.data.projectId, parsed.data.plannerPlanId)
  return ok(result)
}

async function pushToPlanner(ctx: ApiContext) {
  const _g = await requirePermission(ctx as any, "workspace:manage_integrations"); if (_g) return _g
  const body   = await ctx.req.json().catch(() => ({}))
  const parsed = pushSchema.safeParse(body)
  if (!parsed.success) return err("Invalid request", 422)

  const plannerId = await pushTaskToPlanner(
    ctx.userId,
    parsed.data.taskId,
    parsed.data.plannerPlanId,
    parsed.data.bucketId
  )

  if (!plannerId) return err("Failed to push task to Planner", 500)
  return ok({ plannerId })
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, listPlans)
}

export async function POST(req: NextRequest) {
  const url  = new URL(req.url)
  const type = url.searchParams.get("type")
  if (type === "push") return withWorkspace(req, pushToPlanner)
  return withWorkspace(req, syncPlanner)
}
