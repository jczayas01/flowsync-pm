// src/app/api/stripe/checkout/route.ts
// POST /api/stripe/checkout  — create a Checkout session URL

import { NextRequest } from "next/server"
import { requirePermission } from "@/lib/rbac/guards"
import { z } from "zod"
import { withWorkspace, ok, err, parseBody, ApiContext } from "@/lib/api"
import { createCheckoutSession, checkPlanLimit } from "@/lib/stripe/client"
import type { PlanId } from "@/lib/stripe/client"

const checkoutSchema = z.object({
  planId:  z.enum(["PRO","CONSULTANT","BUSINESS","ENTERPRISE"]),
  billing: z.enum(["monthly","annual"]).default("monthly"),
  seats:   z.number().int().min(1).max(500).optional().default(10),
})

async function createCheckout(ctx: ApiContext) {
  const _g = await requirePermission(ctx as any, "workspace:edit_settings"); if (_g) return _g
  const parsed = await parseBody(ctx.req, checkoutSchema)
  if ("error" in parsed) return parsed.error

  const { planId, billing, seats } = parsed.data

  if (planId === "ENTERPRISE") {
    return ok({ redirect: "https://flowsyncpm.com/contact-sales" })
  }

  // Get user details for Stripe
  const { db } = await import("@/lib/db")
  const user = await db.user.findUnique({
    where:  { id: ctx.userId },
    select: { email: true, name: true },
  })
  if (!user) return err("User not found", 404)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const url = await createCheckoutSession({
    workspaceId: ctx.workspaceId,
    planId:      planId as PlanId,
    billing,
    userId:      ctx.userId,
    userEmail:   user.email,
    userName:    user.name,
    seats:       planId === "BUSINESS" ? seats : 1,
    successUrl:  `${appUrl}/settings/billing`,
    cancelUrl:   `${appUrl}/settings/billing?cancelled=true`,
  })

  return ok({ url })
}

export async function POST(req: NextRequest) {
  return withWorkspace(req, createCheckout, undefined, ["OWNER","ADMIN"])
}
