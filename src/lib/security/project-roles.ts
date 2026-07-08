// src/lib/security/project-roles.ts
// Project-level role overrides and temporary access delegation

import { db } from "@/lib/db"
import { writeAuditLog } from "./audit"
import type { WorkspaceRole } from "@/lib/rbac/roles"

export interface ProjectRoleOverride {
  userId:          string
  projectId:       string
  workspaceRole:   WorkspaceRole   // their workspace-level role
  projectRole:     WorkspaceRole   // elevated role for this project only
  grantedBy:       string
  grantedAt:       Date
  expiresAt?:      Date            // delegation support
  reason?:         string
}

/**
 * Grant a user an elevated role on a specific project.
 * A TEAM_MEMBER at workspace level can be PROJECT_MANAGER on project X.
 */
export async function grantProjectRole(
  projectId:   string,
  userId:      string,
  role:        WorkspaceRole,
  grantedBy:   string,
  expiresAt?:  Date,
  reason?:     string
): Promise<void> {
  const workspaceId = await db.project.findUnique({
    where:  { id: projectId },
    select: { workspaceId: true },
  }).then(p => p?.workspaceId || "")

  // Upsert project member with elevated role
  await db.projectMember.upsert({
    where:  { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role: role as any, allocation: 100 },
    update: { role: role as any },
  })

  await writeAuditLog({
    workspaceId,
    userId:      grantedBy,
    action:      "project.member_added" as any,
    entityType:  "project_member",
    entityId:    `${projectId}:${userId}`,
    after: { role, expiresAt: expiresAt?.toISOString(), reason } as any,
  })
}

/**
 * Delegation — temporarily transfer PM role to another user.
 * Auto-expires after the delegation period.
 */
export interface DelegationRequest {
  projectId:   string
  fromUserId:  string
  toUserId:    string
  expiresAt:   Date
  reason:      string
}

// In-memory delegation store (use Redis in production)
const delegations = new Map<string, DelegationRequest>()

export function createDelegation(req: DelegationRequest): string {
  const key = `${req.projectId}:${req.fromUserId}:${req.toUserId}`
  delegations.set(key, req)
  return key
}

export function getActiveDelegation(
  projectId: string,
  toUserId:  string
): DelegationRequest | null {
  for (const [, d] of delegations) {
    if (d.projectId === projectId && d.toUserId === toUserId && d.expiresAt > new Date()) {
      return d
    }
  }
  return null
}

export function revokeDelegation(key: string): void {
  delegations.delete(key)
}

// Auto-cleanup expired delegations
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = new Date()
    for (const [key, d] of delegations) {
      if (d.expiresAt <= now) delegations.delete(key)
    }
  }, 60 * 1000)
}

/**
 * Get the effective role for a user on a project.
 * Considers workspace role, project-level override, and active delegations.
 */
export async function getEffectiveProjectRole(
  userId:      string,
  projectId:   string,
  workspaceId: string
): Promise<WorkspaceRole | null> {
  // 1. Check active delegation
  const delegation = getActiveDelegation(projectId, userId)
  if (delegation) return "PROJECT_MANAGER"

  // 2. Check project member role
  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  })
  if (member) return member.role as WorkspaceRole

  // 3. Fall back to workspace role
  const wsMember = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
  return (wsMember?.role as WorkspaceRole) || null
}
