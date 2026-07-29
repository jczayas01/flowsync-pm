// src/app/(app)/projects/[projectId]/ai-overview/page.tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { ProjectAIOverviewTab } from "@/components/projects/tabs/ProjectAIOverviewTab"

export default async function ProjectAIOverviewPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId: true },
  })
  if (!membership) redirect("/onboarding")

  const project = await db.project.findFirst({
    where: { id: params.projectId, workspaceId: membership.workspaceId },
    select: { id: true },
  })
  if (!project) redirect("/projects")

  const documents = await db.document.findMany({
    where: { projectId: params.projectId, fileUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true },
    take: 60,
  })

  return (
    <ProjectAIOverviewTab
      projectId={params.projectId}
      workspaceId={membership.workspaceId}
      documents={documents.map(d => ({ id: d.id, name: d.name, createdAt: d.createdAt.toISOString() }))}
    />
  )
}
