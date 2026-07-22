// src/app/api/invite/[token]/route.ts
// POST /api/invite/:token  — accept workspace invitation

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { fireTrigger } from "@/lib/automation/trigger"
import { ok, err } from "@/lib/api"
import { auth } from "@/lib/auth"

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const session = await auth()
  if (!session?.user?.id) {
    return err("Sign in to accept this invitation", 401)
  }

  const invitation = await db.workspaceInvitation.findUnique({
    where:   { token: params.token },
    include: { workspace: { select: { id: true, name: true } } },
  })

  if (!invitation)             return err("Invitation not found or already used", 404)
  if (invitation.acceptedAt)   return err("This invitation has already been accepted", 409)
  if (invitation.expiresAt < new Date()) return err("This invitation has expired", 410)

  // Verify email matches (case-insensitive)
  if (invitation.email.toLowerCase() !== session.user.email?.toLowerCase()) {
    return err(`This invitation was sent to ${invitation.email}. Please sign in with that account.`, 403)
  }

  // Add user to workspace
  await db.$transaction(async tx => {
    // Create or update membership
    await tx.workspaceMember.upsert({
      where:  { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: session.user.id } },
      create: { workspaceId: invitation.workspaceId, userId: session.user.id, role: invitation.role, invitedBy: invitation.invitedBy },
      update: { role: invitation.role },
    })

    // Mark invitation accepted
    await tx.workspaceInvitation.update({
      where: { id: invitation.id },
      data:  { acceptedAt: new Date() },
    })
  })

  fireTrigger("workspace.member_added", invitation.workspaceId, undefined, "user", session.user.id, invitation.invitedBy || undefined,
    { role: invitation.role, email: invitation.email })

  return ok({
    workspaceId:   invitation.workspaceId,
    workspaceName: invitation.workspace.name,
    role:          invitation.role,
    redirectTo:    `/dashboard`,
  })
}
