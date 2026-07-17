// src/app/(app)/settings/integrations/page.tsx
import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { IntegrationsView } from "@/components/settings/IntegrationsView"

export const metadata: Metadata = { title: "Integrations" }
export const dynamic = "force-dynamic"

export default async function IntegrationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/settings/integrations")

  const m = await db.workspaceMember.findFirst({
    where: { userId: session.user.id },
    select: { workspaceId: true, role: true },
  })
  if (!m) redirect("/onboarding")

  // Read the account row directly rather than calling the status endpoint — this is a
  // server component, and a fetch back into our own API would just cost a round trip.
  const account = await db.account.findFirst({
    where: {
      userId: session.user.id,
      provider: { in: ["microsoft-entra-id", "azure-ad", "AZURE_AD", "MICROSOFT"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { scope: true, expires_at: true, tokenExpiresAt: true,
              access_token: true, accessToken: true, refresh_token: true, refreshToken: true },
  })

  const hasToken   = !!(account?.access_token || account?.accessToken)
  const hasRefresh = !!(account?.refresh_token || account?.refreshToken)
  const expiresAt  = account?.expires_at
    ? new Date(account.expires_at * 1000)
    : account?.tokenExpiresAt ?? null

  // Consent is only real if the mail/calendar scopes were actually granted. A plain
  // SSO sign-in produces a token too — it just can't do anything with Microsoft 365.
  const granted = (account?.scope || "").split(" ").filter(Boolean)
  const hasM365Scopes = granted.some(s => /^(Mail|Calendars|Tasks|OnlineMeetings)\./i.test(s))

  return (
    <IntegrationsView
      connected={hasToken && hasM365Scopes}
      signedInWithMicrosoft={hasToken}
      hasRefresh={hasRefresh}
      scopes={granted}
      expiresAt={expiresAt ? expiresAt.toISOString() : null}
      canManage={["OWNER", "ADMIN", "SUPER_ADMIN", "PMO_DIRECTOR"].includes(m.role)}
    />
  )
}
