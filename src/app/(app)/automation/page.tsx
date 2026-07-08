// src/app/(app)/automation/page.tsx
import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { AutomationView } from "@/components/automation/AutomationView"

export const metadata: Metadata = { title: "Automation" }

export default async function AutomationPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")
  const m = await db.workspaceMember.findFirst({ where:{ userId: session.user.id }, select:{ workspaceId:true, role:true } })
  if (!m) redirect("/onboarding")

  const rows = await db.automationRule.findMany({ where:{ workspaceId: m.workspaceId }, orderBy:{ createdAt:"desc" } })
  const rules = rows.map((r:any)=>({
    id:r.id, name:r.name, trigger:r.trigger, condition:r.condition||"", action:r.action,
    isActive:r.isActive, runCount:r.runCount,
    lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : undefined,
    createdAt: r.createdAt.toISOString(),
  }))

  // Execution logs — populated as rules fire on live events.
  const logRows = await db.automationLog.findMany({
    where: { workspaceId: m.workspaceId }, orderBy: { createdAt: "desc" }, take: 50,
  })
  const recentLogs = logRows.map((l:any)=>({
    id: l.id, status: l.status,
    rule_name: l.ruleName,
    trigger_context: l.message || l.trigger,
    created_at: l.createdAt.toISOString(),
  }))

  return <AutomationView rules={rules as any} recentLogs={recentLogs} workspaceId={m.workspaceId} userRole={m.role} />
}
