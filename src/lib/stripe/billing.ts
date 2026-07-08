// src/lib/stripe/billing.ts
// Core billing operations — create/update subscriptions, manage seats

import { stripe, PLANS, getPlanByStripePrice, type PlanId } from "./client"
import { db } from "@/lib/db"
import Stripe from "stripe"

// ─────────────────────────────────────────────
// CUSTOMER MANAGEMENT
// ─────────────────────────────────────────────

/**
 * Get or create a Stripe customer for a workspace.
 * Idempotent — safe to call multiple times.
 */
export async function getOrCreateCustomer(
  workspaceId: string,
  email:       string,
  name:        string
): Promise<string> {
  const workspace = await db.workspace.findUnique({
    where:  { id: workspaceId },
    select: { stripeCustomerId: true, name: true },
  })

  if (workspace?.stripeCustomerId) return workspace.stripeCustomerId

  const customer = await stripe.customers.create({
    email,
    name: workspace?.name || name,
    metadata: {
      workspaceId,
      appName: "FlowSync PM",
    },
  })

  await db.workspace.update({
    where: { id: workspaceId },
    data:  { stripeCustomerId: customer.id },
  })

  return customer.id
}

// ─────────────────────────────────────────────
// CHECKOUT SESSION
// ─────────────────────────────────────────────

export interface CheckoutOptions {
  workspaceId: string
  planId:      PlanId
  billing:     "monthly" | "annual"
  userId:      string
  userEmail:   string
  userName:    string
  seats?:      number
  successUrl:  string
  cancelUrl:   string
}

/**
 * Create a Stripe Checkout session for plan upgrade.
 * Supports per-seat pricing for Business plan.
 */
export async function createCheckoutSession(opts: CheckoutOptions): Promise<string> {
  const plan = PLANS[opts.planId]
  if (!plan) throw new Error(`Invalid plan: ${opts.planId}`)

  const priceId = opts.billing === "annual"
    ? plan.stripePriceIdAnnual
    : plan.stripePriceId

  if (!priceId) throw new Error(`No Stripe price configured for ${opts.planId} ${opts.billing}`)

  const customerId = await getOrCreateCustomer(opts.workspaceId, opts.userEmail, opts.userName)

  // Check for existing subscription (upgrade flow)
  const workspace = await db.workspace.findUnique({
    where:  { id: opts.workspaceId },
    select: { stripeSubscriptionId: true },
  })

  // For Business plan — per-seat quantity
  const quantity = opts.planId === "BUSINESS" ? (opts.seats || 10) : 1

  const session = await stripe.checkout.sessions.create({
    customer:    customerId,
    mode:        "subscription",
    line_items: [{
      price:    priceId,
      quantity,
    }],
    // Collect tax automatically
    automatic_tax: { enabled: true },
    // Allow customer to adjust seats for Business plan
    ...(opts.planId === "BUSINESS" && {
      subscription_data: {
        metadata: { workspaceId: opts.workspaceId, planId: opts.planId },
      },
    }),
    // Pre-fill email
    customer_email: !customerId ? opts.userEmail : undefined,
    // Trial for new workspaces on paid plans
    subscription_data: {
      trial_period_days: 14,
      metadata: {
        workspaceId: opts.workspaceId,
        planId:      opts.planId,
        userId:      opts.userId,
      },
    },
    metadata: {
      workspaceId: opts.workspaceId,
      planId:      opts.planId,
      userId:      opts.userId,
    },
    success_url: `${opts.successUrl}?session_id={CHECKOUT_SESSION_ID}&upgraded=true`,
    cancel_url:  opts.cancelUrl,
    // Allow promo codes
    allow_promotion_codes: true,
  })

  return session.url!
}

// ─────────────────────────────────────────────
// CUSTOMER PORTAL
// ─────────────────────────────────────────────

/**
 * Create a Stripe Customer Portal session.
 * Lets customers manage their subscription, payment method, invoices.
 */
export async function createPortalSession(
  workspaceId: string,
  returnUrl:   string
): Promise<string> {
  const workspace = await db.workspace.findUnique({
    where:  { id: workspaceId },
    select: { stripeCustomerId: true },
  })

  if (!workspace?.stripeCustomerId) {
    throw new Error("No Stripe customer found for this workspace")
  }

  const session = await stripe.billingPortal.sessions.create({
    customer:   workspace.stripeCustomerId,
    return_url: returnUrl,
  })

  return session.url
}

// ─────────────────────────────────────────────
// SEAT MANAGEMENT
// ─────────────────────────────────────────────

/**
 * Update the seat count on a Business subscription.
 * Called when adding/removing workspace members.
 */
export async function updateSeats(
  workspaceId: string,
  newSeatCount: number
): Promise<void> {
  const workspace = await db.workspace.findUnique({
    where:  { id: workspaceId },
    select: { stripeSubscriptionId: true, plan: true },
  })

  if (!workspace?.stripeSubscriptionId) return
  if (workspace.plan !== "BUSINESS") return

  const sub = await stripe.subscriptions.retrieve(workspace.stripeSubscriptionId)
  const item = sub.items.data[0]
  if (!item) return

  await stripe.subscriptionItems.update(item.id, {
    quantity:      Math.max(1, newSeatCount),
    proration_behavior: "create_prorations",
  })

  await db.workspace.update({
    where: { id: workspaceId },
    data:  { seats: newSeatCount },
  })
}

// ─────────────────────────────────────────────
// SUBSCRIPTION STATUS
// ─────────────────────────────────────────────

export interface BillingStatus {
  plan:           PlanId
  status:         string   // "active" | "trialing" | "past_due" | "canceled" | "free"
  seats:          number
  currentPeriodEnd: Date | null
  trialEnd:       Date | null
  cancelAtPeriodEnd: boolean
  invoiceUrl:     string | null
  paymentMethod:  { brand: string; last4: string } | null
  nextInvoice:    { amount: number; date: Date } | null
}

export async function getBillingStatus(workspaceId: string): Promise<BillingStatus> {
  const workspace = await db.workspace.findUnique({
    where:  { id: workspaceId },
    select: {
      plan: true, seats: true,
      stripeCustomerId: true, stripeSubscriptionId: true,
    },
  })

  if (!workspace) throw new Error("Workspace not found")

  // Free plan — no Stripe subscription
  if (!workspace.stripeSubscriptionId) {
    return {
      plan:              workspace.plan as PlanId,
      status:            "free",
      seats:             workspace.seats,
      currentPeriodEnd:  null,
      trialEnd:          null,
      cancelAtPeriodEnd: false,
      invoiceUrl:        null,
      paymentMethod:     null,
      nextInvoice:       null,
    }
  }

  // Fetch from Stripe
  const [sub, upcomingInvoice] = await Promise.allSettled([
    stripe.subscriptions.retrieve(workspace.stripeSubscriptionId, {
      expand: ["default_payment_method", "latest_invoice"],
    }),
    workspace.stripeCustomerId
      ? stripe.invoices.retrieveUpcoming({ customer: workspace.stripeCustomerId })
      : null,
  ])

  if (sub.status !== "fulfilled") {
    return {
      plan: workspace.plan as PlanId, status: "unknown", seats: workspace.seats,
      currentPeriodEnd: null, trialEnd: null, cancelAtPeriodEnd: false,
      invoiceUrl: null, paymentMethod: null, nextInvoice: null,
    }
  }

  const s   = sub.value
  const pm  = s.default_payment_method as Stripe.PaymentMethod | null
  const inv = upcomingInvoice.status === "fulfilled" ? upcomingInvoice.value : null

  return {
    plan:              workspace.plan as PlanId,
    status:            s.status,
    seats:             workspace.seats,
    currentPeriodEnd:  new Date(s.current_period_end * 1000),
    trialEnd:          s.trial_end ? new Date(s.trial_end * 1000) : null,
    cancelAtPeriodEnd: s.cancel_at_period_end,
    invoiceUrl:        (s.latest_invoice as Stripe.Invoice)?.hosted_invoice_url || null,
    paymentMethod:     pm?.type === "card"
      ? { brand: pm.card!.brand, last4: pm.card!.last4 }
      : null,
    nextInvoice: inv
      ? { amount: inv.amount_due, date: new Date(inv.period_end * 1000) }
      : null,
  }
}
