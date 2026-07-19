// src/app/api/invite/[token]/register/route.ts
// POST — create an account AND accept the invitation in one step.
//
// Why this exists: sending an invited person to a generic sign-in page, then to
// signup, then back, loses people at every hop. The token already proves which
// email was invited, so we can register them right on the invite page.
//
// Security notes:
//  • The email is taken FROM THE INVITATION, never from the request body. A caller
//    cannot use someone else's invite to register an address of their choosing.
//  • Possession of the token is the invitation. That's the same assumption the
//    accept flow already makes, and why tokens expire.
//  • If the email already has an account we refuse and tell them to sign in —
//    registering over an existing account would be account takeover by invite.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { z } from "zod"
import { db } from "@/lib/db"
import { checkRateLimit } from "@/lib/security/rate-limiter"

const schema = z.object({
  name:     z.string().min(1).max(200),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const rl = checkRateLimit(ip, { keyPrefix: "invite-register", windowMs: 15 * 60 * 1000, maxRequests: 10 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Check the form and try again." },
      { status: 400 })
  }
  const { name, password } = parsed.data

  const invitation = await db.workspaceInvitation.findUnique({
    where:   { token: params.token },
    include: { workspace: { select: { id: true, name: true } } },
  }).catch(() => null)

  if (!invitation)                        return NextResponse.json({ error: "This invitation is invalid or was removed." }, { status: 404 })
  if (invitation.acceptedAt)              return NextResponse.json({ error: "This invitation was already accepted." }, { status: 409 })
  if (invitation.expiresAt < new Date())  return NextResponse.json({ error: "This invitation has expired. Ask for a new one." }, { status: 410 })

  const email = invitation.email.toLowerCase()

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return NextResponse.json(
      { error: "You already have an account with this email. Sign in to accept the invitation." },
      { status: 409 })
  }

  const hashed = await hash(password, 12)

  try {
    await db.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          emailVerified: new Date(),   // the invite email proved control of the address
          legalAcceptedAt: new Date(), // the join form shows the terms notice
          accounts: {
            // Same shape /api/auth/register writes — authorize() looks for
            // provider EMAIL and compares against accessToken.
            create: { provider: "EMAIL", providerAccountId: email, accessToken: hashed },
          },
        },
        select: { id: true },
      })

      await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId:      user.id,
          role:        invitation.role,
          invitedBy:   invitation.invitedBy,
        },
      })

      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data:  { acceptedAt: new Date() },
      })

      await tx.auditLog.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId:      user.id,
          action:      "user.joined_via_invite",
          entityType:  "workspace",
          entityId:    invitation.workspaceId,
        },
      }).catch(() => {})
    })

    // The client signs in with these; returning the email saves it guessing.
    return NextResponse.json({ data: { email, workspaceName: invitation.workspace.name } })
  } catch (e) {
    console.error("[invite/register]", e)
    return NextResponse.json({ error: "Couldn't create your account. Try again." }, { status: 500 })
  }
}
