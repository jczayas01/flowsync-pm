// src/app/auth/reset-password/page.tsx
import { Metadata } from 'next'
import { useTranslations } from 'next-intl'
import { AuthShell } from '@/components/auth/AuthShell'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export const metadata: Metadata = { title: 'Set a new password' }

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const ap = useTranslations('appPages')
  return (
    <AuthShell
      title={ap('resetTitle')}
      subtitle={ap('resetSubtitle')}
    >
      <ResetPasswordForm token={searchParams.token} />
    </AuthShell>
  )
}
