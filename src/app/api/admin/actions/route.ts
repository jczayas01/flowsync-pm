// src/app/api/admin/actions/route.ts
// Operator actions for Platform Admin — change a plan, extend a trial, adjust
// seats, disable an account, or issue a password reset.
//
// Gated by PLATFORM_ADMIN_EMAILS, never by a workspace role: workspace roles are
// assignable inside the product, so gating on one would let any customer's Owner
// reach every other customer's data. Fails closed on an empty allowlist.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createHash, randomBytes } from "crypto"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendEmail, passwordResetEmail } from "@/lib/emails/templates"

const PLANS = ["FREE","STARTER","PRO","PROFESSIONAL","CONSULTANT","BUSINESS","ENTERPRISE"] as const

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setPlan"),     workspaceId: z.string(), plan: z.enum(PLANS) }),
  z.object({ action: z.literal("extendTrial"), workspaceId: z.string(), days: z.number().int().min(1).max(365) }),
  z.object({ action: z.literal("endTrial"),    workspaceId: z.string() }),
  z.object({ action: z.literal("setSeats"),    workspaceId: z.string(), seats: z.number().int().min(1).max(10000) }),
  z.object({ action: z.literal("toggleWorkspace"), workspaceId: z.string(), isActive: z.boolean() }),
  z.object({ action: z.literal("toggleUser"),  userId: z.string(), isActive: z.boolean() }),
  z.object({ action: z.literal("sendReset"),   userId: z.string() }),
])

async function requireAdmin() {
  const session = await auth()
  const allow = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
  const email = (session?.user?.email || "").toLowerCase()
  if (!session?.user?.id || !allow.length || !allow.includes(email)) return null
  return session
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Invalid request" }, { status: 400 })
  }
  const a = parsed.data

  try {
    switch (a.action) {
      case "setPlan": {
        const ws = await db.workspace.update({
          where: { id: a.workspaceId },
          data:  { plan: a.plan as any },
          select:{ name: true, plan: true },
        })
        return NextResponse.json({ data: { message: `${ws.name} is now on ${ws.plan}.` } })
      }

      case "extendTrial": {
        const current = await db.workspace.findUnique({
          where: { id: a.workspaceId }, select: { trialEndsAt: true, name: true },
        })
        if (!current) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
        // Extend from today when the trial has already lapsed, otherwise from its end date.
        const base = current.trialEndsAt && current.trialEndsAt > new Date() ? current.trialEndsAt : new Date()
        const trialEndsAt = new Date(base.getTime() + a.days * 864e5)
        await db.workspace.update({ where: { id: a.workspaceId }, data: { trialEndsAt } })
        return NextResponse.json({ data: {
          message: `${current.name}'s trial now ends ${trialEndsAt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}.`,
        } })
      }

      case "endTrial": {
        const ws = await db.workspace.update({
          where: { id: a.workspaceId }, data: { trialEndsAt: null }, select: { name: true },
        })
        return NextResponse.json({ data: { message: `${ws.name}'s trial cleared.` } })
      }

      case "setSeats": {
        const ws = await db.workspace.update({
          where: { id: a.workspaceId }, data: { seats: a.seats }, select: { name: true },
        })
        return NextResponse.json({ data: { message: `${ws.name} set to ${a.seats} seats.` } })
      }

      case "toggleWorkspace": {
        const ws = await db.workspace.update({
          where: { id: a.workspaceId }, data: { isActive: a.isActive }, select: { name: true },
        })
        return NextResponse.json({ data: { message: `${ws.name} ${a.isActive ? "enabled" : "disabled"}.` } })
      }

      case "toggleUser": {
        const u = await db.user.update({
          where: { id: a.userId }, data: { isActive: a.isActive }, select: { email: true },
        })
        return NextResponse.json({ data: { message: `${u.email} ${a.isActive ? "enabled" : "disabled"}.` } })
      }

      case "sendReset": {
        // Issue the same single-use token the public flow uses — the operator never
        // sees or sets the password, so this can't become a backdoor into an account.
        const u = await db.user.findUnique({
          where:  { id: a.userId },
          select: { id: true, email: true, name: true, accounts: { where: { provider: "EMAIL" }, select: { id: true } } },
        })
        if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 })
        if (!u.accounts.length) {
          return NextResponse.json({ error: "That account signs in with Microsoft or Google — it has no password to reset." }, { status: 400 })
        }

        await db.passwordResetToken.updateMany({
          where: { userId: u.id, usedAt: null }, data: { usedAt: new Date() },
        }).catch(() => {})

        const token = randomBytes(32).toString("hex")
        await db.passwordResetToken.create({
          data: {
            userId:    u.id,
            tokenHash: createHash("sha256").update(token).digest("hex"),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        })
        const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://flowsyncpm.com"
        const resetUrl = `${base.replace(/\/$/, "")}/auth/reset-password?token=${token}`
        const sent = await sendEmail({
          to: u.email,
          ...passwordResetEmail({ recipientName: u.name || "there", resetUrl }),
        })
        return NextResponse.json({ data: {
          message: sent ? `Reset link sent to ${u.email}.`
                        : `Token created, but the email failed to send — check RESEND_API_KEY.`,
        } })
      }
    }
  } catch (e: any) {
    console.error("[AdminAction]", a.action, e)
    return NextResponse.json({ error: e?.message || "Action failed" }, { status: 500 })
  }
}
