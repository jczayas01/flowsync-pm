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
  planId:      "STARTER" | "BUSINESS"
  billing:     "monthly" | "annual"
  seats:       number          // paid seats (both plans)
  bundles?:    number          // Business only: 10-user contributor bundles
  userId:      string
  userEmail:   string
  userName:    string
  successUrl:  string
  cancelUrl:   string
}

/**
 * Create a Stripe Checkout session.
 *
 * The trial promise is honored here: if the workspace's trialEndsAt is still in
 * the future, the subscription starts with trial_end at that exact moment — the
 * card goes on file now and the first charge lands when the trial we advertised
 * actually ends. No 14-day Stripe default, no double trial.
 *
 * Business is two line items: paid seats at $39 and contributor bundles at $20
 * per 10. That structural split is the pricing model, not a discount.
 */
export async function createCheckoutSession(opts: CheckoutOptions): Promise<string> {
  const plan = PLANS[opts.planId]
  if (!plan?.selfServe) throw new Error(`Plan ${opts.planId} is not available for checkout`)

  const annual = opts.billing === "annual"
  const seatPrice = annual ? plan.stripePriceIdAnnual : plan.stripePriceId
  if (!seatPrice) throw new Error(`No Stripe price configured for ${opts.planId} ${opts.billing} — run scripts/stripe-setup.mjs`)

  const line_items: { price:string; quantity:number }[] = [
    { price: seatPrice, quantity: Math.max(1, opts.seats) },
  ]

  if (opts.planId === "BUSINESS" && (opts.bundles ?? 0) > 0) {
    const bundlePrice = annual ? plan.stripeBundlePriceIdAnnual : plan.stripeBundlePriceId
    if (!bundlePrice) throw new Error("No Stripe price configured for the Business bundle — run scripts/stripe-setup.mjs")
    line_items.push({ price: bundlePrice, quantity: opts.bundles! })
  }

  const customerId = await getOrCreateCustomer(opts.workspaceId, opts.userEmail, opts.userName)

  // Honor the advertised trial: convert exactly when we said we would.
  // Stripe requires trial_end ≥ 48h out; closer than that, charge now.
  const ws = await db.workspace.findUnique({
    where:  { id: opts.workspaceId },
    select: { trialEndsAt: true },
  })
  const trialEnd =
    ws?.trialEndsAt && ws.trialEndsAt.getTime() > Date.now() + 48 * 3600 * 1000
      ? Math.floor(ws.trialEndsAt.getTime() / 1000)
      : undefined

  const metadata = { workspaceId: opts.workspaceId, planId: opts.planId, userId: opts.userId }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode:     "subscription",
    line_items,
    subscription_data: {
      ...(trialEnd ? { trial_end: trialEnd } : {}),
      metadata,
    },
    metadata,
    // Stripe Tax must be configured in the dashboard before this can be on,
    // otherwise every checkout fails. Off by default; enable via env when ready.
    ...(process.env.STRIPE_AUTOMATIC_TAX === "1" ? { automatic_tax: { enabled: true } } : {}),
    // Billing terms consent (checkbox at checkout). Requires the ToS URL to be
    // set in Stripe Dashboard → Settings → Public details; env-gated until then.
    ...(process.env.STRIPE_REQUIRE_TOS === "1"
      ? { consent_collection: { terms_of_service: "required" as const } }
      : {}),
    billing_address_collection: "auto",
    allow_promotion_codes: true,
    success_url: `${opts.successUrl}?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${opts.cancelUrl}?cancelled=true`,
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
