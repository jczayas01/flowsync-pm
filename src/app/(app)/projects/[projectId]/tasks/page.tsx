// src/app/(app)/projects/[projectId]/tasks/page.tsx
import { db } from '@/lib//db'
import { auth } from '@/lib//auth'
import { redirect } from 'next/navigation'
import { ProjectTasksTab } from '@/components//projects/tabs/ProjectTasksTab'

export default async function ProjectTasksPage({
  params, searchParams,
}: {
  params: { projectId: string }
  searchParams: { status?: string; assignee?: string; priority?: string; phase?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId:true }
  })

  const [tasks, phases, members] = await Promise.all([
    db.task.findMany({
      where: { projectId: params.projectId },
      orderBy: [{ phaseId:'asc' }, { sortOrder:'asc' }, { createdAt:'asc' }],
      include: {
        assignees: {
          include: { projectMember: { include: { user: { select:{ id:true, name:true, avatarUrl:true } } } } }
        },
        phase:        { select:{ id:true, name:true } },
        dependencies: { include: { precedingTask: { select:{ id:true, code:true, title:true, status:true } } } },
        _count:       { select:{ comments:true } },
      },
    }),
    db.phase.findMany({
      where:   { projectId: params.projectId },
      orderBy: { order:'asc' },
      select:  { id:true, name:true, status:true },
    }),
    db.projectMember.findMany({
      where:   { projectId: params.projectId },
      include: { user: { select:{ id:true, name:true, avatarUrl:true } } },
    }),
  ])

  return (
    <ProjectTasksTab
      projectId={params.projectId}
      workspaceId={membership?.workspaceId || ''}
      tasks={tasks as any}
      phases={phases}
      members={members as any}
      filters={searchParams}
    />
  )
}
