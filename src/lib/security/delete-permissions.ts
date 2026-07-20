// src/lib/security/delete-permissions.ts
// WHO MAY DELETE projects, programs, and portfolios — configurable per
// workspace by admins (Settings → Roles → Deletion permissions), stored in
// workspace.settings.deleteRoles. Falls back to safe defaults.
//
//   settings.deleteRoles = {
//     project:   ["SUPER_ADMIN","OWNER","ADMIN"],
//     program:   ["SUPER_ADMIN","OWNER","ADMIN"],
//     portfolio: ["SUPER_ADMIN","OWNER","ADMIN"],
//   }
//
// SUPER_ADMIN and OWNER are always allowed and cannot be removed — a
// workspace must never be able to lock its own owner out of cleanup.

import { db } from "@/lib/db"

export type DeletableEntity = "project" | "program" | "portfolio"

export const ALWAYS_DELETE_ROLES = ["SUPER_ADMIN", "OWNER"] as const
export const DEFAULT_DELETE_ROLES = ["SUPER_ADMIN", "OWNER", "ADMIN"] as const
// Roles an admin may grant deletion to (beyond the always-on ones).
export const ASSIGNABLE_DELETE_ROLES = ["ADMIN", "PMO_DIRECTOR", "PROGRAM_MANAGER", "PM"] as const

export function normalizeDeleteRoles(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.filter(r => typeof r === "string") : []
  const valid = list.filter(r =>
    (ASSIGNABLE_DELETE_ROLES as readonly string[]).includes(r))
  return Array.from(new Set([...ALWAYS_DELETE_ROLES, ...valid]))
}

export async function getDeleteRoles(workspaceId: string): Promise<Record<DeletableEntity, string[]>> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId }, select: { settings: true },
  })
  const cfg = ((ws?.settings as any)?.deleteRoles ?? {}) as Partial<Record<DeletableEntity, unknown>>
  const pick = (e: DeletableEntity) =>
    cfg[e] !== undefined ? normalizeDeleteRoles(cfg[e]) : [...DEFAULT_DELETE_ROLES]
  return { project: pick("project"), program: pick("program"), portfolio: pick("portfolio") }
}

export async function canDelete(
  workspaceId: string, userRole: string | null | undefined, entity: DeletableEntity,
): Promise<boolean> {
  if (!userRole) return false
  const roles = await getDeleteRoles(workspaceId)
  return roles[entity].includes(userRole)
}
