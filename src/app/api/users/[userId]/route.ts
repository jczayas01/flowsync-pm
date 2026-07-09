// src/app/api/users/[userId]/route.ts
// PATCH  /api/users/:id  — update role, deactivate
// DELETE /api/users/:id  — remove from workspace

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  withWorkspace, ok, err, notFound, parseBody, audit, ApiContext,
} from "@/lib/api"
import { requirePermission, requireCanAssignRole, resolveRole, mapDbRoleToRbac } from "@/lib/rbac/guards"
import type { WorkspaceRole } from "@/lib/rbac/roles"

const updateSchema = z.object({
  role:     z.enum(["OWNER","ADMIN","PMO_DIRECTOR","EXECUTIVE","PROGRAM_MANAGER","PM","MEMBER","VIEWER","CLIENT"]).optional(),
  isActive: z.boolean().optional(),
}).strict()

async function updateUser(ctx: ApiContext, params?: Record<string, string>) {
  const targetUserId = params?.userId
  if (!targetUserId) return err("User ID required")
  if (targetUserId === ctx.userId) return err("You cannot modify your own role", 400)

  const guard = await requirePermission(ctx as any, "users:assign_role")
  if (guard) return guard

  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error

  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId: targetUserId } },
  })
  if (!member) return notFound("User")

  if (parsed.data.role) {
    // Prevent privilege escalation (map DB roles → RBAC for level comparison)
    const roleGuard = requireCanAssignRole(mapDbRoleToRbac(ctx.userRole as any), mapDbRoleToRbac(parsed.data.role) as WorkspaceRole)
    if (roleGuard) return roleGuard

    // Cannot change role of someone with equal or higher access
    const targetRole = await resolveRole(targetUserId, ctx.workspaceId)
    if (targetRole) {
      const escalationGuard = requireCanAssignRole(mapDbRoleToRbac(ctx.userRole as any), mapDbRoleToRbac(targetRole as any) as WorkspaceRole)
      if (escalationGuard) return err("Cannot modify a user with equal or higher access level", 403)
    }
  }

  const before = { role: member.role }

  const updated = await db.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId: targetUserId } },
    data:  { ...(parsed.data.role && { role: parsed.data.role as any }) },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  // Deactivate user if requested (ADMIN+ only)
  if (parsed.data.isActive === false) {
    const deactivateGuard = await requirePermission(ctx as any, "users:remove")
    if (deactivateGuard) return deactivateGuard
    await db.user.update({ where: { id: targetUserId }, data: { isActive: false } })
  }

  await audit(ctx.workspaceId, ctx.userId, "user.role_changed", "user", targetUserId,
    before, { role: parsed.data.role })

  return ok(updated)
}

async function removeUser(ctx: ApiContext, params?: Record<string, string>) {
  const targetUserId = params?.userId
  if (!targetUserId) return err("User ID required")
  if (targetUserId === ctx.userId) return err("You cannot remove yourself", 400)

  const guard = await requirePermission(ctx as any, "users:remove")
  if (guard) return guard

  // Check target role — cannot remove someone with equal/higher access
  const targetRole = await resolveRole(targetUserId, ctx.workspaceId)
  if (targetRole) {
    const escalationGuard = requireCanAssignRole(ctx.userRole as any, targetRole)
    if (escalationGuard) return err("Cannot remove a user with equal or higher access level", 403)
  }

  await db.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId: targetUserId } },
  })

  await audit(ctx.workspaceId, ctx.userId, "user.removed", "user", targetUserId)
  return ok({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { userId: string } }) {
  return withWorkspace(req, updateUser, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { userId: string } }) {
  return withWorkspace(req, removeUser, params, ["SUPER_ADMIN","OWNER","ADMIN"] as any)
}
