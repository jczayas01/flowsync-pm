// src/app/api/m365/authorize/route.ts
// GET — start the Microsoft 365 consent flow.
//
// Why this is separate from sign-in: sign-in asks only for identity, so a new user
// sees a one-line consent screen. Mail, calendar and task access is a deliberate,
// separate decision the user makes when they want the integration — and Microsoft
// only issues a refresh token carrying the scopes that were actually consented to,
// which is why a refresh can never quietly escalate them.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { auth } from "@/lib/auth"

/** Scopes a normal user can grant themselves — no tenant admin required. */
/* Not exported: Next.js route files may only export handlers and route config. */
const USER_CONSENT_SCOPES = [
  "openid", "profile", "email", "offline_access",
  "User.Read",
  "Mail.Read",              // tag project email
  "Calendars.Read",         // detect project meetings
  "OnlineMeetings.Read",    // Teams meeting metadata
  "Tasks.ReadWrite",        // Planner / To Do sync
]

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin?callbackUrl=/settings/integrations", req.url))
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(new URL("/settings/integrations?m365=misconfigured", req.url))
  }

  const base = process.env.NEXTAUTH_URL || new URL(req.url).origin
  const redirectUri = `${base.replace(/\/$/, "")}/api/m365/callback`

  // Signed-ish state: random value paired to the user, round-tripped via cookie.
  const state = randomBytes(16).toString("hex")

  // "common" lets both work and personal accounts consent; a single-tenant app
  // should pin its own tenant instead.
  const tenant = process.env.AZURE_AD_TENANT_ID || "common"
  const url = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`)
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("response_mode", "query")
  url.searchParams.set("scope", USER_CONSENT_SCOPES.join(" "))
  url.searchParams.set("state", state)
  // Force the consent screen so the user sees exactly what they're granting.
  url.searchParams.set("prompt", "consent")

  const res = NextResponse.redirect(url.toString())
  res.cookies.set("m365_state", `${state}.${session.user.id}`, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/",
  })
  return res
}
