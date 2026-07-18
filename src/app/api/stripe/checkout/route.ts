// src/app/api/stripe/checkout/route.ts
// POST /api/stripe/checkout  — create a Checkout session URL

export const dynamic = "force-dynamic"

import { SITE_URL } from "@/lib/site-url"
import { NextRequest } from "next/server"
import { requirePermission } from "@/lib/rbac/guards"
import { z } from "zod"
import { withWorkspace, ok, err, parseBody, ApiContext } from "@/lib/api"
import { createCheckoutSession } from "@/lib/stripe/billing"

const checkoutSchema = z.object({
  planId:  z.enum(["STARTER","BUSINESS"]),
  seats:   z.number().int().min(1).max(10000).default(1),
  bundles: z.number().int().min(0).max(1000).default(0),
  billing: z.enum(["monthly","annual"]).default("monthly"),
})

async function createCheckout(ctx: ApiContext) {
  const _g = await requirePermission(ctx as any, "workspace:edit_settings"); if (_g) return _g
  const parsed = await parseBody(ctx.req, checkoutSchema)
  if ("error" in parsed) return parsed.error

  const { planId, billing, seats, bundles } = parsed.data

  // Get user details for Stripe
  const { db } = await import("@/lib/db")
  const user = await db.user.findUnique({
    where:  { id: ctx.userId },
    select: { email: true, name: true },
  })
  if (!user) return err("User not found", 404)

  const appUrl = SITE_URL!

  const url = await createCheckoutSession({
    workspaceId: ctx.workspaceId,
    planId,
    billing,
    seats,
    bundles,
    userId:      ctx.userId,
    userEmail:   user.email,
    userName:    user.name,
    successUrl:  `${appUrl}/settings/billing`,
    cancelUrl:   `${appUrl}/settings/billing?cancelled=true`,
  })

  return ok({ url })
}

export async function POST(req: NextRequest) {
  return withWorkspace(req, createCheckout, undefined, ["OWNER","ADMIN"])
}
