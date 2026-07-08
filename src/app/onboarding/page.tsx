// src/app/onboarding/page.tsx
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export const metadata: Metadata = { title: 'Set up your workspace' }

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin?callbackUrl=/onboarding')

  // Already has workspace → go to dashboard
  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId: true },
  })
  if (membership) redirect('/dashboard')

  return (
    <OnboardingWizard
      userId={session.user.id}
      userName={session.user.name  || ''}
      userEmail={session.user.email || ''}
    />
  )
}
