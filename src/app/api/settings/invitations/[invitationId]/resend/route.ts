// src/app/api/settings/invitations/[invitationId]/resend/route.ts
// POST — re-send a pending workspace invitation. Extends expiry by 7 days and
// emails the SAME token (the original link keeps working — no dead links in
// the invitee's inbox). Manager-and-above only, same gate as revoke.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, ApiContext } from "@/lib/api"
import { SITE_URL } from "@/lib/site-url"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

async function resendInvite(ctx: ApiContext, params?: Record<string, string>) {
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
  if (inv.acceptedAt) return err("Already accepted", 409)

  // Fresh 7-day window from now.
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await db.workspaceInvitation.update({ where: { id: inv.id }, data: { expiresAt } })

  const [workspace, inviter] = await Promise.all([
    db.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { name: true } }),
    db.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
  ])
  const acceptUrl = `${SITE_URL}/invite/${inv.token}`

  try {
    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL!,
      to:      inv.email,
      replyTo: "support@flowsyncpm.com",
      subject: `Reminder: you've been invited to ${workspace?.name} on FlowSync PM`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
          <div style="margin-bottom:24px">
            <span style="font-size:18px;font-weight:600;color:#0D1B2A">FlowSync</span>
            <span style="font-size:18px;font-weight:600;color:#F59E0B">PM</span>
          </div>
          <h2 style="color:#0D1B2A;margin-bottom:8px">Your invitation is waiting</h2>
          <p style="color:#475569;margin-bottom:6px">
            <strong>${inviter?.name || "Someone"}</strong> invited you to join
            <strong>${workspace?.name}</strong> on FlowSync PM as a
            <strong>${String(inv.role).replace("_"," ")}</strong> — this is a friendly reminder.
          </p>
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
    console.error("[Resend Invite Email]", e)
    return err("Invitation updated but the email could not be sent — try again.", 502)
  }

  return ok({ resent: true, expiresAt })
}

export async function POST(req: NextRequest, { params }: { params: { invitationId: string } }) {
  return withWorkspace(req, resendInvite, params)
}
