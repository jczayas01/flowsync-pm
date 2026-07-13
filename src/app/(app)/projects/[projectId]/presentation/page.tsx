// src/app/(app)/projects/[projectId]/presentation/page.tsx
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ProjectPresentationTab } from '@/components/projects/tabs/ProjectPresentationTab'

export default async function ProjectPresentationPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const project = await db.project.findUnique({
    where: { id: params.projectId },
    select: {
      id: true, name: true, code: true, health: true, percentComplete: true,
      budgetTotal: true, budgetSpent: true,
      workspace: { select: { id: true, name: true, primaryColor: true } },
      _count: { select: { tasks: true, risks: true, milestones: true } },
    },
  })
  if (!project) redirect('/projects')

  return (
    <ProjectPresentationTab
      projectId={project.id}
      workspaceId={project.workspace.id}
      project={JSON.parse(JSON.stringify(project))}
    />
  )
}
