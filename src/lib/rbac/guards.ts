// src/lib/rbac/guards.ts
// Drop-in permission guards for API routes and server actions

import { NextResponse } from "next/server"
import { can, canManageRole, mapDbRoleToRbac, type AnyRole, type Permission } from "./roles"
export { mapDbRoleToRbac }
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

export interface PermissionContext {
  userId:      string
  workspaceId: string
  role:        AnyRole   // kept for backwards compat
  userRole?:   AnyRole   // from ApiContext
}

// ─────────────────────────────────────────────
// RESOLVE USER ROLE IN WORKSPACE
// ─────────────────────────────────────────────

export async function resolveRole(
  userId:      string,
  workspaceId: string
): Promise<AnyRole | null> {
  // Check system admin flag first
  const user = await db.user.findUnique({
    where:  { id: userId },
    select: { email: true },
  })

  // System admins are stored in env (or a separate SystemAdmin table in production)
  const systemAdmins = (process.env.SYSTEM_ADMIN_EMAILS || "").split(",").map(e => e.trim())
  if (user && systemAdmins.includes(user.email)) return "SYSTEM_ADMIN"

  // Get workspace membership
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  })

  if (!member) return null
  return member.role as AnyRole
}

// ─────────────────────────────────────────────
// MAP workspace UserRole (DB enum) → RBAC AnyRole
// (mapDbRoleToRbac is defined in ./roles and re-exported above)
// ─────────────────────────────────────────────

function resolveRbacRole(ctx: PermissionContext): AnyRole {
  return mapDbRoleToRbac(((ctx as any).userRole || (ctx as any).role || "") as string)
}

// ─────────────────────────────────────────────
// MAIN PERMISSION GUARD
// Use in API route handlers:
//   const guard = await requirePermission(ctx, "projects:create")
//   if (guard) return guard
// ─────────────────────────────────────────────

export async function requirePermission(
  ctx:        PermissionContext,
  permission: Permission
): Promise<NextResponse | null> {
  const rbacRole = resolveRbacRole(ctx)
  const allowed  = can(rbacRole, permission)

  if (!allowed) {
    return NextResponse.json({
      error:      "Permission denied",
      code:       "FORBIDDEN",
      permission,
      role:       rbacRole,
      userRole:   (ctx as any).userRole || (ctx as any).role,
      message:    `Your role (${(ctx as any).userRole || (ctx as any).role}) does not have permission: ${permission}`,
    }, { status: 403 })
  }

  return null
}

// ─────────────────────────────────────────────
// PROJECT ACCESS GUARD
// Handles confidential projects + CLIENT role scoping
// ─────────────────────────────────────────────

export async function requireProjectAccess(
  ctx:       PermissionContext,
  projectId: string,
  mode:      "view" | "edit" = "view"
): Promise<NextResponse | null> {
  const project = await db.project.findUnique({
    where:   { id: projectId },
    select: {
      workspaceId: true,
      status:      true,
      members:     { where: { userId: ctx.userId }, select: { role: true } },
    },
  })

  if (!project || project.workspaceId !== ctx.workspaceId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const rbacRole     = resolveRbacRole(ctx)
  const isMember     = project.members.length > 0
  const isProjectPM  = project.members[0]?.role === "PROJECT_MANAGER" ||
                       project.members[0]?.role === "PM"
  const canViewAll   = can(rbacRole, "projects:view_all")
  const canViewConf  = can(rbacRole, "projects:view_confidential")

  // CLIENT: can only access projects they are explicitly added to
  if (rbacRole === "CLIENT" && !isMember) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  // Non-admins without view_all: must be a member
  if (!canViewAll && !isMember) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  // Edit mode checks
  if (mode === "edit") {
    const canEdit = can(rbacRole, "projects:edit") &&
      (canViewAll || isProjectPM)
    if (!canEdit) {
      return NextResponse.json({
        error: "You don't have permission to edit this project",
        code:  "FORBIDDEN",
      }, { status: 403 })
    }
  }

  return null
}

// ─────────────────────────────────────────────
// ROLE ASSIGNMENT GUARD
// Prevents privilege escalation
// ─────────────────────────────────────────────

export function requireCanAssignRole(
  actorRole:  AnyRole,
  targetRole: AnyRole
): NextResponse | null {
  if (!canManageRole(actorRole, targetRole)) {
    return NextResponse.json({
      error:   "You cannot assign a role equal to or above your own",
      code:    "PRIVILEGE_ESCALATION",
      your:    actorRole,
      target:  targetRole,
    }, { status: 403 })
  }
  return null
}

// ─────────────────────────────────────────────
// SESSION HELPER — get role from current session
// ─────────────────────────────────────────────

export async function getSessionRole(
  workspaceId: string
): Promise<{ userId: string; role: AnyRole } | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const role = await resolveRole(session.user.id, workspaceId)
  if (!role) return null

  return { userId: session.user.id, role }
}
