// src/app/(app)/projects/[projectId]/team/page.tsx
import { db } from '@/lib/db'
import { ProjectTeamTab } from '@/components/projects/tabs/ProjectTeamTab'

export default async function ProjectTeamPage({ params }: { params: { projectId: string } }) {
  const [members, project] = await Promise.all([
    db.projectMember.findMany({
      where:   { projectId: params.projectId },
      include: { user: { select:{ id:true, name:true, email:true, avatarUrl:true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    db.project.findUnique({
      where:  { id: params.projectId },
      select: { workspaceId:true, methodology:true },
    }),
  ])

  const workspaceMembers = project
    ? await db.workspaceMember.findMany({
        where:   { workspaceId: project.workspaceId },
        include: { user: { select:{ id:true, name:true, email:true, avatarUrl:true } } },
      })
    : []

  const memberUserIds = new Set(members.map(m => m.userId))
  const availableToAdd = workspaceMembers
    .filter(wm => !memberUserIds.has(wm.userId))
    .map(wm => wm.user)

  return (
    <ProjectTeamTab
      projectId={params.projectId}
      members={members as any}
      availableToAdd={availableToAdd as any}
      methodology={project?.methodology || 'WATERFALL'}
    />
  )
}
