// src/lib/stripe/client.ts
// Stripe client singleton + plan definitions
// Lazy-initialized — app runs normally without STRIPE_SECRET_KEY
// Billing features are disabled when key is not configured

import Stripe from "stripe"

// Lazy singleton — only instantiated when actually used
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured. Add STRIPE_SECRET_KEY to your .env file to enable billing.")
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-04-10",
      typescript:  true,
      appInfo: { name:"FlowSync PM", version:"1.0.0", url:"https://flowsyncpm.com" },
    })
  }
  return _stripe
}

// Keep backward compat — but won't throw on import
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe]
  }
})

export const stripeEnabled = !!process.env.STRIPE_SECRET_KEY

export type PlanId = "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE" | "CONSULTANT"

export interface Plan {
  id:                  PlanId
  name:                string
  description:         string
  priceMonthly:        number   // USD cents
  priceAnnual:         number   // USD cents/month billed annually (20% off)
  stripePriceId:       string|null
  stripePriceIdAnnual: string|null
  seats:               number   // -1 = unlimited
  highlighted:         boolean
  limits: {
    projects:       number   // -1 = unlimited
    users:          number   // -1 = unlimited
    storage:        string
    aiReports:      boolean
    wordExport:     boolean
    evm:            boolean
    fullGovernance: boolean  // all PM Standard tabs
    executiveDash:  boolean
    portfolio:      boolean
    automations:    number   // recipe count, -1 = unlimited
    sso:            boolean
    whiteLabel:     boolean
    m365:           boolean
    apiAccess:      boolean
    auditLog:       string   // "30d" | "1y" | "unlimited"
    support:        string
  }
}

export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    id:"FREE", name:"Free", highlighted:false,
    description:"For individual PMs — 1 project, 3 users.",
    priceMonthly:0, priceAnnual:0,
    stripePriceId:null, stripePriceIdAnnual:null,
    seats:3,
    limits:{
      projects:1, users:3, storage:"1 GB",
      aiReports:false, wordExport:false, evm:false,
      fullGovernance:false, executiveDash:false, portfolio:false,
      automations:0, sso:false, whiteLabel:false, m365:false,
      apiAccess:false, auditLog:"none", support:"Community",
    },
  },
  STARTER: {
    id:"STARTER", name:"Starter", highlighted:false,
    description:"For small teams getting structured.",
    priceMonthly:1200, priceAnnual:960,
    stripePriceId:       process.env.STRIPE_PRICE_STARTER_MONTHLY || null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_STARTER_ANNUAL  || null,
    seats:10,
    limits:{
      projects:5, users:10, storage:"10 GB",
      aiReports:false, wordExport:false, evm:true,
      fullGovernance:false, executiveDash:false, portfolio:false,
      automations:5, sso:false, whiteLabel:false, m365:false,
      apiAccess:false, auditLog:"30d", support:"Email",
    },
  },
  PROFESSIONAL: {
    id:"PROFESSIONAL", name:"Professional", highlighted:true,
    description:"Full PM Standard PMO platform. The sweet spot.",
    priceMonthly:2200, priceAnnual:1760,
    stripePriceId:       process.env.STRIPE_PRICE_PRO_MONTHLY || null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL  || null,
    seats:-1,
    limits:{
      projects:-1, users:-1, storage:"100 GB",
      aiReports:true, wordExport:true, evm:true,
      fullGovernance:true, executiveDash:true, portfolio:true,
      automations:20, sso:false, whiteLabel:false, m365:true,
      apiAccess:true, auditLog:"1y", support:"Email",
    },
  },
  ENTERPRISE: {
    id:"ENTERPRISE", name:"Enterprise", highlighted:false,
    description:"For large PMOs with enterprise governance needs.",
    priceMonthly:3800, priceAnnual:3040,
    stripePriceId:       process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL  || null,
    seats:-1,
    limits:{
      projects:-1, users:-1, storage:"Unlimited",
      aiReports:true, wordExport:true, evm:true,
      fullGovernance:true, executiveDash:true, portfolio:true,
      automations:-1, sso:true, whiteLabel:true, m365:true,
      apiAccess:true, auditLog:"unlimited", support:"Dedicated CSM",
    },
  },
  CONSULTANT: {
    id:"CONSULTANT", name:"Consultant", highlighted:false,
    description:"1 consultant, unlimited client workspaces. $99/mo flat.",
    priceMonthly:9900, priceAnnual:7900,
    stripePriceId:       process.env.STRIPE_PRICE_CONSULTANT_MONTHLY || null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_CONSULTANT_ANNUAL  || null,
    seats:1,
    limits:{
      projects:-1, users:-1, storage:"50 GB per workspace",
      aiReports:true, wordExport:true, evm:true,
      fullGovernance:true, executiveDash:true, portfolio:true,
      automations:-1, sso:false, whiteLabel:false, m365:true,
      apiAccess:true, auditLog:"1y", support:"Dedicated CSM",
    },
  },
}

export const PLAN_ORDER: PlanId[] = ["FREE","STARTER","PROFESSIONAL","ENTERPRISE","CONSULTANT"]

// ── Checkout session ──────────────────────────────────────────────────────

export async function createCheckoutSession({
  workspaceId, planId, billing, userId, userEmail, userName, successUrl, cancelUrl
}: {
  workspaceId:string; planId:PlanId; billing:"monthly"|"annual";
  userId:string; userEmail:string; userName:string|null;
  successUrl:string; cancelUrl:string;
}): Promise<string> {
  const plan = PLANS[planId]
  const priceId = billing === "annual" ? plan.stripePriceIdAnnual : plan.stripePriceId
  if (!priceId) throw new Error(`No Stripe price ID configured for ${planId} ${billing}`)

  const session = await stripe.checkout.sessions.create({
    mode:               "subscription",
    payment_method_types: ["card"],
    customer_email:     userEmail,
    line_items: [{ price:priceId, quantity:1 }],
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { workspaceId, planId, userId, billing },
    },
    metadata: { workspaceId, planId, userId, billing },
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  cancelUrl,
  })

  return session.url!
}

// ── Customer portal ────────────────────────────────────────────────────────

export async function createPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer:   customerId,
    return_url: returnUrl,
  })
  return session.url
}

// ── Plan limit checks ──────────────────────────────────────────────────────

export function checkPlanLimit(
  plan: PlanId,
  limit: keyof Plan["limits"],
  current: number
): { allowed:boolean; limit:number|boolean|string } {
  const planDef = PLANS[plan]
  const l = planDef.limits[limit]
  if (typeof l === "boolean") return { allowed:l, limit:l }
  if (typeof l === "string")  return { allowed:true, limit:l }
  if (l === -1)               return { allowed:true, limit:-1 }
  return { allowed:current < l, limit:l }
}
