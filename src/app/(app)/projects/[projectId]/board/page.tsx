// src/app/(app)/projects/[projectId]/board/page.tsx
import { db } from '@/lib/db'
import { ProjectBoardTab } from '@/components/projects/tabs/ProjectBoardTab'

export default async function ProjectBoardPage({ params }: { params: { projectId: string } }) {
  const tasks = await db.task.findMany({
    where:   { projectId: params.projectId, status: { not: 'CANCELLED' } },
    orderBy: { updatedAt:'desc' },
    include: {
      assignees: { include: { projectMember: { include: { user: { select:{ id:true, name:true, avatarUrl:true } } } } } },
      phase:     { select: { id:true, name:true } },
      _count:    { select: { comments:true } },
    },
  })

  const members = await db.projectMember.findMany({
    where:   { projectId: params.projectId },
    include: { user: { select: { id:true, name:true, avatarUrl:true } } },
  })

  return <ProjectBoardTab projectId={params.projectId} tasks={tasks as any} members={members as any} />
}
