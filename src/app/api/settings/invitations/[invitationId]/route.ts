// DELETE /api/settings/invitations/:invitationId — revoke a pending invitation
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, ApiContext } from "@/lib/api"

async function revoke(ctx: ApiContext, params?: Record<string, string>) {
  // Only workspace managers may revoke
  const me = await db.workspaceMember.findFirst({
    where: { workspaceId: ctx.workspaceId, userId: ctx.userId },
    select: { role: true },
  })
  if (!me || !["OWNER","ADMIN","PMO_DIRECTOR","SUPER_ADMIN"].includes(String(me.role)))
    return err("Not allowed", 403)

  const id = params?.invitationId
  if (!id) return err("Invitation ID required")
  const inv = await db.workspaceInvitation.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  })
  if (!inv) return notFound("Invitation")
  if (inv.acceptedAt) return err("Already accepted — remove the member instead", 409)

  await db.workspaceInvitation.delete({ where: { id } })
  return ok({ revoked: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { invitationId: string } }) {
  return withWorkspace(req, revoke, params)
}
