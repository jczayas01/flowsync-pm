// src/app/auth/signup/page.tsx
import { Metadata } from 'next'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import { SignUpForm } from '@/components/auth/SignUpForm'
import { AuthShell } from '@/components/auth/AuthShell'
import { MetaPixel } from '@/components/marketing/MetaPixel'

export const metadata: Metadata = { title: 'Create account' }

export default function SignUpPage() {
  const ap = useTranslations('appPages')
  return (
    <>
    <MetaPixel />
    <AuthShell
      title={ap('signupTitle')}
      subtitle={ap('signupSubtitle')}
    >
      {/* useSearchParams inside SignUpForm requires a Suspense boundary at build */}
      <Suspense fallback={null}>
        <SignUpForm />
      </Suspense>
    </AuthShell>
    </>
  )
}
