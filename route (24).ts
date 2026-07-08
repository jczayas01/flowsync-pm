// src/app/auth/error/page.tsx
'use client'
import Link from 'next/link'

const ERRORS: Record<string, string> = {
  Configuration: 'There is a server configuration error. Please contact support.',
  AccessDenied:  'You do not have permission to sign in.',
  Verification:  'The verification link has expired. Please request a new one.',
  Default:       'An authentication error occurred. Please try again.',
}

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const msg = ERRORS[searchParams.error || ''] || ERRORS.Default
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--surface)', fontFamily:'var(--font)' }}>
      <div style={{ maxWidth:400, width:'100%', padding:'0 24px', textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
        <h1 style={{ fontSize:20, fontWeight:600, color:'var(--text)', marginBottom:8 }}>
          Authentication error
        </h1>
        <p style={{ fontSize:14, color:'var(--text-3)', marginBottom:24, lineHeight:1.6 }}>{msg}</p>
        <Link href="/auth/signin"
          style={{ display:'inline-block', padding:'10px 20px', background:'var(--steel)',
            color:'#fff', borderRadius:'var(--radius)', textDecoration:'none', fontSize:14, fontWeight:500 }}>
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
