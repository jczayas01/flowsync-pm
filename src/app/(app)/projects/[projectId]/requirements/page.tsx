import { db } from '@/lib//db'
import { auth } from '@/lib//auth'
import { redirect } from 'next/navigation'
import { RequirementsTab } from '@/components//projects/tabs/RequirementsTab'

export default async function RequirementsPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId:true }
  })
  const [requirements, tasks] = await Promise.all([
    db.requirement.findMany({
      where:{ projectId:params.projectId }, orderBy:{ code:"asc" },
      include:{ createdBy:{ select:{ id:true, name:true } } }
    }),
    db.task.findMany({
      where:{ projectId:params.projectId },
      select:{ id:true, code:true, title:true, status:true },
      orderBy:{ sortOrder:"asc" }
    }),
  ])
  return (
    <RequirementsTab
      projectId={params.projectId}
      workspaceId={membership?.workspaceId||""}
      requirements={requirements as any}
      tasks={tasks as any}
    />
  )
}
