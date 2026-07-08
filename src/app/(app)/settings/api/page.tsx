// src/app/(app)/settings/api/page.tsx
import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { ApiDocsView } from "@/components/settings/ApiDocsView"

export const metadata: Metadata = { title: "API & integrations" }

export default async function ApiSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")
  const m = await db.workspaceMember.findFirst({ where:{ userId: session.user.id }, select:{ workspaceId:true, role:true } })
  if (!m) redirect("/onboarding")

  const rows = await db.apiKey.findMany({ where:{ workspaceId: m.workspaceId }, orderBy:{ createdAt:"desc" } })
  const apiKeys = rows.map((k:any)=>({
    id:k.id, name:k.name, prefix:k.prefix, scopes:k.scopes,
    isActive: !k.revokedAt, createdAt: k.createdAt.toISOString(),
  }))

  return <ApiDocsView apiKeys={apiKeys as any} workspaceId={m.workspaceId} role={m.role} />
}
