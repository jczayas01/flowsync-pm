// src/app/api/auth/2fa/route.ts
// GET  /api/auth/2fa         — get 2FA status
// POST /api/auth/2fa/setup   — initiate setup, return QR code
// POST /api/auth/2fa/confirm — confirm first TOTP token
// POST /api/auth/2fa/verify  — verify token during login
// POST /api/auth/2fa/disable — disable 2FA (requires valid token)

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limiter"
import {
  initiate2FASetup, confirm2FASetup,
  verify2FAToken, disable2FA,
} from "@/lib/security/two-factor"
import { writeAuditLog } from "@/lib/security/audit"

function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown"
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { db } = await import("@/lib/db")
  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { id: true, email: true },
  })

  // Check 2FA status from raw SQL (fields not yet in Prisma schema)
  const result = await db.$queryRaw<any[]>`
    SELECT
      two_factor_enabled,
      two_factor_confirmed_at,
      array_length(COALESCE(two_factor_backup_codes, ARRAY[]::text[]), 1) as backup_codes_remaining
    FROM users WHERE id = ${session.user.id}
  `.catch(() => [{}])

  const row = result[0] || {}

  return NextResponse.json({
    enabled:              row.two_factor_enabled || false,
    confirmedAt:          row.two_factor_confirmed_at || null,
    backupCodesRemaining: row.backup_codes_remaining || 0,
    email:                user?.email,
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url    = new URL(req.url)
  const action = url.searchParams.get("action") || "setup"
  const ip     = getIP(req)

  // Rate limit 2FA operations
  const limit = checkRateLimit(`2fa:${session.user.id}`, RATE_LIMITS.TWO_FA)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait before trying again.", lockedUntil: limit.lockedUntil },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.retryAfterMs || 0) / 1000)) } }
    )
  }

  const { db } = await import("@/lib/db")
  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { email: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  switch (action) {
    case "setup": {
      const setup = await initiate2FASetup(session.user.id, user.email)
      return NextResponse.json({
        secret:      setup.secret,
        qrCodeUrl:   setup.qrCodeUrl,
        otpauthUrl:  setup.otpauthUrl,
        backupCodes: setup.backupCodes,
      })
    }

    case "confirm": {
      const body  = await req.json()
      const token = body.token?.replace(/\s/g, "")
      if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 })

      const result = await confirm2FASetup(session.user.id, token)
      if (!result.success) {
        await writeAuditLog({ workspaceId: "system", userId: session.user.id,
          action: "auth.2fa_failed", entityType: "user", entityId: session.user.id,
          ipAddress: ip, metadata: { phase: "confirm" } as any })
        return NextResponse.json({ error: "Invalid token — please try again" }, { status: 400 })
      }

      await writeAuditLog({ workspaceId: "system", userId: session.user.id,
        action: "auth.2fa_enabled", entityType: "user", entityId: session.user.id,
        ipAddress: ip })

      return NextResponse.json({ success: true, backupCodes: result.backupCodes })
    }

    case "verify": {
      const body  = await req.json()
      const token = body.token?.replace(/\s/g, "")
      if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 })

      const valid = await verify2FAToken(session.user.id, token)
      if (!valid) {
        await writeAuditLog({ workspaceId: "system", userId: session.user.id,
          action: "auth.2fa_failed", entityType: "user", entityId: session.user.id,
          ipAddress: ip })
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    case "disable": {
      const body  = await req.json()
      const token = body.token?.replace(/\s/g, "")
      if (!token) return NextResponse.json({ error: "Token required to disable 2FA" }, { status: 400 })

      const disabled = await disable2FA(session.user.id, token)
      if (!disabled) {
        return NextResponse.json({ error: "Invalid token" }, { status: 400 })
      }

      await writeAuditLog({ workspaceId: "system", userId: session.user.id,
        action: "auth.2fa_disabled", entityType: "user", entityId: session.user.id,
        ipAddress: ip })

      return NextResponse.json({ success: true })
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }
}
