// src/lib/stripe/guards.ts
// Plan feature guards — use in API routes to enforce plan limits

import { NextResponse } from "next/server"
import { checkPlanLimit, PLANS, PLAN_ORDER, effectiveTier, type PlanId } from "./client"
import { db } from "@/lib/db"

/**
 * requireFeature — returns an error response if the workspace
 * doesn't have access to a specific feature on their plan.
 *
 * Usage in API routes:
 *   const guard = await requireFeature(workspaceId, "aiCopilot")
 *   if (guard) return guard
 */
export async function requireFeature(
  workspaceId: string,
  feature:     keyof typeof PLANS["FREE"]["limits"]
): Promise<NextResponse | null> {
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } })
  const planId = (ws?.plan ?? "FREE") as PlanId
  const check  = checkPlanLimit(planId, feature, 0)

  if (!check.allowed) {
    const idx     = PLAN_ORDER.indexOf(effectiveTier(planId))
    const upgrade = PLAN_ORDER[Math.min(idx + 1, PLAN_ORDER.length - 1)]
    return NextResponse.json({
      error:   "Plan limit reached",
      code:    "PLAN_LIMIT",
      feature,
      plan:    planId,
      upgrade,
      message: `This feature requires the ${upgrade} plan. Upgrade at /settings/billing`,
      limit:   check.limit,
    }, { status: 402 })
  }
  return null
}

/**
 * requirePlan — gate an entire route on a minimum plan level.
 */
export async function requirePlan(
  workspaceId: string,
  minimumPlan: PlanId
): Promise<NextResponse | null> {
  const { db } = await import("@/lib/db")
  const ws = await db.workspace.findUnique({
    where:  { id: workspaceId },
    select: { plan: true },
  })

  const ORDER: PlanId[] = PLAN_ORDER
  const current = ORDER.indexOf((ws?.plan || "FREE") as PlanId)
  const required = ORDER.indexOf(minimumPlan)

  if (current < required) {
    return NextResponse.json({
      error:   "Upgrade required",
      code:    "PLAN_REQUIRED",
      current: ws?.plan,
      required: minimumPlan,
      message: `This feature requires the ${minimumPlan} plan or higher`,
    }, { status: 402 })
  }

  return null
}
