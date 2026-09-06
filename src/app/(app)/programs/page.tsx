// src/app/(app)/programs/page.tsx
// Program Management — Portfolio → Program → Project (PM Standard — Portfolio Hierarchy)

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { can, mapDbRoleToRbac } from '@/lib/rbac/roles'
import { projectVisibilityWhere } from '@/lib/security/project-visibility'
import { ProgramsView } from '@/components/programs/ProgramsView'

export default async function ProgramsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const activeWs = (session.user as any).activeWorkspaceId as string | undefined
  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id, ...(activeWs ? { workspaceId: activeWs } : {}) },
    select: { workspaceId:true, role:true },
  })
  if (!membership) redirect('/onboarding')
  // Role gate mirrors the sidebar: programs:view (members are redirected).
  if (!can(mapDbRoleToRbac(membership.role), 'programs:view')) redirect('/projects')

  const programs = await db.program.findMany({
    where:   { portfolio:{ workspaceId: membership.workspaceId } },
    include: {
      portfolio: { select:{ id:true, name:true, color:true } },
      manager:   { select:{ id:true, name:true, avatarUrl:true } },
      projects:  {
        // RBAC: inside each program, non view-all roles only see their own
        // projects — names, health, and budget of others stay hidden.
        where: projectVisibilityWhere(session.user.id, membership.role),
        select: {
          id:true, code:true, name:true, health:true, status:true,
          percentComplete:true, budgetTotal:true, budgetSpent:true,
          startDate:true, endDate:true, methodology:true, priority:true,
          // Lines carry earned value; tasks phase the planned value. Both are
          // needed to roll EVM up with the same math the project page uses —
          // an elapsed-time shortcut here would disagree with its own children.
          budget: { select: { id:true, plannedCost:true, earnedValue:true, earnRule:true } },
          tasks:  { select: { id:true, budgetItemId:true, startDate:true, dueDate:true,
                              estimatedHours:true, status:true, completedAt:true },
                    where: { parentId: null } },
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
          budgetItems: (proj as any).budget?.map((b: any) => ({
            id: b.id,
            plannedCost:  b.plannedCost  ? Number(b.plannedCost)  : 0,
            earnedValue:  b.earnedValue  ? Number(b.earnedValue)  : 0,
            earnRule:     b.earnRule ?? null,
          })) ?? [],
          tasks: (proj as any).tasks?.map((t: any) => ({
            ...t, estimatedHours: t.estimatedHours ? Number(t.estimatedHours) : 0,
          })) ?? [],
        })),
      })) as any}
      portfolios={portfolios}
      unassignedProjects={unassignedProjects as any}
      workspaceId={membership.workspaceId}
      userRole={membership.role}
    />
  )
}
