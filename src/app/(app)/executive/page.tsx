// src/app/(app)/executive/page.tsx
// Executive Dashboard — C-Suite view
// Access: OWNER, ADMIN, PMO_DIRECTOR, EXECUTIVE_SPONSOR, STEERING_COMMITTEE roles

import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { workspaceHasFeature } from '@/lib/security/plan-gates'
import { ExecutiveDashboard } from '@/components/executive/ExecutiveDashboard'
import { can, mapDbRoleToRbac } from '@/lib/rbac/roles'

export const metadata: Metadata = { title: 'Executive Dashboard · FlowSync PM' }

export default async function ExecutivePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId:true, role:true },
  })
  if (!membership) redirect('/onboarding')

  // Access control — workspace-wide visibility roles (OWNER, ADMIN, PMO_DIRECTOR,
  // EXECUTIVE). Gate on the SAME permission the sidebar uses for the Executive nav
  // item (projects:view_all) so nav visibility and page access can't drift apart —
  // previously a hardcoded list here omitted EXECUTIVE, bouncing the very role the
  // dashboard is built for back to /dashboard.
  if (!can(mapDbRoleToRbac(membership.role), 'projects:view_all')) {
    redirect('/dashboard')
  }

  // Plan gate: executive dashboard is a Business-tier feature (trial included).
  if (!(await workspaceHasFeature(membership.workspaceId, 'executiveDash'))) redirect('/settings/billing')

  const workspaceId = membership.workspaceId
  const now = new Date()
  const thirtyDays  = new Date(now.getTime() + 30  * 86400000)
  const sixtyDays   = new Date(now.getTime() + 60  * 86400000)
  const ninetyDays  = new Date(now.getTime() + 90  * 86400000)

  const [
    projects,
    allRisks,
    milestones30,
    milestones60,
    milestones90,
    changeRequests,
    benefits,
    pendingBaselines,
    recentDecisions,
    budgetItems,
  ] = await Promise.all([
    // All active projects with full data
    db.project.findMany({
      where:   { workspaceId, status:{ in:['ACTIVE','ON_HOLD','DRAFT','PENDING_APPROVAL'] } },
      orderBy: { priority:'asc' },
      include: {
        _count:  { select:{ tasks:true, risks:true, members:true, changes:true } },
        approvalRequestedBy: { select: { name: true } },
        members: {
          where:   { projectRole:{ in:['PM','SPONSOR','EXECUTIVE_SPONSOR'] } },
          include: { user:{ select:{ id:true, name:true, avatarUrl:true } } },
          take: 3,
        },
        risks: {
          where:   { status:'OPEN', score:{ gte:9 } },
          orderBy: { score:'desc' },
          take: 3,
          select:  { id:true, title:true, score:true, isOpportunity:true },
        },
      },
    }),

    // All open risks across workspace
    db.risk.findMany({
      where:   { project:{ workspaceId }, status:'OPEN', isOpportunity:false },
      orderBy: { score:'desc' },
      take: 10,
      include: { project:{ select:{ id:true, code:true, name:true } } },
    }),

    // Milestones in next 30 days
    db.milestone.findMany({
      where: { project:{ workspaceId }, status:{ in:['UPCOMING','AT_RISK'] },
               dueDate:{ gte:now, lte:thirtyDays } },
      include:{ project:{ select:{ id:true, code:true, name:true } } },
      orderBy:{ dueDate:'asc' },
    }),

    // Milestones 31-60 days
    db.milestone.findMany({
      where: { project:{ workspaceId }, status:{ in:['UPCOMING','AT_RISK'] },
               dueDate:{ gte:thirtyDays, lte:sixtyDays } },
      include:{ project:{ select:{ id:true, code:true, name:true } } },
      orderBy:{ dueDate:'asc' },
    }),

    // Milestones 61-90 days
    db.milestone.findMany({
      where: { project:{ workspaceId }, status:{ in:['UPCOMING','AT_RISK'] },
               dueDate:{ gte:sixtyDays, lte:ninetyDays } },
      include:{ project:{ select:{ id:true, code:true, name:true } } },
      orderBy:{ dueDate:'asc' },
    }),

    // Change requests pending decision
    db.changeRequest.findMany({
      where:   { project:{ workspaceId }, status:{ in:['SUBMITTED','UNDER_REVIEW','APPROVED'] } },
      orderBy: [{ priority:'asc' }, { createdAt:'desc' }],
      include: { project:{ select:{ id:true, code:true, name:true } },
                 requestedBy:{ select:{ name:true } } },
      take: 15,
    }),

    // Benefits realization
    db.benefit.findMany({
      where:   { project:{ workspaceId } },
      include: { project:{ select:{ id:true, code:true, name:true } } },
    }),

    // Recent key decisions
    db.baseline.findMany({
      where: { isApproved: false, project: { workspaceId } },
      select: {
        id:true, name:true, budgetTotal:true, startDate:true, endDate:true, createdAt:true,
        project: { select:{ id:true, code:true, name:true } },
        createdBy: { select:{ name:true } },
      },
      orderBy: { createdAt:'desc' }, take: 20,
    }),
    db.decision.findMany({
      where:   { project:{ workspaceId } },
      orderBy: { madeAt:'desc' },
      take: 5,
      include: { project:{ select:{ id:true, code:true, name:true } },
                 madeBy:{ select:{ name:true } } },
    }),

    // Budget items for EVM
    db.budgetItem.findMany({
      where:   { project:{ workspaceId } },
      select:  { projectId:true, plannedCost:true, actualCost:true, earnedValue:true },
    }),
  ])

  // Serialize Decimals
  const serializedProjects = projects.map(p => ({
    ...p,
    budgetTotal: p.budgetTotal ? Number(p.budgetTotal) : 0,
    budgetSpent: p.budgetSpent ? Number(p.budgetSpent) : 0,
  }))

  const serializedBudget = budgetItems.map(b => ({
    ...b,
    plannedCost: Number(b.plannedCost || 0),
    actualCost:  Number(b.actualCost  || 0),
    earnedValue: Number(b.earnedValue || 0),
  }))

  const serializedCRs = changeRequests.map(cr => ({
    ...cr,
    budgetImpact: cr.budgetImpact ? Number(cr.budgetImpact) : null,
  }))

  return (
    <ExecutiveDashboard
      projects={serializedProjects as any}
      risks={allRisks as any}
      milestones={{ d30:milestones30 as any, d60:milestones60 as any, d90:milestones90 as any }}
      changeRequests={serializedCRs as any}
      benefits={benefits as any}
      decisions={recentDecisions as any}
      budgetItems={serializedBudget}
      pendingBaselines={JSON.parse(JSON.stringify(pendingBaselines)) as any}
      workspaceId={workspaceId}
    />
  )
}
