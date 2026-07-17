// src/app/auth/signup/page.tsx
import { Metadata } from 'next'
import { Suspense } from 'react'
import { SignUpForm } from '@/components/auth/SignUpForm'
import { AuthShell } from '@/components/auth/AuthShell'

export const metadata: Metadata = { title: 'Create account' }

export default function SignUpPage() {
  return (
    <AuthShell
      title="Get started free"
      subtitle="Create your FlowSync PM account — no credit card required"
    >
      {/* useSearchParams inside SignUpForm requires a Suspense boundary at build */}
      <Suspense fallback={null}>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  )
}
