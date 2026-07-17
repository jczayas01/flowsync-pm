// src/app/api/m365/callback/route.ts
// GET — Microsoft redirects here after the user grants (or denies) M365 consent.
// Exchanges the code for tokens and stores them on the user's Microsoft account row.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const back = (req: NextRequest, status: string) =>
  NextResponse.redirect(new URL(`/settings/integrations?m365=${status}`, req.url))

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", req.url))
  }

  const params = req.nextUrl.searchParams
  const error  = params.get("error")
  const code   = params.get("code")
  const state  = params.get("state")

  // The user pressed Cancel, or Microsoft refused — surface it rather than hanging.
  if (error) {
    console.error("[M365] consent denied:", error, params.get("error_description"))
    return back(req, error === "access_denied" ? "denied" : "error")
  }
  if (!code || !state) return back(req, "error")

  // State must match the cookie AND belong to this user — otherwise someone could
  // hand a victim a crafted callback URL and bind their own mailbox to that account.
  const cookie = req.cookies.get("m365_state")?.value || ""
  const [savedState, savedUserId] = cookie.split(".")
  if (!savedState || savedState !== state || savedUserId !== session.user.id) {
    return back(req, "state_mismatch")
  }

  const clientId     = process.env.MICROSOFT_CLIENT_ID     || process.env.AZURE_AD_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || process.env.AZURE_AD_CLIENT_SECRET
  if (!clientId || !clientSecret) return back(req, "misconfigured")

  const base        = process.env.NEXTAUTH_URL || new URL(req.url).origin
  const redirectUri = `${base.replace(/\/$/, "")}/api/m365/callback`
  const tenant      = process.env.AZURE_AD_TENANT_ID || "common"

  try {
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        grant_type:    "authorization_code",
        code,
        redirect_uri:  redirectUri,
      }),
    })

    if (!res.ok) {
      console.error("[M365] token exchange failed:", await res.text())
      return back(req, "exchange_failed")
    }

    const t = await res.json() as {
      access_token: string; refresh_token?: string
      expires_in: number; token_type: string; scope?: string; id_token?: string
    }
    const expiresAt = new Date(Date.now() + t.expires_in * 1000)

    // Identify the Microsoft account this token belongs to.
    const me = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${t.access_token}` },
    }).then(r => r.ok ? r.json() : null).catch(() => null)

    const providerAccountId = me?.id || session.user.id

    // Attach to the existing Microsoft row when there is one (an SSO sign-in),
    // otherwise create one — a user who signs in with a password can still connect M365.
    const existing = await db.account.findFirst({
      where: { userId: session.user.id, provider: { in: ["microsoft-entra-id","azure-ad","AZURE_AD","MICROSOFT"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    })

    const tokenData = {
      access_token:   t.access_token,
      refresh_token:  t.refresh_token || null,
      expires_at:     Math.floor(expiresAt.getTime() / 1000),
      token_type:     t.token_type || "Bearer",
      scope:          t.scope || null,
      // Legacy columns kept in step — the Graph client reads either shape.
      accessToken:    t.access_token,
      refreshToken:   t.refresh_token || null,
      tokenExpiresAt: expiresAt,
      tenantId:       me?.id ? (process.env.AZURE_AD_TENANT_ID || null) : null,
    }

    if (existing) {
      await db.account.update({ where: { id: existing.id }, data: tokenData })
    } else {
      await db.account.create({
        data: {
          userId: session.user.id,
          type: "oauth",
          provider: "microsoft-entra-id",
          providerAccountId,
          ...tokenData,
        },
      })
    }

    const res2 = back(req, "connected")
    res2.cookies.delete("m365_state")
    return res2
  } catch (e) {
    console.error("[M365] callback error:", e)
    return back(req, "error")
  }
}
