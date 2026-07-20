// src/app/api/auth/verify-email/route.ts
// GET — landing point of the link in the verification email.
// Valid token → mark user verified, send the welcome email, bounce to sign-in.
// Anything else → sign-in with an explanatory error flag.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashToken } from "@/lib/auth/verification"
import { sendEmail } from "@/lib/emails/templates"

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://flowsyncpm.com"
  const fail = NextResponse.redirect(`${base}/auth/signin?error=VerificationInvalid`)

  const raw = req.nextUrl.searchParams.get("token")
  if (!raw || raw.length < 32) return fail

  const token = await db.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { id: true, email: true, name: true, emailVerified: true } } },
  })
  if (!token || token.usedAt || token.expiresAt < new Date()) return fail

  await db.$transaction([
    db.emailVerificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: token.userId }, data: { emailVerified: new Date() } }),
  ])

  // Welcome email now that the address is real — fire-and-forget.
  if (!token.user.emailVerified) {
    const first = (token.user.name || "").split(" ")[0] || "there"
    sendEmail({
      to: token.user.email,
      subject: "Welcome to FlowSync PM — your first project in 60 seconds",
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <div style="font-size:18px;font-weight:700;color:#0D1B2A;margin-bottom:12px">Welcome, ${first} 👋</div>
        <p style="font-size:14px;color:#334155;line-height:1.65">Your two-month free trial of the full product just started. The fastest way to see what FlowSync PM can do: <strong>upload a project plan you already have</strong> — Word, Excel, or even a scanned PDF — and watch it become a live project with tasks, risks, and a Gantt.</p>
        <a href="${base}/dashboard" style="display:inline-block;background:#F59E0B;color:#0D1B2A;padding:11px 22px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;margin:10px 0">Open your workspace →</a>
        <p style="font-size:12px;color:#94A3B8;line-height:1.6">Questions? Just reply — a human reads this inbox.<br/>— Juan, founder of FlowSync PM</p>
      </div>`,
    }).catch(() => {})
  }

  return NextResponse.redirect(`${base}/auth/signin?verified=1`)
}
