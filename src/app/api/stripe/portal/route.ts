// src/app/api/stripe/portal/route.ts
// POST /api/stripe/portal  — redirect to Stripe Customer Portal

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { requirePermission } from "@/lib/rbac/guards"
import { withWorkspace, ok, err, ApiContext } from "@/lib/api"
import { createPortalSession } from "@/lib/stripe/billing"

async function openPortal(ctx: ApiContext) {
  const _g = await requirePermission(ctx as any, "workspace:edit_settings"); if (_g) return _g
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
