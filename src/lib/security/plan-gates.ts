// src/lib/security/plan-gates.ts
// Page-level plan checks (server components). API routes use
// requireFeature from lib/stripe/guards — same PLANS source of truth.
import { db } from "@/lib/db"
import { PLANS, type PlanId } from "@/lib/stripe/client"

export async function workspaceHasFeature(
  workspaceId: string,
  feature: keyof typeof PLANS["FREE"]["limits"],
): Promise<boolean> {
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } })
  const plan = PLANS[(ws?.plan ?? "FREE") as PlanId] ?? PLANS.FREE
  return !!plan.limits[feature]
}
