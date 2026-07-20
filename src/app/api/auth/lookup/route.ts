// src/app/api/auth/lookup/route.ts
// POST — after a failed sign-in, tells the form WHY so it can point at the right door:
//   { status: "none" }                → no account: offer signup
//   { status: "oauth", provider }     → exists but has no password (Google/Microsoft)
//   { status: "password" }            → exists with a password: keep the generic error
//
// Deliberate tradeoff: this reveals whether an email has an account (enumeration).
// The registration endpoint already reveals the same thing ("account exists"), so
// the marginal exposure is minimal — and it is rate-limited hard below. The payoff
// is real: a Google-only user typing a password gets sent to the Google button
// instead of a dead "incorrect password" loop (which cost us a prospect today).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limiter"

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  // Tight limit: enough for a human fumbling a login, useless for scraping lists.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const rl = checkRateLimit(ip, { keyPrefix: "auth-lookup", windowMs: 15 * 60 * 1000, maxRequests: 10 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." },
      { status: 429, headers: rateLimitHeaders(rl) })
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 })

  const user = await db.user.findUnique({
    where:  { email: parsed.data.email.toLowerCase() },
    select: { emailVerified: true, accounts: { select: { provider: true } } },
  })

  if (!user) return NextResponse.json({ data: { status: "none" } })

  const providers = user.accounts.map(a => a.provider)
  if (providers.includes("EMAIL")) {
    // Password account that never confirmed its address — the form shows a
    // "verify your email" guide with a resend button instead of a dead
    // "incorrect password" loop.
    if (!user.emailVerified) {
      return NextResponse.json({ data: { status: "unverified" } })
    }
    return NextResponse.json({ data: { status: "password" } })
  }

  const oauth = providers.find(p => p !== "EMAIL") || ""
  const provider = oauth.toLowerCase().includes("google") ? "google" : "microsoft"
  return NextResponse.json({ data: { status: "oauth", provider } })
}
