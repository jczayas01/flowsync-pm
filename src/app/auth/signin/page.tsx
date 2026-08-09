// src/app/auth/signin/page.tsx
import { Metadata } from 'next'
import { useTranslations } from 'next-intl'
import { SignInForm } from '@/components/auth/SignInForm'
import { AuthShell } from '@/components/auth/AuthShell'

export const metadata: Metadata = { title: 'Sign in' }

export default function SignInPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string }
}) {
  const ap = useTranslations('appPages')
  return (
    <AuthShell
      title={ap('signinTitle')}
      subtitle={ap('signinSubtitle')}
    >
      <SignInForm
        callbackUrl={searchParams.callbackUrl}
        error={searchParams.error}
      />
    </AuthShell>
  )
}
