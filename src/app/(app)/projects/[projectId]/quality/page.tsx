import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { QualityTab } from '@/components/projects/tabs/QualityTab'

export default async function QualityPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId:true }
  })
  const [qmp, checklists, tasks] = await Promise.all([
    db.qualityManagementPlan.findUnique({ where:{ projectId:params.projectId } }),
    db.qualityChecklist.findMany({
      where:   { projectId:params.projectId },
      orderBy: { createdAt:"asc" },
    }),
    db.task.findMany({
      where:  { projectId:params.projectId },
      select: { id:true, code:true, title:true },
      orderBy:{ sortOrder:"asc" },
    }),
  ])
  return (
    <QualityTab
      projectId={params.projectId}
      workspaceId={membership?.workspaceId||""}
      qmp={qmp as any}
      checklists={checklists as any}
      tasks={tasks as any}
    />
  )
}
