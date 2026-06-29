// src/app/api/stripe/portal/route.ts
// POST /api/stripe/portal  — redirect to Stripe Customer Portal

import { NextRequest } from "next/server"
import { withWorkspace, ok, err, ApiContext } from "@/lib/api"
import { createPortalSession } from "@/lib/stripe/billing"

async function openPortal(ctx: ApiContext) {
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL!
  const returnUrl = `${appUrl}/settings/billing`

  try {
    const url = await createPortalSession(ctx.workspaceId, returnUrl)
    return ok({ url })
  } catch (e: any) {
    return err(e.message, 400)
  }
}

export async function POST(req: NextRequest) {
  return withWorkspace(req, openPortal, undefined, ["OWNER","ADMIN"])
}
