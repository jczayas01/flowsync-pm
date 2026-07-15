// src/app/auth/reset-password/page.tsx
import { Metadata } from 'next'
import { AuthShell } from '@/components/auth/AuthShell'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export const metadata: Metadata = { title: 'Set a new password' }

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password you don't use elsewhere"
    >
      <ResetPasswordForm token={searchParams.token} />
    </AuthShell>
  )
}
