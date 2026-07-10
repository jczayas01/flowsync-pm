import { db } from '@/lib//db'
import { auth } from '@/lib//auth'
import { redirect } from 'next/navigation'
import { ProjectProcurementTab } from '@/components//projects/tabs/ProjectProcurementTab'

export default async function ProcurementPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId:true }
  })

  const [items, members] = await Promise.all([
    db.procurementItem.findMany({
      where:   { projectId: params.projectId },
      include: {
        owner:     { select:{ id:true, name:true, avatarUrl:true } },
        createdBy: { select:{ id:true, name:true } },
      },
      orderBy: { createdAt:"desc" },
    }),
    db.projectMember.findMany({
      where:   { projectId: params.projectId },
      include: { user:{ select:{ id:true, name:true, avatarUrl:true } } },
    }),
  ])

  return (
    <ProjectProcurementTab
      projectId={params.projectId}
      workspaceId={membership?.workspaceId || ''}
      items={items.map(i => ({ ...i, value: i.value ? Number(i.value) : null })) as any}
      members={members as any}
    />
  )
}
