// src/app/(app)/settings/workspace/page.tsx
import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { WorkspaceSettingsForm } from '@/components/settings/WorkspaceSettingsForm'

export const metadata: Metadata = { title: 'Workspace settings' }

export default async function WorkspaceSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await db.workspaceMember.findFirst({
    where:   { userId: session.user.id },
    include: { workspace: true },
  })
  if (!membership) redirect('/onboarding')

  return <WorkspaceSettingsForm workspace={membership.workspace as any} role={membership.role} />
}
