// src/app/(app)/projects/[projectId]/reports/page.tsx
import { db } from '@/lib//db'
import { auth } from '@/lib//auth'
import { redirect } from 'next/navigation'
import { ProjectReportsTab } from '@/components//projects/tabs/ProjectReportsTab'

export default async function ProjectReportsPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const [project, statusUpdates, members] = await Promise.all([
    db.project.findUnique({
      where:  { id: params.projectId },
      select: {
        id:true, name:true, code:true, health:true, status:true, methodology:true,
        percentComplete:true, startDate:true, endDate:true, priority:true,
        budgetTotal:true, budgetSpent:true, currency:true,
        objective:true, scope:true, outOfScope:true,
        background:true, assumptions:true, constraints:true, economicImpact:true,
        workspace: { select: { id:true, name:true, logoUrl:true, primaryColor:true } },
      },
    }),
    db.statusUpdate.findMany({
      where:   { projectId: params.projectId },
      orderBy: { createdAt: 'desc' },
      take:    20,
    }),
    db.projectMember.findMany({
      where:   { projectId: params.projectId },
      include: { user: { select:{ id:true, name:true } } },
    }),
  ])

  const serialized = project ? {
    ...project,
    budgetTotal: project.budgetTotal ? Number(project.budgetTotal) : 0,
    budgetSpent: project.budgetSpent ? Number(project.budgetSpent) : 0,
  } : null

  const reportTemplates = project?.workspace?.id
    ? await db.reportTemplate.findMany({
        where:   { workspaceId: project.workspace.id },
        select:  { id: true, name: true, description: true, audience: true, sections: true },
        orderBy: { createdAt: "desc" },
      })
    : []

  return (
    <ProjectReportsTab
      project={serialized as any}
      projectId={params.projectId}
      workspaceName={project?.workspace?.name || 'FlowSync PM'}
      workspaceLogo={project?.workspace?.logoUrl || undefined}
      statusUpdates={statusUpdates as any}
      members={members as any}
      reportTemplates={reportTemplates as any}
    />
  )
}
