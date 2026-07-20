// src/app/(app)/projects/page.tsx
import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projectVisibilityWhere } from '@/lib/security/project-visibility'
import { ProjectsView } from '@/components/projects/ProjectsView'

export const metadata: Metadata = { title: 'Projects' }

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; method?: string; health?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const activeWs = (session.user as any).activeWorkspaceId as string | undefined
  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id, ...(activeWs ? { workspaceId: activeWs } : {}) },
    select: { workspaceId:true, role:true },
  })
  if (!membership) redirect('/onboarding')

  const where: any = {
    workspaceId: membership.workspaceId,
    // RBAC: non view-all roles only see projects they created / belong to
    // (PROGRAM_MANAGER also sees projects in programs they manage).
    // Kept inside AND so the search OR below can't clobber it.
    AND: [projectVisibilityWhere(session.user.id, membership.role)],
    ...(searchParams.status && { status: searchParams.status }),
    ...(searchParams.method && { methodology: searchParams.method }),
    ...(searchParams.health && { health: searchParams.health }),
    ...(searchParams.q && {
      OR: [
        { name:        { contains: searchParams.q, mode:'insensitive' } },
        { description: { contains: searchParams.q, mode:'insensitive' } },
        { code:        { contains: searchParams.q, mode:'insensitive' } },
      ],
    }),
  }

  const projects = await db.project.findMany({
    where,
    include: {
      _count:  { select: { tasks:true, risks:true, members:true } },
      members: {
        where:   { role: 'PM' as any },
        include: { user: { select: { id:true, name:true, avatarUrl:true } } },
        take: 1,
      },
      phases: {
        orderBy: { order:'asc' },
        select:  { id:true, name:true, status:true, order:true },
      },
    },
    orderBy: { updatedAt:'desc' },
  })

  const serializedProjects = projects.map(p => ({
    ...p,
    budgetTotal: p.budgetTotal ? Number(p.budgetTotal) : 0,
    budgetSpent: p.budgetSpent ? Number(p.budgetSpent) : 0,
  }))

  return (
    <ProjectsView
      projects={serializedProjects as any}
      workspaceId={membership.workspaceId}
      userRole={membership.role}
      filters={searchParams}
    />
  )
}
