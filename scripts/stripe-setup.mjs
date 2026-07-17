#!/usr/bin/env node
// scripts/stripe-setup.mjs
// One-shot: creates the FlowSync PM products and prices in Stripe and prints the
// env vars to paste into Vercel. Safe to re-run — it finds existing products by
// name and existing prices by lookup_key instead of duplicating them.
//
// Usage:
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
//
// Run once against test keys, once against live keys.

import Stripe from "stripe"

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error("Set STRIPE_SECRET_KEY first:  STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs")
  process.exit(1)
}
const live = key.startsWith("sk_live_")
const stripe = new Stripe(key, { apiVersion: "2024-04-10" })

console.log(`\nStripe setup — ${live ? "⚠️  LIVE MODE" : "test mode"}\n`)

async function ensureProduct(name, description) {
  const existing = await stripe.products.search({ query: `name:"${name}" AND active:"true"` })
  if (existing.data[0]) { console.log(`  = product exists: ${name}`); return existing.data[0] }
  const p = await stripe.products.create({ name, description })
  console.log(`  + product created: ${name}`)
  return p
}

async function ensurePrice(product, lookupKey, unitAmount, interval, nickname) {
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 })
  if (existing.data[0]) { console.log(`  = price exists:   ${nickname} (${existing.data[0].id})`); return existing.data[0] }
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: unitAmount,
    recurring: { interval },
    lookup_key: lookupKey,
    nickname,
  })
  console.log(`  + price created:  ${nickname} (${price.id})`)
  return price
}

const starter = await ensureProduct(
  "FlowSync PM — Starter",
  "Flat per-user plan for small teams and independent PMs. $19/user/mo.",
)
const bizSeat = await ensureProduct(
  "FlowSync PM — Business (paid seat)",
  "Per-user seat for the roles that drive the work: sponsors, PMO directors, program & project managers, product owners, PMO analysts. $39/user/mo.",
)
const bizBundle = await ensureProduct(
  "FlowSync PM — Business (contributor bundle, 10 users)",
  "A bundle of 10 contributor/viewer users: team members, stakeholders, clients, external resources. $20/mo per bundle.",
)

// Annual prices are per-YEAR amounts (12 × discounted monthly).
const P = {}
P.STRIPE_PRICE_STARTER_MONTHLY         = await ensurePrice(starter,   "starter_monthly",          1900,        "month", "Starter $19/user/mo")
P.STRIPE_PRICE_STARTER_ANNUAL          = await ensurePrice(starter,   "starter_annual",           1520 * 12,   "year",  "Starter annual ($15.20/user/mo)")
P.STRIPE_PRICE_BUSINESS_SEAT_MONTHLY   = await ensurePrice(bizSeat,   "business_seat_monthly",    3900,        "month", "Business seat $39/user/mo")
P.STRIPE_PRICE_BUSINESS_SEAT_ANNUAL    = await ensurePrice(bizSeat,   "business_seat_annual",     3120 * 12,   "year",  "Business seat annual ($31.20/user/mo)")
P.STRIPE_PRICE_BUSINESS_BUNDLE_MONTHLY = await ensurePrice(bizBundle, "business_bundle_monthly",  2000,        "month", "Business bundle $20/10 users/mo")
P.STRIPE_PRICE_BUSINESS_BUNDLE_ANNUAL  = await ensurePrice(bizBundle, "business_bundle_annual",   1600 * 12,   "year",  "Business bundle annual ($16/10 users/mo)")

console.log(`\n──────────────────────────────────────────────────────
Paste these into Vercel → Settings → Environment Variables
──────────────────────────────────────────────────────\n`)
console.log(`STRIPE_SECRET_KEY=${key.slice(0, 12)}…   (you already have this one)`)
for (const [k, price] of Object.entries(P)) console.log(`${k}=${price.id}`)
console.log(`
Also required:
STRIPE_WEBHOOK_SECRET=whsec_…   ← from the webhook endpoint you create next

Webhook endpoint (Stripe Dashboard → Developers → Webhooks → Add endpoint):
  URL:    https://flowsyncpm.com/api/stripe/webhook
  Events: checkout.session.completed, customer.subscription.updated,
          customer.subscription.deleted, invoice.payment_succeeded,
          invoice.payment_failed, customer.subscription.trial_will_end

Optional (leave unset until configured in the dashboard):
STRIPE_AUTOMATIC_TAX=1   ← only after enabling Stripe Tax
STRIPE_REQUIRE_TOS=1     ← only after setting the Terms URL in Settings → Public details
`)
