// src/lib/stripe/webhooks.ts
// Handles all incoming Stripe webhook events
// This is the authoritative source for subscription state changes

import Stripe from "stripe"
import { stripe, getPlanByStripePrice, type PlanId } from "./client"
import { db } from "@/lib/db"

// ─────────────────────────────────────────────
// EVENT HANDLERS
// ─────────────────────────────────────────────

/**
 * checkout.session.completed
 * User finished checkout — activate their subscription.
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const workspaceId = session.metadata?.workspaceId
  const planId      = session.metadata?.planId as PlanId
  const userId      = session.metadata?.userId

  if (!workspaceId || !planId) {
    console.error("[Stripe] Missing metadata on session:", session.id)
    return
  }

  // Retrieve subscription details
  const subId = session.subscription as string
  if (!subId) return

  const sub = await stripe.subscriptions.retrieve(subId)
  const priceId = sub.items.data[0]?.price.id

  // Update workspace plan
  await db.workspace.update({
    where: { id: workspaceId },
    data: {
      plan:                    planId,
      stripeSubscriptionId:    subId,
      planRenewsAt:            new Date(sub.current_period_end * 1000),
      trialEndsAt:             sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
  })

  // Audit log
  if (userId) {
    await db.auditLog.create({
      data: {
        workspaceId,
        userId,
        action:     "billing.subscribed",
        entityType: "workspace",
        entityId:   workspaceId,
        after:      { plan: planId, subscriptionId: subId } as any,
      },
    }).catch(() => {})
  }

  // Send confirmation email
  await sendBillingEmail(workspaceId, "subscription_started", { planId })

  console.log(`[Stripe] ✓ Workspace ${workspaceId} upgraded to ${planId}`)
}

/**
 * customer.subscription.updated
 * Plan changed, seats changed, trial ended, etc.
 */
async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const workspaceId = sub.metadata?.workspaceId
  if (!workspaceId) return

  const priceId = sub.items.data[0]?.price.id
  const plan    = priceId ? getPlanByStripePrice(priceId) : null
  const seats   = sub.items.data[0]?.quantity || 1

  await db.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(plan && { plan: plan.id }),
      seats,
      stripeSubscriptionId: sub.id,
      planRenewsAt:         new Date(sub.current_period_end * 1000),
      trialEndsAt:          sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
  })

  // Trial ended — notify user
  if (sub.status === "active" && sub.trial_end &&
      sub.trial_end * 1000 < Date.now() + 86400000) {
    await sendBillingEmail(workspaceId, "trial_ending_soon", {})
  }

  console.log(`[Stripe] ✓ Subscription updated for workspace ${workspaceId}: ${plan?.id || "unknown plan"}`)
}

/**
 * customer.subscription.deleted
 * Subscription cancelled or payment permanently failed — downgrade to Free.
 */
async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const workspaceId = sub.metadata?.workspaceId
  if (!workspaceId) return

  await db.workspace.update({
    where: { id: workspaceId },
    data: {
      plan:                 "FREE",
      stripeSubscriptionId: null,
      planRenewsAt:         null,
      seats:                1,
    },
  })

  await sendBillingEmail(workspaceId, "subscription_cancelled", {})

  await db.auditLog.create({
    data: {
      workspaceId,
      action:     "billing.cancelled",
      entityType: "workspace",
      entityId:   workspaceId,
      after:      { plan: "FREE" } as any,
    },
  }).catch(() => {})

  console.log(`[Stripe] ✓ Workspace ${workspaceId} downgraded to FREE`)
}

/**
 * invoice.payment_succeeded
 * Successful renewal — update renewal date.
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return

  const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
  const workspaceId = sub.metadata?.workspaceId
  if (!workspaceId) return

  await db.workspace.update({
    where: { id: workspaceId },
    data:  { planRenewsAt: new Date(sub.current_period_end * 1000) },
  })
}

/**
 * invoice.payment_failed
 * Payment failed — warn the workspace owner.
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return

  const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
  const workspaceId = sub.metadata?.workspaceId
  if (!workspaceId) return

  await sendBillingEmail(workspaceId, "payment_failed", {
    amount:   invoice.amount_due,
    currency: invoice.currency,
    nextAttempt: invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000)
      : null,
  })

  console.warn(`[Stripe] ⚠ Payment failed for workspace ${workspaceId}`)
}

/**
 * customer.subscription.trial_will_end
 * 3 days before trial ends — remind user to add payment.
 */
async function handleTrialWillEnd(sub: Stripe.Subscription) {
  const workspaceId = sub.metadata?.workspaceId
  if (!workspaceId) return
  await sendBillingEmail(workspaceId, "trial_ending_soon", {
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  })
}

// ─────────────────────────────────────────────
// EMAIL HELPER (uses Resend)
// ─────────────────────────────────────────────

async function sendBillingEmail(
  workspaceId: string,
  template:    string,
  data:        Record<string, unknown>
) {
  try {
    // Get workspace owner email
    const owner = await db.workspaceMember.findFirst({
      where:   { workspaceId, role: "OWNER" },
      include: { user: { select: { email: true, name: true } } },
    })
    if (!owner) return

    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)

    const subjects: Record<string, string> = {
      subscription_started:  "Welcome to FlowSync PM — subscription active",
      subscription_cancelled:"Your FlowSync PM subscription has been cancelled",
      trial_ending_soon:     "Your FlowSync PM trial ends in 3 days",
      payment_failed:        "Action required: FlowSync PM payment failed",
    }

    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL!,
      to:      owner.user.email,
      subject: subjects[template] || "FlowSync PM billing update",
      html: buildEmailHtml(template, { ...data, name: owner.user.name }),
    })
  } catch (e) {
    console.error("[Billing Email]", e)
  }
}

function buildEmailHtml(template: string, data: any): string {
  const base = (content: string) => `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
      <div style="margin-bottom:24px">
        <span style="font-size:18px;font-weight:600;color:#0D1B2A">FlowSync</span>
        <span style="font-size:18px;font-weight:600;color:#F59E0B">PM</span>
      </div>
      ${content}
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8">
        FlowSync PM · flowsyncpm.com · Manage your billing at
        <a href="https://flowsyncpm.com/settings/billing" style="color:#1B6CA8">Settings → Billing</a>
      </div>
    </div>`

  if (template === "subscription_started") return base(`
    <h2 style="color:#0D1B2A;margin-bottom:8px">You're all set, ${data.name}!</h2>
    <p style="color:#475569">Your <strong>${data.planId}</strong> subscription is now active.
    You have full access to all features on your plan.</p>
    <a href="https://flowsyncpm.com/dashboard"
      style="display:inline-block;margin-top:16px;padding:10px 20px;background:#1B6CA8;color:#fff;border-radius:6px;text-decoration:none;font-weight:500">
      Go to dashboard →
    </a>`)

  if (template === "trial_ending_soon") return base(`
    <h2 style="color:#0D1B2A;margin-bottom:8px">Your trial ends soon</h2>
    <p style="color:#475569">Your 14-day free trial ends on
    <strong>${data.trialEnd ? new Date(data.trialEnd).toDateString() : "soon"}</strong>.
    Add a payment method to keep your access.</p>
    <a href="https://flowsyncpm.com/settings/billing"
      style="display:inline-block;margin-top:16px;padding:10px 20px;background:#1B6CA8;color:#fff;border-radius:6px;text-decoration:none;font-weight:500">
      Add payment method →
    </a>`)

  if (template === "payment_failed") return base(`
    <h2 style="color:#DC2626;margin-bottom:8px">Payment failed</h2>
    <p style="color:#475569">We couldn't process your payment.
    Please update your payment method to avoid losing access.</p>
    <a href="https://flowsyncpm.com/settings/billing"
      style="display:inline-block;margin-top:16px;padding:10px 20px;background:#DC2626;color:#fff;border-radius:6px;text-decoration:none;font-weight:500">
      Update payment method →
    </a>`)

  return base(`<p style="color:#475569">Your subscription has been updated.</p>`)
}

// ─────────────────────────────────────────────
// MAIN WEBHOOK DISPATCHER
// ─────────────────────────────────────────────

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session)
      break
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
      break
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break
    case "invoice.payment_succeeded":
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
      break
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice)
      break
    case "customer.subscription.trial_will_end":
      await handleTrialWillEnd(event.data.object as Stripe.Subscription)
      break
    default:
      // Ignore unhandled events
      break
  }
}
