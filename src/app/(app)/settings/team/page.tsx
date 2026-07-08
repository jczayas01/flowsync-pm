// src/app/(app)/settings/team/page.tsx
import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { TeamSettingsView } from '@/components/settings/TeamSettingsView'

export const metadata: Metadata = { title: 'Team members' }

export default async function TeamSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId:true, role:true },
  })
  if (!membership) redirect('/onboarding')

  const [members, invitations] = await Promise.all([
    db.workspaceMember.findMany({
      where:   { workspaceId: membership.workspaceId },
      include: { user: true },
      orderBy: { joinedAt:'asc' },
    }),
    db.workspaceInvitation.findMany({
      where:   { workspaceId: membership.workspaceId, acceptedAt: null,
                 expiresAt: { gt: new Date() } },
      orderBy: { createdAt:'desc' },
    }),
  ])

  return (
    <TeamSettingsView
      members={members as any}
      invitations={invitations as any}
      currentUserId={session.user.id}
      workspaceId={membership.workspaceId}
      role={membership.role}
    />
  )
}
