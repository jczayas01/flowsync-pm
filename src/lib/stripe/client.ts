// src/lib/stripe/client.ts
// Stripe client singleton + plan definitions.
// Lazy-initialized — the app runs normally without STRIPE_SECRET_KEY; billing
// features simply stay off until it's configured.
//
// PRICING MODEL (the one true version — matches landing, pricing page and GTM kit):
//   Trial       — 2 months free, full product, no card; subscribe during trial → charged at trial end
//   Starter     — $19/user/mo flat
//   Business    — $39/user/mo for paid roles + $20/mo per 10-user contributor bundle
//   Enterprise  — custom (never self-serve checkout)
//
// The DB Plan enum still contains legacy values (PRO, PROFESSIONAL, CONSULTANT)
// from the earlier model. Workspaces on those values keep working: each maps to
// the limits of its nearest current tier. Checkout only ever offers STARTER and
// BUSINESS.

import Stripe from "stripe"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured. Add STRIPE_SECRET_KEY to enable billing.")
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-04-10" as any,
      typescript:  true,
      appInfo: { name:"FlowSync PM", version:"1.0.0", url:"https://flowsyncpm.com" },
    })
  }
  return _stripe
}

// Backward compat — property access initializes lazily, import never throws.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) { return getStripe()[prop as keyof Stripe] },
})

export const stripeEnabled = !!process.env.STRIPE_SECRET_KEY

// Every value that can appear in Workspace.plan (DB enum), so plan guards can
// never meet an unknown key.
export type PlanId = "FREE" | "STARTER" | "PRO" | "PROFESSIONAL" | "BUSINESS" | "CONSULTANT" | "ENTERPRISE"

/** The tiers a user can actually buy through checkout. */
export type CheckoutPlanId = "STARTER" | "BUSINESS"

export interface Plan {
  id:                  PlanId
  name:                string
  description:         string
  priceMonthly:        number        // USD cents, per user
  priceAnnual:         number        // USD cents/user/mo when billed annually (20% off)
  stripePriceId:       string | null // per-seat monthly
  stripePriceIdAnnual: string | null // per-seat annual
  /** Business only: the 10-user contributor/viewer bundle price. */
  bundlePriceMonthly:  number
  bundlePriceAnnual:   number
  stripeBundlePriceId:       string | null
  stripeBundlePriceIdAnnual: string | null
  highlighted:         boolean
  selfServe:           boolean       // appears in checkout
  legacy:              boolean       // kept only for existing workspaces
  limits: {
    projects:       number   // -1 = unlimited
    users:          number   // -1 = unlimited
    storage:        string
    aiReports:      boolean
    wordExport:     boolean
    evm:            boolean
    fullGovernance: boolean
    executiveDash:  boolean
    portfolio:      boolean
    automations:    number   // -1 = unlimited
    sso:            boolean
    whiteLabel:     boolean
    m365:           boolean
    apiAccess:      boolean
    auditLog:       string   // "30d" | "1y" | "unlimited"
    support:        string
  }
}

const STARTER_LIMITS: Plan["limits"] = {
  projects:-1, users:-1, storage:"10 GB",
  aiReports:true, wordExport:true, evm:true, fullGovernance:true,
  executiveDash:false, portfolio:false, automations:5,
  sso:false, whiteLabel:false, m365:false, apiAccess:false,
  auditLog:"30d", support:"Community & email",
}

const BUSINESS_LIMITS: Plan["limits"] = {
  projects:-1, users:-1, storage:"100 GB",
  aiReports:true, wordExport:true, evm:true, fullGovernance:true,
  executiveDash:true, portfolio:true, automations:-1,
  sso:true, whiteLabel:false, m365:true, apiAccess:true,
  auditLog:"1y", support:"Email",
}

const ENTERPRISE_LIMITS: Plan["limits"] = {
  ...BUSINESS_LIMITS,
  storage:"Unlimited", whiteLabel:true, auditLog:"unlimited",
  support:"Dedicated",
}

const p = (over: Partial<Plan> & Pick<Plan,"id"|"name"|"description"|"limits">): Plan => ({
  priceMonthly:0, priceAnnual:0,
  stripePriceId:null, stripePriceIdAnnual:null,
  bundlePriceMonthly:0, bundlePriceAnnual:0,
  stripeBundlePriceId:null, stripeBundlePriceIdAnnual:null,
  highlighted:false, selfServe:false, legacy:false,
  ...over,
})

export const PLANS: Record<PlanId, Plan> = {
  // Trial workspaces sit on FREE with trialEndsAt set — full product while it runs.
  FREE: p({
    id:"FREE", name:"Trial",
    description:"Two months free, the whole product. No card required.",
    limits: BUSINESS_LIMITS,
  }),

  STARTER: p({
    id:"STARTER", name:"Starter",
    description:"For small teams and independent PMs. Flat per user.",
    priceMonthly:1900, priceAnnual:1520,
    stripePriceId:       process.env.STRIPE_PRICE_STARTER_MONTHLY || null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_STARTER_ANNUAL  || null,
    selfServe:true,
    limits: STARTER_LIMITS,
  }),

  BUSINESS: p({
    id:"BUSINESS", name:"Business",
    description:"For PMOs. Paid seats for the roles that drive the work; contributors come in bundles of 10.",
    priceMonthly:3900, priceAnnual:3120,
    stripePriceId:       process.env.STRIPE_PRICE_BUSINESS_SEAT_MONTHLY || null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_BUSINESS_SEAT_ANNUAL  || null,
    bundlePriceMonthly:2000, bundlePriceAnnual:1600,
    stripeBundlePriceId:       process.env.STRIPE_PRICE_BUSINESS_BUNDLE_MONTHLY || null,
    stripeBundlePriceIdAnnual: process.env.STRIPE_PRICE_BUSINESS_BUNDLE_ANNUAL  || null,
    highlighted:true, selfServe:true,
    limits: BUSINESS_LIMITS,
  }),

  ENTERPRISE: p({
    id:"ENTERPRISE", name:"Enterprise",
    description:"Custom pricing, directory sync, white-label, DPA, personal onboarding.",
    limits: ENTERPRISE_LIMITS,
  }),

  // ── Legacy values still present in the DB enum — never sold, never shown ──
  PRO: p({
    id:"PRO", name:"Business (legacy)", legacy:true,
    description:"Legacy plan — Business limits apply.",
    limits: BUSINESS_LIMITS,
  }),
  PROFESSIONAL: p({
    id:"PROFESSIONAL", name:"Business (legacy)", legacy:true,
    description:"Legacy plan — Business limits apply.",
    limits: BUSINESS_LIMITS,
  }),
  CONSULTANT: p({
    id:"CONSULTANT", name:"Starter (legacy)", legacy:true,
    description:"Legacy plan — Starter limits apply.",
    limits: STARTER_LIMITS,
  }),
}

// Upgrade ladder for plan-limit errors ("this needs the X plan").
export const PLAN_ORDER: PlanId[] = ["FREE","STARTER","BUSINESS","ENTERPRISE"]

/** Where a legacy plan sits on the ladder, for upgrade suggestions. */
export function effectiveTier(plan: PlanId): PlanId {
  if (plan === "PRO" || plan === "PROFESSIONAL") return "BUSINESS"
  if (plan === "CONSULTANT") return "STARTER"
  return plan
}

export function checkPlanLimit(
  plan: PlanId,
  limit: keyof Plan["limits"],
  current: number,
): { allowed:boolean; limit:number|boolean|string } {
  const planDef = PLANS[plan] ?? PLANS.FREE
  const l = planDef.limits[limit]
  if (typeof l === "boolean") return { allowed:l, limit:l }
  if (typeof l === "string")  return { allowed:true, limit:l }
  if (l === -1)               return { allowed:true, limit:-1 }
  return { allowed:current < l, limit:l }
}

export function formatPrice(cents: number): string {
  if (!cents) return "Free"
  return "$" + (cents / 100).toLocaleString("en-US",{ minimumFractionDigits:0, maximumFractionDigits:2 })
}

export function getPlanByStripePrice(priceId: string): Plan | null {
  for (const plan of Object.values(PLANS)) {
    if (plan.stripePriceId === priceId || plan.stripePriceIdAnnual === priceId ||
        plan.stripeBundlePriceId === priceId || plan.stripeBundlePriceIdAnnual === priceId) return plan
  }
  return null
}
