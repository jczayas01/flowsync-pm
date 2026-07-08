// src/app/(app)/templates/page.tsx
import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { TemplatesView } from '@/components/templates/TemplatesView'

export const metadata: Metadata = { title: 'Template marketplace' }

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: { q?: string; industry?: string; methodology?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId:true },
  })
  if (!membership) redirect('/onboarding')

  const workspaceTemplates = await db.template.findMany({
    where:   { workspaceId: membership.workspaceId },
    orderBy: { usageCount:'desc' },
  })

  return (
    <TemplatesView
      workspaceTemplates={workspaceTemplates as any}
      workspaceId={membership.workspaceId}
      filters={searchParams}
    />
  )
}
