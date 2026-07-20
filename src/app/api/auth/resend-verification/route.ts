// src/app/api/auth/resend-verification/route.ts
// POST { email } — re-send the verification link. Always answers 200 with the
// same body so it can't be used to probe which emails exist; rate-limited hard.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { createVerificationToken, sendVerificationEmail } from "@/lib/auth/verification"
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limiter"

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const rl = checkRateLimit(ip, { keyPrefix: "resend-verify", windowMs: 15 * 60 * 1000, maxRequests: 5 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." },
      { status: 429, headers: rateLimitHeaders(rl) })
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 })

  const user = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true, email: true, name: true, emailVerified: true, isActive: true },
  })

  if (user && user.isActive && !user.emailVerified) {
    try {
      const raw = await createVerificationToken(user.id)
      await sendVerificationEmail(user.email, user.name, raw)
    } catch (e) { console.error("[ResendVerification]", e) }
  }

  // Uniform response regardless of account state.
  return NextResponse.json({ data: { sent: true } })
}
