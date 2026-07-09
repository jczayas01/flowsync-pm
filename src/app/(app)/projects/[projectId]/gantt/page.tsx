// src/app/(app)/projects/[projectId]/gantt/page.tsx
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ProjectGanttTab } from '@/components/projects/tabs/ProjectGanttTab'

export default async function ProjectGanttPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId:true }
  })

  const [tasks, phases, milestones, baselines, projectMembers] = await Promise.all([
    db.task.findMany({
      where:   { projectId: params.projectId },
      orderBy: [{ phaseId:'asc' }, { startDate:'asc' }],
      include: {
        phase:     { select: { id:true, name:true, order:true } },
        assignees: { include: { projectMember: { include: { user: { select:{ id:true, name:true, avatarUrl:true } } } } } },
        dependencies: { select: { id:true, precedingTaskId:true, dependencyType:true, lagDays:true,
          precedingTask: { select: { id:true, code:true, title:true, status:true } } } },
      },
    }),
    db.phase.findMany({ where:{ projectId:params.projectId }, orderBy:{ order:'asc' } }),
    db.milestone.findMany({ where:{ projectId:params.projectId }, orderBy:{ dueDate:'asc' } }),
    db.baseline.findMany({ where:{ projectId:params.projectId }, orderBy:{ createdAt:'desc' }, take:3 }),
    db.projectMember.findMany({
      where:   { projectId: params.projectId },
      include: { user: { select:{ id:true, name:true, avatarUrl:true } } },
    }),
  ])

  const serializedBaselines = baselines.map(b => ({ ...b, budgetTotal: b.budgetTotal ? Number(b.budgetTotal) : 0 }))
  const serializedTasks = tasks.map(t => ({
    ...t,
    estimatedHours: t.estimatedHours ? Number(t.estimatedHours) : null,
    actualHours:    t.actualHours    ? Number(t.actualHours)    : null,
  }))

  return (
    <ProjectGanttTab
      projectId={params.projectId}
      tasks={serializedTasks as any}
      phases={phases as any}
      milestones={milestones as any}
      baselines={serializedBaselines as any}
      members={projectMembers as any}
    />
  )
}
