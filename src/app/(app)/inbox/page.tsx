// src/app/(app)/inbox/page.tsx
// First-class home for the M365 Smart Inbox — project-related emails,
// meetings, and Teams mentions detected from the person's own Microsoft
// account, with one-click apply into the matched project. The same panel
// also remains at Settings → Integrations for setup context.
import { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { M365SmartInbox } from "@/components/settings/M365SmartInbox"

export const metadata: Metadata = { title: "Inbox" }
export const dynamic = "force-dynamic"

export default async function InboxPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/inbox")

  const activeWs = (session.user as any).activeWorkspaceId as string | undefined
  const m = await db.workspaceMember.findFirst({
    where: { userId: session.user.id, ...(activeWs ? { workspaceId: activeWs } : {}) },
    select: { workspaceId: true },
  })
  if (!m) redirect("/onboarding")

  const account = await db.account.findFirst({
    where: {
      userId: session.user.id,
      provider: { in: ["microsoft-entra-id", "azure-ad", "AZURE_AD", "MICROSOFT"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { scope: true, access_token: true, accessToken: true },
  })
  const granted = (account?.scope || "").split(" ").filter(Boolean)
  const connected = !!(account?.access_token || account?.accessToken) &&
    granted.some(s => /^(Mail|Calendars|Tasks|OnlineMeetings)\./i.test(s))

  return (
    <div style={{ padding: "24px 28px", maxWidth: 980 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
        📥 Inbox
      </h1>
      <p style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 14 }}>
        Project-related emails, meetings, and Teams mentions from your Microsoft account,
        matched to your projects — review and apply them without leaving FlowSync PM.
      </p>

      {connected ? (
        <M365SmartInbox connected />
      ) : (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12,
          padding: "22px 24px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
            Connect Microsoft 365 to fill this inbox
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6, marginBottom: 14 }}>
            Once connected, emails and meetings whose subject mentions a project
            (like "PRJ-001 kickoff") appear here with a one-click apply into that project.
          </p>
          <Link href="/settings/integrations"
            style={{ display: "inline-block", padding: "9px 18px", background: "var(--steel,#1B6CA8)",
              color: "#fff", borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
            Set up in Integrations →
          </Link>
        </div>
      )}
    </div>
  )
}
