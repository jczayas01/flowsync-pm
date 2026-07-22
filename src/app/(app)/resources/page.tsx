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

  const [members, projects, tasks, timeEntries] = await Promise.all([
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
    db.timeEntry.findMany({
      where: {
        project: { workspaceId: membership.workspaceId, AND:[vis] },
        date: { gte: new Date(Date.now() - 56*86400000) },
      },
      select: { userId:true, projectId:true, hours:true, date:true, billable:true },
    }),
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
      workspaceId={membership.workspaceId}
    />
  )
}
