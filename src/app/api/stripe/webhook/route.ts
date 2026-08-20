// src/app/api/stripe/webhook/route.ts
// Stripe webhook receiver — MUST be raw body, no JSON parsing.
//
// Hardened after Stripe reported "other errors" (connection/timeout class, not
// an HTTP status) on test-mode deliveries:
//   • Accepts BOTH the test and live signing secrets, so a single deployment
//     serves both modes. Using one secret for two modes is the most common
//     cause of this exact failure email.
//   • Never lets slow handler work hold the response: the work runs against a
//     deadline and we acknowledge regardless. Stripe only needs the 2xx; a
//     retry on our side is worse than a late DB write we can replay.
//   • Logs event type and id so the Vercel log says what actually arrived.

import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe/client"
import { handleWebhookEvent } from "@/lib/stripe/webhooks"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30          // room for the handler; we still ack early

/** Every configured signing secret, in priority order. */
function signingSecrets(): string[] {
  return [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_TEST,
    process.env.STRIPE_WEBHOOK_SECRET_LIVE,
  ].filter(Boolean) as string[]
}

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get("stripe-signature")

  if (!signature) {
    console.error("[Stripe Webhook] missing stripe-signature header")
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  const secrets = signingSecrets()
  if (!secrets.length) {
    // A clear, loud failure beats a confusing "invalid signature".
    console.error("[Stripe Webhook] no STRIPE_WEBHOOK_SECRET configured — set it in the environment")
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  let event: import("stripe").Stripe.Event | null = null
  let lastErr = ""
  for (const secret of secrets) {
    try {
      event = getStripe().webhooks.constructEvent(body, signature, secret)
      break
    } catch (e: any) { lastErr = e?.message || String(e) }
  }
  if (!event) {
    console.error(`[Stripe Webhook] signature verification failed against ${secrets.length} secret(s): ${lastErr}`)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  console.log(`[Stripe Webhook] ${event.type} · ${event.id} · livemode=${event.livemode}`)

  // Acknowledge within a deadline no matter what the handler does. Anything
  // still running finishes in the background; anything that failed is logged
  // and can be replayed from the Stripe dashboard.
  const DEADLINE_MS = 8_000
  try {
    await Promise.race([
      handleWebhookEvent(event).catch((e: any) => {
        console.error(`[Stripe Webhook] handler error on ${event!.type} (${event!.id}):`, e?.message || e)
      }),
      new Promise(resolve => setTimeout(() => {
        console.warn(`[Stripe Webhook] ${event!.type} (${event!.id}) exceeded ${DEADLINE_MS}ms — acknowledging, work continues`)
        resolve(null)
      }, DEADLINE_MS)),
    ])
  } catch (e: any) {
    console.error("[Stripe Webhook] unexpected:", e?.message || e)
  }

  // Always 2xx once the signature is valid — Stripe retries are for delivery
  // problems, not for our processing bugs.
  return NextResponse.json({ received: true, type: event.type })
}

// Stripe sometimes probes the endpoint with a GET; answering keeps the
// endpoint health check green instead of surfacing a 405.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "stripe-webhook" })
}
