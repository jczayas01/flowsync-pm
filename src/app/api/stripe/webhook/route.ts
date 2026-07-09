// src/app/api/stripe/webhook/route.ts
// Stripe webhook receiver — MUST be raw body, no JSON parsing

import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe/client"
import { handleWebhookEvent } from "@/lib/stripe/webhooks"

// Disable body parsing — Stripe requires the raw body for signature verification
export const runtime = 'nodejs'
   export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event: import("stripe").Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (e: any) {
    console.error("[Stripe Webhook] Signature verification failed:", e.message)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    await handleWebhookEvent(event)
    return NextResponse.json({ received: true })
  } catch (e: any) {
    console.error("[Stripe Webhook] Handler error:", e)
    // Return 200 anyway — Stripe will retry on 4xx/5xx
    return NextResponse.json({ received: true, warning: e.message })
  }
}
