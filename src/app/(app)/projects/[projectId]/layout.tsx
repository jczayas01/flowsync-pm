// src/app/(app)/projects/[projectId]/layout.tsx
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ProjectShell } from '@/components/projects/ProjectShell'
import { TaskProvider } from '@/lib/context/TaskContext'

export async function generateMetadata({ params }: { params: { projectId: string } }) {
  const project = await db.project.findUnique({
    where:  { id: params.projectId },
    select: { name: true, code: true },
  })
  return { title: project ? `${project.code} ${project.name}` : 'Project' }
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params:   { projectId: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId:true, role:true },
  })
  if (!membership) redirect('/onboarding')

  const project = await db.project.findFirst({
    where: { id: params.projectId, workspaceId: membership.workspaceId },
    include: {
      phases:  { orderBy: { order:'asc' }, select: { id:true, name:true, status:true, order:true } },
      members: {
        include: { user: { select: { id:true, name:true, avatarUrl:true } } },
      },
      _count: { select: { tasks:true, risks:true, milestones:true, documents:true } },
    },
  })

  if (!project) notFound()

  return (
    <TaskProvider>
      <ProjectShell project={project as any} userRole={membership.role}>
        {children}
      </ProjectShell>
    </TaskProvider>
  )
}
