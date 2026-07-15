// src/app/api/auth/reset-password/route.ts
// POST — consume a reset token and set a new password.
// The bcrypt hash lives in Account.accessToken where provider = "EMAIL"
// (this app has no User.password column).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { hash } from "bcryptjs"
import { z } from "zod"
import { db } from "@/lib/db"

const schema = z.object({
  token:    z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex")
const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status })

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return bad(parsed.error.errors[0]?.message || "Invalid request.")
    }
    const { token, password } = parsed.data

    const record = await db.passwordResetToken.findUnique({
      where:  { tokenHash: sha256(token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    })

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return bad("This reset link is invalid or has expired. Please request a new one.")
    }

    const account = await db.account.findFirst({
      where:  { userId: record.userId, provider: "EMAIL" },
      select: { id: true },
    })
    if (!account) return bad("This account doesn't use a password. Try signing in with Microsoft or Google.")

    const hashed = await hash(password, 12)

    // Burn the token and set the new password together — a failure must not
    // leave a consumed token with an unchanged password (or vice versa).
    await db.$transaction([
      db.account.update({ where: { id: account.id }, data: { accessToken: hashed } }),
      db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ])

    return NextResponse.json({ data: { message: "Password updated. You can sign in now." } })
  } catch (e) {
    console.error("[ResetPassword]", e)
    return bad("Could not reset the password. Please try again.", 500)
  }
}
