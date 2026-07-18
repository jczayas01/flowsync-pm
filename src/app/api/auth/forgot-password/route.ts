// src/app/api/auth/forgot-password/route.ts
// POST — request a password reset link.
// Always responds 200 with the same body: revealing whether an email exists
// would turn this endpoint into an account-enumeration oracle.
export const dynamic = "force-dynamic"

import { SITE_URL } from "@/lib/site-url"
import { NextRequest, NextResponse } from "next/server"
import { createHash, randomBytes } from "crypto"
import { z } from "zod"
import { db } from "@/lib/db"
import { sendEmail, passwordResetEmail } from "@/lib/emails/templates"

const schema = z.object({ email: z.string().email() })

const TTL_MS = 60 * 60 * 1000 // 1 hour — matches the copy in the email template
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex")

const OK = NextResponse.json({
  data: { message: "If an account exists for that email, a reset link is on its way." },
})

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return OK // don't even confirm the format was wrong

    const email = parsed.data.email.toLowerCase().trim()

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true, name: true, isActive: true,
        accounts: { where: { provider: "EMAIL" }, select: { id: true } },
      },
    })

    // No user, deactivated, or OAuth-only (no password to reset) → silently stop.
    if (!user || !user.isActive || user.accounts.length === 0) return OK

    // Invalidate any outstanding tokens for this user — one live link at a time.
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data:  { usedAt: new Date() },
    }).catch(() => {})

    const token = randomBytes(32).toString("hex")
    await db.passwordResetToken.create({
      data: {
        userId:    user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    })

    const base = SITE_URL || process.env.NEXTAUTH_URL || "https://flowsyncpm.com"
    const resetUrl = `${base.replace(/\/$/, "")}/auth/reset-password?token=${token}`

    await sendEmail({
      to: email,
      ...passwordResetEmail({ recipientName: user.name || "there", resetUrl }),
    })

    return OK
  } catch (e) {
    console.error("[ForgotPassword]", e)
    return OK // never leak internals from this endpoint
  }
}
