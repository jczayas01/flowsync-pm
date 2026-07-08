// src/app/(app)/programs/page.tsx
// Program Management — Portfolio → Program → Project (PM Standard — Portfolio Hierarchy)

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { ProgramsView } from '@/components/programs/ProgramsView'

export default async function ProgramsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId:true, role:true },
  })
  if (!membership) redirect('/onboarding')

  const programs = await db.program.findMany({
    where:   { portfolio:{ workspaceId: membership.workspaceId } },
    include: {
      portfolio: { select:{ id:true, name:true, color:true } },
      manager:   { select:{ id:true, name:true, avatarUrl:true } },
      projects:  {
        select: {
          id:true, code:true, name:true, health:true, status:true,
          percentComplete:true, budgetTotal:true, budgetSpent:true,
          endDate:true, methodology:true, priority:true,
        },
      },
    },
    orderBy: { createdAt:'asc' },
  })

  const portfolios = await db.portfolio.findMany({
    where:   { workspaceId: membership.workspaceId },
    select:  { id:true, name:true, color:true },
    orderBy: { name:'asc' },
  })

  const unassignedProjects = await db.project.findMany({
    where:   { workspaceId: membership.workspaceId, programId: null,
               status:{ in:['ACTIVE','ON_HOLD','DRAFT'] } },
    select:  { id:true, code:true, name:true, health:true, status:true,
               percentComplete:true, methodology:true },
    orderBy: { updatedAt:'desc' },
  })

  return (
    <ProgramsView
      programs={programs.map(p => ({
        ...p,
        projects: p.projects.map(proj => ({
          ...proj,
          budgetTotal: proj.budgetTotal ? Number(proj.budgetTotal) : 0,
          budgetSpent: proj.budgetSpent ? Number(proj.budgetSpent) : 0,
        })),
      })) as any}
      portfolios={portfolios}
      unassignedProjects={unassignedProjects as any}
      workspaceId={membership.workspaceId}
      userRole={membership.role}
    />
  )
}
