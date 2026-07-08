// src/app/(app)/projects/[projectId]/changes/page.tsx
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ProjectChangesTab } from "@/components/projects/tabs/ProjectChangesTab"

export default async function ProjectChangesPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId:true, role:true }
  })
  if (!membership) redirect("/onboarding")

  const [changeRequests, members] = await Promise.all([
    db.changeRequest.findMany({
      where:   { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
      include: {
        requestedBy: { select:{ id:true, name:true, avatarUrl:true } },
        approvedBy:  { select:{ id:true, name:true, avatarUrl:true } },
        _count:      { select:{ comments:true } },
      },
    }),
    db.projectMember.findMany({
      where:   { projectId: params.projectId },
      include: { user: { select:{ id:true, name:true, avatarUrl:true } } },
    }),
  ])

  return (
    <ProjectChangesTab
      projectId={params.projectId}
      workspaceId={membership.workspaceId}
      changeRequests={changeRequests.map(cr => ({
        ...cr,
        budgetImpact: cr.budgetImpact ? Number(cr.budgetImpact) : null,
      })) as any}
      members={members as any}
      currentUserId={session.user.id}
    />
  )
}
