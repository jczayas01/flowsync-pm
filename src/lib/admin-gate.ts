// src/lib/admin-gate.ts
// Platform-admin session gate, shared by /api/admin/* routes.
// Gated by PLATFORM_ADMIN_EMAILS (never a workspace role — those are
// customer-assignable). Fails closed on an empty allowlist.

import { auth } from "@/lib/auth"

export async function requirePlatformAdmin() {
  const session = await auth()
  const allow = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
  const email = (session?.user?.email || "").toLowerCase()
  if (!session?.user?.id || !allow.length || !allow.includes(email)) return null
  return session
}
