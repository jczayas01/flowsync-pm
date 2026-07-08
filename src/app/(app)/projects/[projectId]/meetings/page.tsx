import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MeetingsTab } from '@/components/projects/tabs/MeetingsTab'

export default async function MeetingsPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId:true }
  })
  const [minutes, members] = await Promise.all([
    db.meetingMinutes.findMany({
      where:   { projectId: params.projectId },
      orderBy: { meetingDate: "desc" },
      include: { createdBy:{ select:{ id:true, name:true } } },
    }),
    db.projectMember.findMany({
      where:   { projectId: params.projectId },
      include: { user:{ select:{ id:true, name:true } } },
    }),
  ])
  return (
    <MeetingsTab
      projectId={params.projectId}
      workspaceId={membership?.workspaceId||""}
      minutes={minutes as any}
      members={members as any}
    />
  )
}
