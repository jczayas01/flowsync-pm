// src/app/auth/forgot-password/page.tsx
import { Metadata } from 'next'
import { useTranslations } from 'next-intl'
import { AuthShell } from '@/components/auth/AuthShell'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata: Metadata = { title: 'Reset your password' }

export default function ForgotPasswordPage() {
  const ap = useTranslations('appPages')
  return (
    <AuthShell
      title={ap('forgotTitle')}
      subtitle={ap('forgotSubtitle')}
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
