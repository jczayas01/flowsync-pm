// src/app/api/stripe/plans/route.ts
// GET /api/stripe/plans  — return plan list + current workspace billing status

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { withWorkspace, ok, ApiContext } from "@/lib/api"
import { PLANS, formatPrice } from "@/lib/stripe/client"
import { getBillingStatus } from "@/lib/stripe/billing"

async function getPlans(ctx: ApiContext) {
  const [billing, plans] = await Promise.allSettled([
    getBillingStatus(ctx.workspaceId),
    Promise.resolve(
      Object.values(PLANS).map(plan => ({
        ...plan,
        priceMonthlyFormatted: formatPrice(plan.priceMonthly),
        priceAnnualFormatted:  formatPrice(plan.priceAnnual),
        annualSavings: plan.priceMonthly > 0
          ? Math.round(((plan.priceMonthly - plan.priceAnnual) / plan.priceMonthly) * 100)
          : 0,
      }))
    ),
  ])

  return ok({
    plans:   plans.status   === "fulfilled" ? plans.value   : [],
    billing: billing.status === "fulfilled" ? billing.value : null,
    currentPlan: ctx.userRole,
  })
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, getPlans)
}
