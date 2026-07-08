// src/lib/security/sessions.ts
// Advanced session management — concurrent limits, device tracking,
// forced re-auth, revocation, and role-based session lifetimes

import { db } from "@/lib/db"
import { randomBytes } from "crypto"
import type { AnyRole } from "@/lib/rbac/roles"

// Session lifetime by role sensitivity
export const SESSION_LIFETIMES: Record<string, number> = {
  SYSTEM_ADMIN:    30  * 60 * 1000,   // 30 minutes
  ADMIN:           60  * 60 * 1000,   // 1 hour
  SUPER_USER:      2   * 60 * 60 * 1000, // 2 hours
  PROGRAM_MANAGER: 8   * 60 * 60 * 1000, // 8 hours
  PROJECT_MANAGER: 8   * 60 * 60 * 1000, // 8 hours
  TEAM_MEMBER:     24  * 60 * 60 * 1000, // 24 hours
  READ_ONLY:       48  * 60 * 60 * 1000, // 48 hours
  CLIENT:          24  * 60 * 60 * 1000, // 24 hours
}

// Max concurrent sessions per role
export const MAX_SESSIONS: Record<string, number> = {
  SYSTEM_ADMIN:    2,
  ADMIN:           3,
  SUPER_USER:      5,
  PROGRAM_MANAGER: 5,
  PROJECT_MANAGER: 5,
  TEAM_MEMBER:     10,
  READ_ONLY:       10,
  CLIENT:          5,
}

// Actions requiring re-authentication (step-up auth)
export const SENSITIVE_ACTIONS = new Set([
  "billing:upgrade",
  "billing:cancel",
  "users:assign_admin_role",
  "users:assign_system_admin",
  "users:remove",
  "workspace:edit_settings",
  "workspace:manage_integrations",
  "projects:delete",
  "projects:set_confidential",
  "2fa:disable",
  "export:sensitive",
  "scim:configure",
])

export interface SessionInfo {
  id:           string
  userId:       string
  ipAddress:    string
  userAgent:    string
  deviceName:   string
  location:     string
  createdAt:    Date
  lastActiveAt: Date
  expiresAt:    Date
  isCurrent:    boolean
}

// ─────────────────────────────────────────────
// SESSION CREATION
// ─────────────────────────────────────────────

export async function createSession(
  userId:    string,
  role:      string,
  ipAddress: string,
  userAgent: string
): Promise<string> {
  const token    = randomBytes(32).toString("hex")
  const lifetime = SESSION_LIFETIMES[role] || SESSION_LIFETIMES.TEAM_MEMBER
  const expiresAt = new Date(Date.now() + lifetime)

  // Enforce concurrent session limit
  const maxSessions = MAX_SESSIONS[role] || 5
  const existing = await db.session.findMany({
    where:   { userId, expires: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
  })

  if (existing.length >= maxSessions) {
    // Revoke oldest session(s)
    const toRevoke = existing.slice(0, existing.length - maxSessions + 1)
    await db.session.deleteMany({
      where: { id: { in: toRevoke.map(s => s.id) } },
    })
  }

  await db.session.create({
    data: {
      userId,
      sessionToken: token,
      expires:      expiresAt,
      ipAddress,
      userAgent,
    },
  })

  // Log session creation in audit
  await db.auditLog.create({
    data: {
      workspaceId: "system",
      userId,
      action:      "session.created",
      entityType:  "session",
      entityId:    token.slice(0, 8) + "...",
      after:       { ipAddress, role } as any,
    },
  }).catch(() => {})

  return token
}

// ─────────────────────────────────────────────
// SESSION REVOCATION
// ─────────────────────────────────────────────

export async function revokeSession(sessionToken: string, revokedBy: string): Promise<void> {
  await db.session.delete({ where: { sessionToken } }).catch(() => {})
  await db.auditLog.create({
    data: {
      workspaceId: "system",
      userId:      revokedBy,
      action:      "session.revoked",
      entityType:  "session",
      entityId:    sessionToken.slice(0, 8) + "...",
    },
  }).catch(() => {})
}

export async function revokeAllSessions(
  userId:         string,
  exceptToken?:   string,
  revokedBy?:     string
): Promise<number> {
  const where: any = {
    userId,
    ...(exceptToken && { sessionToken: { not: exceptToken } }),
  }
  const result = await db.session.deleteMany({ where })

  await db.auditLog.create({
    data: {
      workspaceId: "system",
      userId:      revokedBy || userId,
      action:      "session.revoked_all",
      entityType:  "user",
      entityId:    userId,
      after:       { count: result.count } as any,
    },
  }).catch(() => {})

  return result.count
}

// Revoke all sessions when user is removed from workspace
export async function revokeWorkspaceSessions(
  userId:      string,
  workspaceId: string
): Promise<void> {
  // In production: invalidate workspace-scoped tokens via Redis
  // For now: revoke all sessions (user re-authenticates)
  await revokeAllSessions(userId, undefined, workspaceId)
}

// ─────────────────────────────────────────────
// STEP-UP AUTHENTICATION (re-auth for sensitive actions)
// ─────────────────────────────────────────────

const stepUpTokens = new Map<string, { userId: string; expiresAt: number; action: string }>()

export function requiresStepUp(action: string): boolean {
  return SENSITIVE_ACTIONS.has(action)
}

export function issueStepUpToken(userId: string, action: string): string {
  const token = randomBytes(16).toString("hex")
  stepUpTokens.set(token, {
    userId,
    action,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 min validity
  })
  return token
}

export function validateStepUpToken(token: string, userId: string, action: string): boolean {
  const entry = stepUpTokens.get(token)
  if (!entry) return false
  if (entry.userId !== userId) return false
  if (entry.action !== action) return false
  if (entry.expiresAt < Date.now()) {
    stepUpTokens.delete(token)
    return false
  }
  stepUpTokens.delete(token) // single use
  return true
}

// ─────────────────────────────────────────────
// SESSION LISTING (for "active sessions" UI)
// ─────────────────────────────────────────────

export async function listUserSessions(
  userId:       string,
  currentToken: string
): Promise<SessionInfo[]> {
  const sessions = await db.session.findMany({
    where:   { userId, expires: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  })

  return sessions.map(s => ({
    id:           s.id,
    userId:       s.userId,
    ipAddress:    s.ipAddress || "Unknown",
    userAgent:    s.userAgent || "Unknown",
    deviceName:   parseDevice(s.userAgent || ""),
    location:     "Unknown", // geo-lookup in production
    createdAt:    s.createdAt,
    lastActiveAt: s.createdAt, // update on each request in production
    expiresAt:    s.expires,
    isCurrent:    s.sessionToken === currentToken,
  }))
}

function parseDevice(ua: string): string {
  if (/iPhone|iPad/i.test(ua))     return "📱 iOS device"
  if (/Android/i.test(ua))         return "📱 Android device"
  if (/Mac/i.test(ua))             return "💻 Mac"
  if (/Windows/i.test(ua))         return "💻 Windows PC"
  if (/Linux/i.test(ua))           return "🖥 Linux"
  return "🌐 Browser"
}
