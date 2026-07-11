// src/app/api/m365/connect/route.ts
// GET  /api/m365/connect         — check M365 connection status
// POST /api/m365/connect/webhook — register Graph webhook subscription

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { requirePermission } from "@/lib/rbac/guards"
import { withWorkspace, ok, err, ApiContext } from "@/lib/api"
import { getGraphToken } from "@/lib/m365/graph-client"
import { subscribeToMailbox } from "@/lib/m365/outlook"
import { db } from "@/lib/db"

async function getConnectionStatus(ctx: ApiContext) {
  const token = await getGraphToken(ctx.userId)

  if (!token) {
    return ok({
      connected:        false,
      provider:         null,
      scopes:           [],
      expiresAt:        null,
      webhookActive:    false,
    })
  }

  // Test token with a lightweight Graph call
  const graph = await import("@/lib/m365/graph-client").then(m => m.GraphClient.forUser(ctx.userId))
  let userInfo: any = null
  let scopes: string[] = []

  if (graph) {
    userInfo = await graph.get<any>("/me?$select=id,displayName,mail").catch(() => null)
    // Decode scopes from token (simplified — real impl decodes JWT)
    scopes = ["Mail.Read", "Calendars.Read", "OnlineMeetings.Read"]
  }

  return ok({
    connected:     !!token && !!userInfo,
    provider:      "AZURE_AD",
    displayName:   userInfo?.displayName,
    email:         userInfo?.mail,
    expiresAt:     token.expiresAt,
    scopes,
    webhookActive: false, // check from DB in full impl
  })
}

async function registerWebhook(ctx: ApiContext) {
  const _g = await requirePermission(ctx as any, "workspace:manage_integrations"); if (_g) return _g
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const webhookUrl = `${appUrl}/api/m365/webhook`

  const subscriptionId = await subscribeToMailbox(ctx.userId, webhookUrl)

  if (!subscriptionId) {
    return err("Failed to register webhook — check M365 permissions", 500)
  }

  return ok({ subscriptionId, webhookUrl, message: "Webhook registered successfully" })
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, getConnectionStatus)
}

export async function POST(req: NextRequest) {
  const url  = new URL(req.url)
  if (url.searchParams.get("action") === "webhook") {
    return withWorkspace(req, registerWebhook)
  }
  return withWorkspace(req, getConnectionStatus)
}
