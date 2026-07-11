// src/app/api/webhooks/[webhookId]/test/route.ts — send a signed test ping.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { createHmac } from "crypto"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, forbidden, ApiContext } from "@/lib/api"
import { WH_ADMIN_ROLES } from "@/lib/api/handlers/webhooks"

// Basic SSRF guard — refuse localhost / private ranges for server-side delivery.
function isSafeUrl(u: string): boolean {
  try {
    const url = new URL(u)
    if (url.protocol !== "https:" && url.protocol !== "http:") return false
    const h = url.hostname.toLowerCase()
    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(h)) return false
    if (/^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false
    if (h.endsWith(".internal") || h.endsWith(".local")) return false
    return true
  } catch { return false }
}

async function testWebhook(ctx: ApiContext, params?: Record<string, string>) {
  if (!WH_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()
  const id = params?.webhookId
  if (!id) return err("Webhook ID required")
  const wh = await db.webhook.findFirst({ where: { id, workspaceId: ctx.workspaceId } })
  if (!wh) return notFound("Webhook")
  if (!isSafeUrl(wh.url)) return err("This endpoint URL is not allowed for delivery")

  const payload = JSON.stringify({
    event: "ping",
    workspaceId: ctx.workspaceId,
    timestamp: new Date().toISOString(),
    data: { message: "Test event from FlowSync PM" },
  })
  const signature = createHmac("sha256", wh.secret).update(payload).digest("hex")

  try {
    const res = await fetch(wh.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-FlowSync-Event": "ping",
        "X-FlowSync-Signature": signature,
      },
      body: payload,
      signal: AbortSignal.timeout(5000),
    })
    await db.webhook.update({
      where: { id },
      data: { lastTriggeredAt: new Date(), ...(res.ok ? { successCount: { increment: 1 } } : { errorCount: { increment: 1 } }) },
    })
    return ok({ delivered: res.ok, status: res.status })
  } catch {
    await db.webhook.update({ where: { id }, data: { errorCount: { increment: 1 } } })
    return ok({ delivered: false, error: "Endpoint unreachable or timed out" })
  }
}

export async function POST(req: NextRequest, { params }: { params: { webhookId: string } }) {
  return withWorkspace(req, testWebhook, params)
}
