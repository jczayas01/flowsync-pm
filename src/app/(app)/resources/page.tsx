// src/app/(app)/resources/page.tsx
import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projectVisibilityWhere } from '@/lib/security/project-visibility'
import { ResourcesView } from '@/components/resources/ResourcesView'

export const metadata: Metadata = { title: 'Resource management' }

export default async function ResourcesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const activeWs = (session.user as any).activeWorkspaceId as string | undefined
  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id, ...(activeWs ? { workspaceId: activeWs } : {}) },
    select: { workspaceId:true, role:true },
  })
  if (!membership) redirect('/onboarding')

  // RBAC: capacity data is scoped like everything else — non view-all roles
  // (e.g. Project Managers) only see workload for projects they belong to.
  const vis = projectVisibilityWhere(session.user.id, membership.role)

    const [members, projects, tasks, doneTasks, timeEntries, loggedByUser] = await Promise.all([
    db.workspaceMember.findMany({
      where:   { workspaceId: membership.workspaceId },
      include: { user: { select:{ id:true, name:true, email:true, avatarUrl:true } } },
    }),
    db.projectMember.findMany({
      where:   { project: { workspaceId: membership.workspaceId, status:'ACTIVE', AND:[vis] } },
      include: {
        project: { select:{ id:true, code:true, name:true } },
        user:    { select:{ id:true, name:true } },
      },
    }),
    db.task.findMany({
      where: {
        project: { workspaceId: membership.workspaceId, status: 'ACTIVE', AND:[vis] },
        status: { notIn: ['DONE','CANCELLED'] as any },
      },
      select: {
        id:true, title:true, status:true, percentComplete:true,
        estimatedHours:true, remainingHours:true, startDate:true, dueDate:true,
        projectId:true, project:{ select:{ name:true, code:true } },
        assignees:{ select:{ userId:true } },
      },
    }),
    // Execution view needs finished work too — the open-tasks query above
    // deliberately excludes it, so completed tasks come separately rather than
    // widening the workload query and changing the heatmap's meaning.
    db.task.findMany({
      where: {
        project: { workspaceId: membership.workspaceId, status: 'ACTIVE', AND:[vis] },
        status: 'DONE' as any,
      },
      select: {
        id:true, status:true, estimatedHours:true, actualHours:true,
        dueDate:true, completedAt:true, updatedAt:true,
        assignees:{ select:{ userId:true } },
      },
    }),
    db.timeEntry.findMany({
      where: {
        project: { workspaceId: membership.workspaceId, AND:[vis] },
        date: { gte: new Date(Date.now() - 56*86400000) },
      },
      select: { userId:true, projectId:true, hours:true, date:true, billable:true },
    }),
    // All logged hours per user — the execution view reports lifetime totals,
    // not the 8-week window the heatmap uses.
    db.timeEntry.groupBy({
      by: ['userId'],
      where: { project: { workspaceId: membership.workspaceId, AND:[vis] } },
      _sum: { hours: true },
      _count: { _all: true },
    }).catch(() => [] as any[]),
  ])

  const serializedTimeEntries = timeEntries.map(t => ({
    ...t,
    hours: t.hours ? Number(t.hours) : 0,
  }))

  return (
    <ResourcesView
      members={members as any}
      projectAssignments={projects as any}
      tasks={JSON.parse(JSON.stringify(tasks)) as any}
      timeEntries={serializedTimeEntries as any}
      doneTasks={JSON.parse(JSON.stringify(doneTasks)) as any}
      loggedByUser={loggedByUser.map((g: any) => ({
        userId: g.userId,
        hours: g._sum?.hours ? Number(g._sum.hours) : 0,
        entries: g._count?._all ?? 0,
      })) as any}
      workspaceId={membership.workspaceId}
    />
  )
}
