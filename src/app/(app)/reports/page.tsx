// src/app/(app)/reports/page.tsx
import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { ReportBuilderView } from "@/components/reports/ReportBuilderView"

export const metadata: Metadata = { title: "Report builder" }

export default async function ReportsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId: true, role: true },
  })
  if (!membership) redirect("/onboarding")

  const templates = await db.reportTemplate.findMany({
    where:   { workspaceId: membership.workspaceId },
    include: { creator: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <ReportBuilderView
      workspaceId={membership.workspaceId}
      templates={templates as any}
      userRole={membership.role}
    />
  )
}
