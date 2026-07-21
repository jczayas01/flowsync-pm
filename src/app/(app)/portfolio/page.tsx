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
              endDate:true, methodology:true,
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
      percentComplete:true, budgetTotal:true, budgetSpent:true, endDate:true,
    },
    orderBy: { createdAt:'desc' },
  })

  function serializeProjects(projs: any[]) {
    return projs.map(p => ({
      ...p,
      budgetTotal: p.budgetTotal ? Number(p.budgetTotal) : 0,
      budgetSpent: p.budgetSpent ? Number(p.budgetSpent) : 0,
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
