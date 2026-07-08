import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { ProjectDocsTab } from "@/components/projects/tabs/ProjectDocsTab"
import { mapDbRoleToRbac } from "@/lib/rbac/roles"

export default async function ProjectDocsPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId:true, role:true }
  })
  if (!membership) redirect("/onboarding")

  const isClient = mapDbRoleToRbac(membership.role) === "CLIENT"

  const [project, rawDocuments, members] = await Promise.all([
    db.project.findUnique({
      where:  { id: params.projectId },
      select: {
        id:true, name:true, code:true, description:true,
        objective:true, scope:true, background:true,
        assumptions:true, constraints:true, outOfScope:true, economicImpact:true, priority:true, isConfidential:true,
        methodology:true, status:true, startDate:true, endDate:true,
        budgetTotal:true, currency:true,
        workspace: { select: { id:true, name:true, logoUrl:true } },
      },
    }),
    db.document.findMany({
      where:   { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { id:true, name:true, avatarUrl:true } } },
    }),
    db.projectMember.findMany({
      where:   { projectId: params.projectId },
      include: { user: { select: { id:true, name:true, avatarUrl:true } } },
      orderBy: { joinedAt: "asc" },
    }),
  ])

  // Shares fetched separately so a shares issue can never hide the document list
  const shareRows = await db.documentShare.findMany({
    where:  { document: { projectId: params.projectId } },
    select: { documentId: true, userId: true },
  }).catch(() => [] as { documentId:string; userId:string }[])
  const sharesByDoc: Record<string, { userId:string }[]> = {}
  for (const s of shareRows) (sharesByDoc[s.documentId] ||= []).push({ userId: s.userId })
  let documents = (rawDocuments as any[]).map(d => ({ ...d, shares: sharesByDoc[d.id] || [] }))
  if (isClient) {
    documents = documents.filter(d => d.sharedWithClient || d.shares.some((s:any) => s.userId === session.user.id))
  }

  return (
    <ProjectDocsTab
      projectId={params.projectId}
      workspaceId={membership.workspaceId}
      workspaceName={project?.workspace?.name || "FlowSync PM"}
      project={{ ...project, budgetTotal: project?.budgetTotal ? Number(project.budgetTotal) : 0 } as any}
      documents={documents as any}
      members={members as any}
    />
  )
}
