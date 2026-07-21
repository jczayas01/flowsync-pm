// src/app/(app)/settings/layout.tssx — passes role + plan so the tab bar
// can hide what the person can't use (role) or hasn't bought (plan).
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { SettingsShell } from '@/components/settings/SettingsShell'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  const activeWs = (session.user as any).activeWorkspaceId as string | undefined
  const membership = await db.workspaceMember.findFirst({
    where:   { userId: session.user.id, ...(activeWs ? { workspaceId: activeWs } : {}) },
    include: { workspace: { select: { plan: true } } },
  })
  if (!membership) redirect('/onboarding')
  return (
    <SettingsShell role={String(membership.role)} plan={String(membership.workspace.plan)}>
      {children}
    </SettingsShell>
  )
}
