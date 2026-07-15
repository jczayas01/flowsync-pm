// src/app/auth/forgot-password/page.tsx
import { Metadata } from 'next'
import { AuthShell } from '@/components/auth/AuthShell'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata: Metadata = { title: 'Reset your password' }

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a secure link to set a new one"
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
