// src/app/api/stripe/ocr-packs/route.ts
// OCR add-on packs (+200 pages/mo, $10/mo each, stackable).
//
// GET  → { used, cap, packs, packPages, packPriceMonthly, purchasable }
// POST { packs } → sets the pack quantity on the workspace's active Stripe
//   subscription (adds/updates/removes the OCR line item, prorated). The
//   webhook is the source of truth for Workspace.ocrPageAddons; we also set
//   it optimistically so the cap moves immediately.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe, OCR_PACK_PRICE_ID, OCR_PACK_PRICE_MONTHLY } from "@/lib/stripe/client"
import { monthlyOcrPagesUsed, resolveOcrCap, OCR_PACK_PAGES } from "@/lib/ocr"

async function ctxWorkspace(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return null
  const wsId = req.headers.get("x-workspace-id") || undefined
  const member = await db.workspaceMember.findFirst({
    where: { userId: session.user.id, ...(wsId ? { workspaceId: wsId } : {}) },
    select: { workspaceId: true, role: true },
  })
  if (!member) return null
  return { session, member }
}

export async function GET(req: NextRequest) {
  const ctx = await ctxWorkspace(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const ws = await db.workspace.findUnique({
    where: { id: ctx.member.workspaceId },
    select: { plan: true, ocrPageAddons: true, stripeSubscriptionId: true },
  })
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })

  const [used, cap] = await Promise.all([
    monthlyOcrPagesUsed(ctx.member.workspaceId),
    resolveOcrCap(ctx.member.workspaceId, String(ws.plan)),
  ])
  return NextResponse.json({ data: {
    used, cap,
    packs: ws.ocrPageAddons,
    packPages: OCR_PACK_PAGES,
    packPriceMonthly: OCR_PACK_PRICE_MONTHLY,
    purchasable: !!(OCR_PACK_PRICE_ID && ws.stripeSubscriptionId && ws.plan !== "ENTERPRISE"),
    enterprise: ws.plan === "ENTERPRISE",
  }})
}

const postSchema = z.object({ packs: z.number().int().min(0).max(20) })

export async function POST(req: NextRequest) {
  const ctx = await ctxWorkspace(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "SYSTEM_ADMIN"].includes(ctx.member.role)) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 })
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  const { packs } = parsed.data

  const ws = await db.workspace.findUnique({
    where: { id: ctx.member.workspaceId },
    select: { plan: true, stripeSubscriptionId: true },
  })
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  if (ws.plan === "ENTERPRISE") {
    return NextResponse.json({ error: "Enterprise OCR caps are set in your contract — contact us." }, { status: 400 })
  }
  if (!OCR_PACK_PRICE_ID) {
    return NextResponse.json({ error: "OCR packs aren't available yet." }, { status: 503 })
  }
  if (!ws.stripeSubscriptionId) {
    return NextResponse.json({ error: "An active subscription is required — upgrade first in Billing." }, { status: 402 })
  }

  const sub = await stripe.subscriptions.retrieve(ws.stripeSubscriptionId)
  const existing = sub.items.data.find(i => i.price.id === OCR_PACK_PRICE_ID)

  if (packs === 0) {
    if (existing) await stripe.subscriptionItems.del(existing.id, { proration_behavior: "create_prorations" })
  } else if (existing) {
    await stripe.subscriptionItems.update(existing.id,
      { quantity: packs, proration_behavior: "create_prorations" })
  } else {
    await stripe.subscriptionItems.create({
      subscription: ws.stripeSubscriptionId,
      price: OCR_PACK_PRICE_ID,
      quantity: packs,
      proration_behavior: "create_prorations",
    })
  }

  await db.workspace.update({
    where: { id: ctx.member.workspaceId },
    data:  { ocrPageAddons: packs },
  })
  return NextResponse.json({ data: { packs } })
}
