// src/lib/security/consent.ts
// Track ToS and Privacy Policy acceptance per user
// Required for GDPR, SOC2, enterprise compliance

import { db } from "@/lib/db"

export const CURRENT_TOS_VERSION     = "2026-01-15-v1.0"
export const CURRENT_PRIVACY_VERSION = "2026-01-15-v1.0"

export interface ConsentRecord {
  userId:          string
  tosVersion:      string
  privacyVersion:  string
  acceptedAt:      Date
  ipAddress:       string
  userAgent:       string
}

// In production: dedicated consent_records table in Prisma
// For now: store in audit log with action "consent.accepted"
export async function recordConsent(
  userId:    string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  await db.auditLog.create({
    data: {
      workspaceId: "system",
      userId,
      action:      "consent.accepted" as any,
      entityType:  "consent",
      entityId:    userId,
      ipAddress,
      userAgent,
      after: {
        tosVersion:     CURRENT_TOS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        acceptedAt:     new Date().toISOString(),
      } as any,
    },
  }).catch(e => console.error("[Consent]", e))
}

export async function getConsentStatus(userId: string): Promise<{
  hasConsented:    boolean
  tosVersion?:     string
  privacyVersion?: string
  acceptedAt?:     Date
  needsUpdate:     boolean
}> {
  const latest = await db.auditLog.findFirst({
    where:   { userId, action: "consent.accepted" as any },
    orderBy: { createdAt: "desc" },
  })

  if (!latest?.after) return { hasConsented: false, needsUpdate: true }

  const after = latest.after as any
  const needsUpdate =
    after.tosVersion     !== CURRENT_TOS_VERSION ||
    after.privacyVersion !== CURRENT_PRIVACY_VERSION

  return {
    hasConsented:    true,
    tosVersion:      after.tosVersion,
    privacyVersion:  after.privacyVersion,
    acceptedAt:      latest.createdAt,
    needsUpdate,
  }
}
