// src/app/(app)/settings/webhooks/page.tsx
import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { WebhooksView } from "@/components/settings/WebhooksView"

export const metadata: Metadata = { title: "Webhooks" }

export default async function WebhooksPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")
  const m = await db.workspaceMember.findFirst({ where:{ userId: session.user.id }, select:{ workspaceId:true, role:true } })
  if (!m) redirect("/onboarding")

  const rows = await db.webhook.findMany({ where:{ workspaceId: m.workspaceId }, orderBy:{ createdAt:"desc" } })
  const webhooks = rows.map((w:any)=>({
    id:w.id, url:w.url, events:w.events, isActive:w.isActive, secret:"",
    createdAt:w.createdAt.toISOString(),
    lastTriggeredAt: w.lastTriggeredAt ? w.lastTriggeredAt.toISOString() : undefined,
    successCount:w.successCount, errorCount:w.errorCount,
  }))

  return <WebhooksView webhooks={webhooks as any} workspaceId={m.workspaceId} role={m.role} />
}
