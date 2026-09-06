// src/app/(app)/portfolio/page.tsx
import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { canViewAllProjects } from '@/lib/security/project-visibility'
import { workspaceHasFeature } from '@/lib/security/plan-gates'
import { PortfolioView } from '@/components/portfolio/PortfolioView'

export const metadata: Metadata = { title: 'Portfolio' }

export default async function PortfolioPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId:true, role:true },
  })
  if (!membership) redirect('/onboarding')
  // Portfolio is a workspace-wide view — restricted to roles with
  // projects:view_all (matrix). Everyone else goes to their project list.
  if (!canViewAllProjects(membership.role)) redirect('/projects')
  // Plan gate: portfolio is a Business-tier feature (trial includes it).
  if (!(await workspaceHasFeature(membership.workspaceId, 'portfolio'))) redirect('/settings/billing')

  const portfolios = await db.portfolio.findMany({
    where: { workspaceId: membership.workspaceId },
    include: {
      owner: { select:{ id:true, name:true, avatarUrl:true } },
      programs: {
        include: {
          manager: { select:{ id:true, name:true, avatarUrl:true } },
          projects: {
            select: {
              id:true, code:true, name:true, health:true, status:true,
              percentComplete:true, budgetTotal:true, budgetSpent:true,
              startDate:true, endDate:true, methodology:true,
              // Same inputs the Programs page feeds rollupEvm, so the two
              // screens cannot report different completion for one project set.
              budget: { select: { id:true, plannedCost:true, earnedValue:true, earnRule:true } },
              tasks:  { select: { id:true, budgetItemId:true, startDate:true, dueDate:true,
                                  estimatedHours:true, status:true, completedAt:true },
                        where: { parentId: null } },
              members: {
                where: { role:'PM' as any }, take:1,
                include: { user: { select:{ name:true, avatarUrl:true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt:'asc' },
  })

  // Unassigned projects
  const unassigned = await db.project.findMany({
    where: {
      workspaceId: membership.workspaceId,
      programId:   null,
      status:      { in:['ACTIVE','ON_HOLD','DRAFT'] },
    },
    select: {
      id:true, code:true, name:true, health:true, status:true,
      percentComplete:true, budgetTotal:true, budgetSpent:true,
      startDate:true, endDate:true,
      budget: { select: { id:true, plannedCost:true, earnedValue:true, earnRule:true } },
      tasks:  { select: { id:true, budgetItemId:true, startDate:true, dueDate:true,
                          estimatedHours:true, status:true, completedAt:true },
                where: { parentId: null } },
    },
    orderBy: { createdAt:'desc' },
  })

  function serializeProjects(projs: any[]) {
    return projs.map(p => ({
      ...p,
      budgetTotal: p.budgetTotal ? Number(p.budgetTotal) : 0,
      budgetSpent: p.budgetSpent ? Number(p.budgetSpent) : 0,
      budgetItems: (p.budget ?? []).map((b: any) => ({
        id: b.id,
        plannedCost: b.plannedCost ? Number(b.plannedCost) : 0,
        earnedValue: b.earnedValue ? Number(b.earnedValue) : 0,
        earnRule:    b.earnRule ?? null,
      })),
      tasks: (p.tasks ?? []).map((t: any) => ({
        ...t, estimatedHours: t.estimatedHours ? Number(t.estimatedHours) : 0,
      })),
    }))
  }

  const serializedPortfolios = portfolios.map((port: any) => ({
    ...port,
    programs: port.programs.map((prog: any) => ({
      ...prog,
      projects: serializeProjects(prog.projects),
    })),
  }))

  const serializedUnassigned = serializeProjects(unassigned)

  return (
    <PortfolioView
      portfolios={serializedPortfolios as any}
      unassigned={serializedUnassigned as any}
      workspaceId={membership.workspaceId}
      userRole={membership.role}
    />
  )
}
