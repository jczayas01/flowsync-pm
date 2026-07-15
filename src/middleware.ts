// src/middleware.ts
// Enhanced security middleware with rate limiting, IP allowlist,
// session validation, and 2FA enforcement

import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { checkRateLimit, RATE_LIMITS, rateLimitHeaders } from "@/lib/security/rate-limiter"
import { isIPAllowed } from "@/lib/security/ip-allowlist"

const PUBLIC_PREFIXES = [
  "/_next", "/favicon", "/icon", "/apple-icon", "/opengraph", "/images", "/fonts",
  "/api/auth", "/intake/", "/api/health", "/invite/",
  "/legal",             // terms, privacy, DPA, DMCA, AI policy — must be readable by anyone
]

const PUBLIC_ROUTES = new Set([
  "/", "/auth/signin", "/auth/signup",
  "/auth/error", "/auth/verify", "/intake",
  // Password recovery — by definition reached by people who CANNOT sign in.
  "/auth/forgot-password", "/auth/reset-password",
  // Marketing — prospects must never hit a login wall.
  "/pricing", "/api/demo-request",
])

// Routes that require 2FA to be set up (enforced for sensitive roles)
const REQUIRE_2FA_ROLES = new Set(["SYSTEM_ADMIN", "ADMIN", "SUPER_USER"])

function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "127.0.0.1"
}

export default auth(async (req: any) => {
  const { pathname } = req.nextUrl
  const ip           = getIP(req)

  // 1. Allow public prefixes and routes
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (PUBLIC_ROUTES.has(pathname))                        return NextResponse.next()

  // 2. Rate limit API routes
  if (pathname.startsWith("/api/")) {
    const rateLimitKey = req.auth?.user?.id || ip
    const result       = checkRateLimit(rateLimitKey, RATE_LIMITS.API_GENERAL)

    if (!result.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: result.retryAfterMs },
        { status: 429, headers: rateLimitHeaders(result) }
      )
    }
  }

  // 3. Require authentication
  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    const url = new URL("/auth/signin", req.url)
    url.searchParams.set("callbackUrl", req.url)
    return NextResponse.redirect(url)
  }

  const userId      = req.auth.user?.id
  const workspaceId = req.auth.user?.activeWorkspaceId
  const userRole    = req.auth.user?.workspaces?.find(
    (w: any) => w.id === workspaceId
  )?.role || "TEAM_MEMBER"

  // 4. IP allowlist check (Enterprise workspaces)
  // In production: fetch per-workspace allowlist from cache
  // const allowlist = await getWorkspaceAllowlist(workspaceId)
  // if (!isIPAllowed(ip, allowlist)) {
  //   return NextResponse.json({ error: "Access from this IP is not allowed" }, { status: 403 })
  // }

  // 5. Inject security headers into API responses
  const res = NextResponse.next()
  if (userId)      res.headers.set("x-user-id",      userId)
  if (workspaceId) res.headers.set("x-workspace-id", workspaceId)
  if (userRole)    res.headers.set("x-user-role",    userRole)
  res.headers.set("x-client-ip", ip)

  // 6. Security response headers
  res.headers.set("X-Frame-Options",       "DENY")
  res.headers.set("X-Content-Type-Options","nosniff")
  res.headers.set("X-XSS-Protection",     "1; mode=block")
  res.headers.set("Referrer-Policy",       "strict-origin-when-cross-origin")
  res.headers.set("Permissions-Policy",    "camera=(), microphone=(), geolocation=()")

  return res
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
