// src/app/(app)/dashboard/page.tsx
import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projectVisibilityWhere } from '@/lib/security/project-visibility'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { mapDbRoleToRbac, ROLE_LEVEL } from '@/lib/rbac/roles'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id },
    select: { workspaceId: true, role: true },
  })
  if (!membership) redirect('/onboarding')

  // Client / Read-Only users land on My Tasks instead of the workspace dashboard
  if ((ROLE_LEVEL[mapDbRoleToRbac(membership.role)] ?? 0) < 30) redirect('/my-tasks')

  const workspaceId = membership.workspaceId
  // RBAC: dashboard aggregates respect the same visibility as /projects —
  // a MEMBER's dashboard only counts the projects they belong to.
  const vis = projectVisibilityWhere(session.user.id, membership.role)

  // Parallel data fetching
  const [projects, upcomingMilestones, openRisks, recentActivity] = await Promise.all([
    db.project.findMany({
      where:   { workspaceId, status: { in: ['ACTIVE','ON_HOLD'] }, AND: [vis] },
      include: {
        _count: { select: { tasks: true, risks: true } },
        members: {
          where:   { role: 'PM' as any },
          include: { user: { select: { name: true, avatarUrl: true } } },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),

    db.milestone.findMany({
      where: {
        project: { workspaceId, status: { in: ['ACTIVE','ON_HOLD'] }, AND: [vis] },
        status:  { in: ['UPCOMING','AT_RISK'] },
        dueDate: { gte: new Date(), lte: new Date(Date.now() + 30*86400000) },
      },
      include: { project: { select: { id:true, code:true, name:true } } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),

    db.risk.findMany({
      where:  { project: { workspaceId, status: { in: ['ACTIVE','ON_HOLD'] }, AND: [vis] }, status: 'OPEN', score: { gte: 9 } },
      include:{ project: { select: { id:true, code:true, name:true } } },
      orderBy:{ score: 'desc' },
      take: 8,
    }),

    db.auditLog.findMany({
      where:   { workspaceId, action: { in: ['project.created','project.updated','risk.created','user.invited'] as any } },
      include: { user: { select: { name:true, avatarUrl:true } } },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ])

  const healthCounts = {
    GREEN: projects.filter(p => p.health === 'GREEN').length,
    AMBER: projects.filter(p => p.health === 'AMBER').length,
    RED:   projects.filter(p => p.health === 'RED').length,
  }

  return (
    <DashboardView
      projects={projects.map(p => ({
        ...p,
        budgetTotal: p.budgetTotal ? Number(p.budgetTotal) : 0,
        budgetSpent: p.budgetSpent ? Number(p.budgetSpent) : 0,
      })) as any}
      milestones={upcomingMilestones as any}
      risks={openRisks as any}
      activity={recentActivity as any}
      healthCounts={healthCounts}
      workspaceId={workspaceId}
      userRole={membership.role}
    />
  )
}
