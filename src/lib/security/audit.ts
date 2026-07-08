// src/lib/security/audit.ts
// Comprehensive audit logging for enterprise compliance requirements
// Every security-relevant event is recorded here

import { db } from "@/lib/db"

export type AuditAction =
  // Authentication
  | "auth.login_success"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.session_expired"
  | "auth.password_changed"
  | "auth.password_reset_requested"
  | "auth.password_reset_completed"
  | "auth.2fa_enabled"
  | "auth.2fa_disabled"
  | "auth.2fa_failed"
  | "auth.2fa_backup_code_used"
  | "auth.account_locked"
  | "auth.account_unlocked"
  // Access
  | "access.denied"
  | "access.confidential_project_viewed"
  | "access.sensitive_action_stepup"
  // Users
  | "user.created"
  | "user.updated"
  | "user.deactivated"
  | "user.reactivated"
  | "user.invited"
  | "user.removed"
  | "user.role_changed"
  | "user.session_revoked"
  | "user.all_sessions_revoked"
  // Projects
  | "project.created"
  | "project.updated"
  | "project.archived"
  | "project.deleted"
  | "project.confidential_set"
  | "project.confidential_removed"
  | "project.member_added"
  | "project.member_removed"
  // Data
  | "data.exported"
  | "data.exported_sensitive"
  | "data.downloaded"
  | "data.uploaded"
  | "data.deleted"
  // Billing
  | "billing.subscribed"
  | "billing.cancelled"
  | "billing.payment_failed"
  | "billing.plan_changed"
  // Workspace
  | "workspace.settings_changed"
  | "workspace.branding_changed"
  | "workspace.integration_connected"
  | "workspace.integration_disconnected"
  // System
  | "session.created"
  | "session.revoked"
  | "session.revoked_all"
  | "system.ip_allowlist_changed"
  | "system.2fa_policy_changed"

export interface AuditEntry {
  workspaceId:  string
  userId?:      string
  action:       AuditAction
  entityType:   string
  entityId:     string
  ipAddress?:   string
  userAgent?:   string
  before?:      Record<string, unknown>
  after?:       Record<string, unknown>
  metadata?:    Record<string, unknown>
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      workspaceId: entry.workspaceId,
      userId:      entry.userId,
      action:      entry.action,
      entityType:  entry.entityType,
      entityId:    entry.entityId,
      ipAddress:   entry.ipAddress,
      userAgent:   entry.userAgent,
      before:      entry.before as any,
      after:       entry.after  as any,
    },
  }).catch(e => console.error("[Audit]", e))
}

export interface AuditQueryOptions {
  workspaceId:  string
  userId?:      string
  action?:      AuditAction | AuditAction[]
  entityType?:  string
  entityId?:    string
  from?:        Date
  to?:          Date
  page?:        number
  perPage?:     number
}

export async function queryAuditLog(opts: AuditQueryOptions) {
  const page    = opts.page    || 1
  const perPage = opts.perPage || 50
  const skip    = (page - 1) * perPage

  const where: any = {
    workspaceId: opts.workspaceId,
    ...(opts.userId     && { userId:     opts.userId }),
    ...(opts.entityType && { entityType: opts.entityType }),
    ...(opts.entityId   && { entityId:   opts.entityId }),
    ...(opts.action && {
      action: Array.isArray(opts.action)
        ? { in: opts.action }
        : opts.action,
    }),
    ...(opts.from || opts.to) && {
      createdAt: {
        ...(opts.from && { gte: opts.from }),
        ...(opts.to   && { lte: opts.to   }),
      },
    },
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      skip,
      take:    perPage,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
    db.auditLog.count({ where }),
  ])

  return { logs, total, page, perPage, totalPages: Math.ceil(total / perPage) }
}

// Security-critical actions that must always be logged
// regardless of workspace audit settings
export const CRITICAL_ACTIONS = new Set<AuditAction>([
  "auth.login_failed",
  "auth.account_locked",
  "auth.2fa_disabled",
  "auth.2fa_backup_code_used",
  "access.denied",
  "access.confidential_project_viewed",
  "user.role_changed",
  "user.removed",
  "user.all_sessions_revoked",
  "project.deleted",
  "project.confidential_set",
  "data.exported_sensitive",
  "billing.cancelled",
  "system.ip_allowlist_changed",
  "system.2fa_policy_changed",
])
