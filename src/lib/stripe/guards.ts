// src/lib/stripe/guards.ts
// Plan feature guards — use in API routes to enforce plan limits

import { NextResponse } from "next/server"
import { checkPlanLimit, PLANS, type PlanId } from "./client"

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
  const check = await checkPlanLimit(workspaceId, feature)

  if (!check.allowed) {
    const plan    = PLANS[check.plan]
    const upgrade = check.plan === "FREE" ? "PRO"
                  : check.plan === "PRO"  ? "BUSINESS" : "ENTERPRISE"

    return NextResponse.json({
      error:   "Plan limit reached",
      code:    "PLAN_LIMIT",
      feature,
      plan:    check.plan,
      upgrade,
      message: `This feature requires the ${upgrade} plan. Upgrade at /settings/billing`,
      ...(typeof check.current !== "undefined" && {
        current: check.current,
        limit:   check.limit,
      }),
    }, { status: 402 }) // 402 Payment Required
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

  const ORDER: PlanId[] = ["FREE","PRO","CONSULTANT","BUSINESS","ENTERPRISE"]
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
