import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ProjectRisksTab } from '@/components/projects/tabs/ProjectRisksTab'

export default async function ProjectRisksPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId:true }
  })

  const [risks, members] = await Promise.all([
    db.risk.findMany({
      where:   { projectId: params.projectId },
      orderBy: [{ score:'desc' }, { createdAt:'desc' }],
      include: { owner: { select:{ id:true, name:true, avatarUrl:true } } },
    }),
    db.projectMember.findMany({
      where:   { projectId: params.projectId },
      include: { user: { select:{ id:true, name:true, avatarUrl:true } } },
    }),
  ])

  return (
    <ProjectRisksTab
      projectId={params.projectId}
      risks={risks as any}
      members={members as any}
      workspaceId={membership?.workspaceId || ''}
    />
  )
}
