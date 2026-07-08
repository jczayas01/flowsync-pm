// src/app/auth/signin/page.tsx
import { Metadata } from 'next'
import { SignInForm } from '@/components/auth/SignInForm'
import { AuthShell } from '@/components/auth/AuthShell'

export const metadata: Metadata = { title: 'Sign in' }

export default function SignInPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string }
}) {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your FlowSync PM workspace"
    >
      <SignInForm
        callbackUrl={searchParams.callbackUrl}
        error={searchParams.error}
      />
    </AuthShell>
  )
}
