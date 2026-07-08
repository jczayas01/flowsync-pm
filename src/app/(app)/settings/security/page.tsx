// src/app/(app)/settings/security/page.tsx
import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { SecuritySettingsView } from '@/components/settings/SecuritySettingsView'

export const metadata: Metadata = { title: 'Security' }

export default async function SecuritySettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId:true, role:true },
  })
  if (!membership) redirect('/onboarding')

  const auditLogs = await db.auditLog.findMany({
    where:   { workspaceId: membership.workspaceId },
    orderBy: { createdAt:'desc' },
    include: { user: { select:{ id:true, name:true, avatarUrl:true } } },
    take: 50,
  })

  return (
    <SecuritySettingsView
      userId={session.user.id}
      workspaceId={membership.workspaceId}
      role={membership.role}
      auditLogs={auditLogs as any}
    />
  )
}
