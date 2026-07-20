// src/components/auth/SignInForm.tsx
"use client"
import { useTranslations } from "next-intl"
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import Link from 'next/link'

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: 'Incorrect email or password.',
  OAuthSignin:  'Could not sign in with that provider.',
  VerificationInvalid: 'That confirmation link is invalid or expired. Sign in attempt will offer a new one, or use the resend option below.',
  Default:      'Sign in failed. Please try again.',
}

export function SignInForm({ callbackUrl, error }: { callbackUrl?: string; error?: string }) {
  const t = useTranslations('auth')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [err, setErr]           = useState(error ? (ERROR_MESSAGES[error] || ERROR_MESSAGES.Default) : '')
  // After a failed password attempt, we look the email up so the message can point
  // at the right door: signup for unknown emails, the OAuth button for accounts
  // that have no password. Wrong-password stays deliberately generic.
  const [guide, setGuide]       = useState<null | { status:"none" } | { status:"oauth"; provider:string } | { status:"unverified" }>(null)
  const [resent, setResent]     = useState(false)
  // ?verified=1 — just clicked the email confirmation link
  const justVerified = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('verified') === '1' 
  const dest = callbackUrl || '/dashboard'
  // An invitee is joining someone else's workspace — telling them to "start a free
  // trial" describes the wrong thing entirely.
  const isInvite = (callbackUrl || '').startsWith('/invite/')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErr('')
    setGuide(null)
    const res = await signIn('credentials', { email, password, redirect:false })
    if (res?.error) {
      try {
        const r = await fetch('/api/auth/lookup', {
          method:'POST', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ email }),
        })
        const d = await r.json().catch(() => ({}))
        const status = d?.data?.status
        if (status === 'none')       { setGuide({ status:'none' }); setErr('') }
        else if (status === 'oauth') { setGuide({ status:'oauth', provider:d.data.provider }); setErr('') }
        else if (status === 'unverified') { setGuide({ status:'unverified' }); setErr('') }
        else                          setErr(ERROR_MESSAGES.CredentialsSignin)
      } catch { setErr(ERROR_MESSAGES.CredentialsSignin) }
      setLoading(false)
    }
    else window.location.href = dest
  }

  return (
    <div>
      {err && (
        <div style={{ background:'rgba(220,38,38,.15)', border:'1px solid rgba(220,38,38,.3)',
          color:'#FCA5A5', padding:'10px 14px', borderRadius:'var(--radius)',
          fontSize:13, marginBottom:16 }}>
          {err}
        </div>
      )}
      {guide?.status === 'none' && (
        <div style={{ background:'rgba(245,158,11,.12)', border:'1px solid rgba(245,158,11,.35)',
          padding:'12px 14px', borderRadius:'var(--radius)', marginBottom:16 }}>
          <div style={{ fontSize:13, color:'#FDE68A', fontWeight:600, marginBottom:4 }}>
            {isInvite ? t('inviteNoAccountTitle') : t('noAccountTitle')}
          </div>
          <div style={{ fontSize:12.5, color:'rgba(255,255,255,.65)', lineHeight:1.55, marginBottom:10 }}>
            {isInvite ? t('inviteNoAccountBody') : t('noAccountBody')}
          </div>
          <Link href={`/auth/signup?email=${encodeURIComponent(email)}${callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`}
            style={{ display:'inline-block', padding:'8px 16px', background:'#F59E0B',
              color:'#0D1B2A', borderRadius:8, fontSize:12.5, fontWeight:700,
              textDecoration:'none' }}>
            {isInvite ? t('inviteNoAccountCta') : t('noAccountCta')}
          </Link>
        </div>
      )}
      {justVerified && !err && !guide && (
        <div style={{ background:'rgba(5,150,105,.15)', border:'1px solid rgba(5,150,105,.4)',
          color:'#6EE7B7', padding:'10px 14px', borderRadius:'var(--radius)',
          fontSize:13, marginBottom:16 }}>
          ✓ Email confirmed — sign in to open your workspace. · Correo confirmado — inicie sesión.
        </div>
      )}
      {guide?.status === 'unverified' && (
        <div style={{ background:'rgba(245,158,11,.12)', border:'1px solid rgba(245,158,11,.35)',
          padding:'12px 14px', borderRadius:'var(--radius)', marginBottom:16 }}>
          <div style={{ fontSize:13, color:'#FDE68A', fontWeight:600, marginBottom:4 }}>
            Confirm your email first · Confirme su correo primero
          </div>
          <div style={{ fontSize:12.5, color:'rgba(255,255,255,.65)', lineHeight:1.55, marginBottom:10 }}>
            We sent a confirmation link to {email}. Click it, then sign in.
          </div>
          <button type="button" disabled={resent}
            onClick={async () => {
              try {
                await fetch('/api/auth/resend-verification', {
                  method:'POST', headers:{ 'Content-Type':'application/json' },
                  body: JSON.stringify({ email }),
                })
              } catch {}
              setResent(true)
            }}
            style={{ padding:'8px 16px', background: resent ? 'rgba(255,255,255,.15)' : '#F59E0B',
              color: resent ? 'rgba(255,255,255,.6)' : '#0D1B2A', border:'none',
              borderRadius:8, fontSize:12.5, fontWeight:700, cursor: resent ? 'default' : 'pointer',
              fontFamily:'var(--font)' }}>
            {resent ? 'Sent ✓ · Enviado ✓' : 'Resend link · Reenviar enlace'}
          </button>
        </div>
      )}
      {guide?.status === 'oauth' && (
        <div style={{ background:'rgba(27,108,168,.15)', border:'1px solid rgba(27,108,168,.4)',
          padding:'12px 14px', borderRadius:'var(--radius)', marginBottom:16 }}>
          <div style={{ fontSize:13, color:'#93C5FD', fontWeight:600, marginBottom:4 }}>
            {guide.provider === 'google' ? t('oauthOnlyTitleGoogle') : t('oauthOnlyTitleMicrosoft')}
          </div>
          <div style={{ fontSize:12.5, color:'rgba(255,255,255,.65)', lineHeight:1.55 }}>
            {guide.provider === 'google' ? t('oauthOnlyBodyGoogle') : t('oauthOnlyBodyMicrosoft')}
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <input type="email" placeholder={t("workEmail")} required value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle} />
        <input type="password" placeholder={t("password")} required value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle} />
        <div style={{ textAlign:'right', marginTop:-4 }}>
          <Link href="/auth/forgot-password"
            style={{ fontSize:12, color:'rgba(255,255,255,.55)', textDecoration:'none' }}>
            {t("forgotPassword")}
          </Link>
        </div>
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? t("signingIn") : t("signIn")}
        </button>
      </form>

      <div style={{ position:'relative', margin:'20px 0', textAlign:'center' }}>
        <div style={{ height:1, background:'rgba(255,255,255,.1)' }} />
        <span style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          background:'var(--navy)', padding:'0 12px', fontSize:12, color:'rgba(255,255,255,.35)' }}>
          or continue with
        </span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <button onClick={() => signIn('google',{callbackUrl:dest})} style={oauthStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          {t("continueGoogle")}
        </button>
        <button onClick={() => signIn('microsoft-entra-id',{callbackUrl:dest})} style={oauthStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg>
          {t("continueMicrosoft")}
        </button>
      <p style={{ fontSize:11, color:'rgba(255,255,255,.35)', textAlign:'center', marginTop:10, lineHeight:1.5 }}>
        By continuing with Google or Microsoft, you agree to the{' '}
        <a href="/legal/terms" target="_blank" rel="noopener" style={{ color:'rgba(255,255,255,.55)' }}>Terms</a> and{' '}
        <a href="/legal/privacy" target="_blank" rel="noopener" style={{ color:'rgba(255,255,255,.55)' }}>Privacy Policy</a>.
      </p>
      </div>
      <p style={{ fontSize:11.5, color:'rgba(255,255,255,.38)', lineHeight:1.6,
        textAlign:'center', marginTop:12 }}>
        {/* First-time OAuth users are created here without a checkbox — this notice
            is the consent, and auth's createUser event records the timestamp. */}
        By continuing with Google or Microsoft, you agree to the{' '}
        <a href="/legal/terms" target="_blank" rel="noopener" style={{ color:'rgba(255,255,255,.55)' }}>Terms</a>
        {' '}and{' '}
        <a href="/legal/privacy" target="_blank" rel="noopener" style={{ color:'rgba(255,255,255,.55)' }}>Privacy Policy</a>.
      </p>

      <p style={{ textAlign:'center', fontSize:13, color:'rgba(255,255,255,.4)', marginTop:20 }}>
        No account?{' '}
        <Link href={callbackUrl ? `/auth/signup?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/auth/signup"}
          style={{ color:'var(--amber)', textDecoration:'none', fontWeight:500 }}>
          Sign up free
        </Link>
      </p>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'11px 14px', background:'rgba(255,255,255,.07)',
  border:'1.5px solid rgba(255,255,255,.12)', borderRadius:'var(--radius)',
  color:'#fff', fontSize:14, fontFamily:'var(--font)', outline:'none',
}

const btnStyle: React.CSSProperties = {
  width:'100%', padding:12, background:'var(--steel)', color:'#fff', border:'none',
  borderRadius:'var(--radius)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)',
  marginTop:4,
}

const oauthStyle: React.CSSProperties = {
  width:'100%', padding:'10px 16px', background:'rgba(255,255,255,.07)',
  border:'1.5px solid rgba(255,255,255,.12)', borderRadius:'var(--radius)',
  color:'rgba(255,255,255,.8)', fontSize:13, fontWeight:500, cursor:'pointer',
  fontFamily:'var(--font)', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
}
