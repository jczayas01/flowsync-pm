// src/app/invite/[token]/page.tsx
// Workspace invitation acceptance page (target of emailed / copied invite links)
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { AcceptInvite } from "@/components/invite/AcceptInvite"

export const metadata = { title: "Accept invitation" }

export default async function InvitePage({ params }: { params: { token: string } }) {
  const session = await auth()
  const invitation = await db.workspaceInvitation.findUnique({
    where:   { token: params.token },
    include: { workspace: { select: { name: true } } },
  }).catch(() => null)

  // Does this invited email already have an account? Decides whether the page
  // offers "create your account" or "sign in to accept".
  const hasAccount = invitation?.email
    ? !!(await db.user.findUnique({ where: { email: invitation.email.toLowerCase() }, select: { id: true } }).catch(() => null))
    : false

  const state = !invitation ? "not_found"
    : invitation.acceptedAt ? "accepted"
    : invitation.expiresAt < new Date() ? "expired"
    : "valid"

  return (
    <AcceptInvite
      token={params.token}
      state={state}
      workspaceName={invitation?.workspace?.name || ""}
      role={invitation?.role || ""}
      email={invitation?.email || ""}
      signedIn={!!session?.user?.id}
      signedInEmail={session?.user?.email || ""}
      hasAccount={hasAccount}
    />
  )
}
