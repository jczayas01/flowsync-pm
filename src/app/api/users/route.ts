// src/app/api/users/route.ts
// GET  /api/users  — list workspace members with roles
// POST /api/users  — invite user to workspace

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  withWorkspace, ok, okList, err, parseBody,
  getSearchParams, audit, ApiContext,
} from "@/lib/api"
import {
  requirePermission, requireCanAssignRole, mapDbRoleToRbac,
  resolveRole,
} from "@/lib/rbac/guards"
import { assignableRoles, type WorkspaceRole } from "@/lib/rbac/roles"
import { Resend } from "resend"

const inviteSchema = z.object({
  email:     z.string().email(),
  name:      z.string().min(1).max(200).optional(),
  role:      z.enum(["OWNER","ADMIN","PMO_DIRECTOR","EXECUTIVE","PROGRAM_MANAGER","PM","MEMBER","VIEWER","CLIENT"]),
  projectId: z.string().min(1).optional(),  // for CLIENT role — scope to project
  message:   z.string().max(500).optional(),
})

async function listUsers(ctx: ApiContext) {
  const guard = await requirePermission(ctx as any, "users:view")
  if (guard) return guard

  const { page, perPage, skip, take, q } = getSearchParams(ctx.req)

  const where: any = {
    workspaceId: ctx.workspaceId,
    ...(q && {
      user: {
        OR: [
          { name:  { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
    }),
  }

  const [members, total] = await Promise.all([
    db.workspaceMember.findMany({
      where,
      skip, take,
      orderBy: { joinedAt: "asc" },
      include: {
        user: {
          select: {
            id: true, name: true, email: true,
            avatarUrl: true, lastLoginAt: true, isActive: true,
          },
        },
      },
    }),
    db.workspaceMember.count({ where }),
  ])

  // Enrich with project count per member
  const enriched = await Promise.all(members.map(async m => {
    const projectCount = await db.projectMember.count({
      where: {
        userId:  m.userId,
        project: { workspaceId: ctx.workspaceId },
      },
    })
    return { ...m, projectCount }
  }))

  return okList(enriched, total, page, perPage)
}

async function inviteUser(ctx: ApiContext) {
  const guard = await requirePermission(ctx as any, "users:invite")
  if (guard) return guard

  const parsed = await parseBody(ctx.req, inviteSchema)
  if ("error" in parsed) return parsed.error

  const { email, name, role, projectId, message } = parsed.data

  // Check actor can assign this role (map DB roles → RBAC for level comparison)
  const actorRole = mapDbRoleToRbac(ctx.userRole as any)
  const roleGuard = requireCanAssignRole(actorRole, mapDbRoleToRbac(role) as WorkspaceRole)
  if (roleGuard) return roleGuard

  // Check if user already in workspace
  const existing = await db.user.findUnique({
    where:   { email },
    include: { memberships: { where: { workspaceId: ctx.workspaceId } } },
  })

  if (existing?.memberships.length) {
    return err("This user is already a member of this workspace", 409)
  }

  // Get workspace for email
  const workspace = await db.workspace.findUnique({
    where:  { id: ctx.workspaceId },
    select: { name: true, logoUrl: true },
  })

  // Create invitation record
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const invitation = await db.workspaceInvitation.create({
    data: {
      workspaceId: ctx.workspaceId,
      email,
      role: role as any,
      expiresAt,
      invitedBy: ctx.userId,
    },
  })

  // Send invitation email
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`
    const inviter = await db.user.findUnique({
      where:  { id: ctx.userId },
      select: { name: true },
    })

    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL!,
      to:      email,
      subject: `You've been invited to ${workspace?.name} on FlowSync PM`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
          <div style="margin-bottom:24px">
            <span style="font-size:18px;font-weight:600;color:#0D1B2A">FlowSync</span>
            <span style="font-size:18px;font-weight:600;color:#F59E0B">PM</span>
          </div>
          <h2 style="color:#0D1B2A;margin-bottom:8px">You're invited!</h2>
          <p style="color:#475569;margin-bottom:6px">
            <strong>${inviter?.name || "Someone"}</strong> has invited you to join
            <strong>${workspace?.name}</strong> on FlowSync PM as a
            <strong>${role.replace("_"," ")}</strong>.
          </p>
          ${message ? `<p style="color:#64748B;font-style:italic;padding:12px;background:#F8FAFC;border-radius:6px;margin:12px 0">"${message}"</p>` : ""}
          <a href="${acceptUrl}"
            style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1B6CA8;color:#fff;border-radius:6px;text-decoration:none;font-weight:500">
            Accept invitation →
          </a>
          <p style="font-size:12px;color:#94A3B8;margin-top:16px">
            This invitation expires ${expiresAt.toDateString()}.
            If you didn't expect this, you can safely ignore this email.
          </p>
        </div>`,
    })
  } catch (e) {
    console.error("[Invite Email]", e)
    // Don't fail the request if email fails
  }

  await audit(ctx.workspaceId, ctx.userId, "user.invited", "invitation", invitation.id,
    undefined, { email, role })

  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/invite/${invitation.token}`
  return ok({ invitation: { id: invitation.id, email, role, expiresAt, acceptUrl } }, 201)
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, listUsers)
}
export async function POST(req: NextRequest) {
  return withWorkspace(req, inviteUser)
}
