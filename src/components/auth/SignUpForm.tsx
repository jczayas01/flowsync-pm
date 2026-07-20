// src/components/auth/SignUpForm.tsx
"use client"
import { sendGAEvent } from "@next/third-parties/google"
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

export function SignUpForm() {
  // Arriving from "no account found" on the sign-in page carries ?email= so the
  // person doesn't type it a third time. ?callbackUrl= carries where they were
  // headed — an invite link, most importantly: registering must accept the
  // invitation, not dump them into onboarding to build a second workspace.
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') || ''
  const [form, setForm]     = useState({ name:'', email: params.get('email') || '', password:'' })
  const [acceptLegal, setAcceptLegal] = useState(false)
  const [newsletter, setNewsletter]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [sent, setSent]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, acceptLegal, newsletter }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Registration failed')
        setLoading(false); return
      }
      sendGAEvent('event', 'sign_up', { method: 'password' })
      // Account exists but can't sign in until the email is confirmed —
      // show the check-your-inbox panel instead of signing in.
      setSent(true)
      setLoading(false)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width:'100%', padding:'11px 14px', background:'rgba(255,255,255,.07)',
    border:'1.5px solid rgba(255,255,255,.12)', borderRadius:'var(--radius)',
    color:'#fff', fontSize:14, fontFamily:'var(--font)', outline:'none',
  }

  if (sent) {
    return (
      <div style={{ textAlign:'center', padding:'8px 0' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>📬</div>
        <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:8 }}>
          Check your email · Revise su correo
        </div>
        <p style={{ fontSize:13, color:'rgba(255,255,255,.75)', lineHeight:1.6, marginBottom:16 }}>
          We sent a confirmation link to <strong>{form.email}</strong>. Click it to
          activate your workspace, then sign in.<br/>
          <em>Le enviamos un enlace de confirmación. Haga clic para activar su
          workspace y luego inicie sesión.</em>
        </p>
        <p style={{ fontSize:12, color:'rgba(255,255,255,.5)' }}>
          Didn&apos;t get it? Check spam, or resend from the sign-in page.
        </p>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div style={{ background:'rgba(220,38,38,.15)', border:'1px solid rgba(220,38,38,.3)',
          color:'#FCA5A5', padding:'10px 14px', borderRadius:'var(--radius)',
          fontSize:13, marginBottom:16 }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <input type="text" placeholder="Your full name" required value={form.name}
          onChange={e => setForm({...form, name:e.target.value})} style={inputStyle} />
        <input type="email" placeholder="Work email" required value={form.email}
          onChange={e => setForm({...form, email:e.target.value})} style={inputStyle} />
        <input type="password" placeholder="Password (8+ characters)" required minLength={8}
          value={form.password} onChange={e => setForm({...form, password:e.target.value})}
          style={inputStyle} />
        {/* Consent: required legal acceptance, optional newsletter. */}
        <label style={{ display:'flex', gap:9, alignItems:'flex-start', fontSize:12.5,
        color:'rgba(255,255,255,.65)', lineHeight:1.55, cursor:'pointer', marginTop:2 }}>
        <input type="checkbox" required checked={acceptLegal}
          onChange={e => setAcceptLegal(e.target.checked)}
          style={{ marginTop:2, accentColor:'var(--amber)' }} />
        <span>
          I agree to the{' '}
          <a href="/legal/terms" target="_blank" rel="noopener"
            style={{ color:'var(--amber)', textDecoration:'none', fontWeight:600 }}>Terms of Service</a>
          {' '}and{' '}
          <a href="/legal/privacy" target="_blank" rel="noopener"
            style={{ color:'var(--amber)', textDecoration:'none', fontWeight:600 }}>Privacy Policy</a>.
        </span>
      </label>
        <label style={{ display:'flex', gap:9, alignItems:'flex-start', fontSize:12.5,
        color:'rgba(255,255,255,.5)', lineHeight:1.55, cursor:'pointer', marginBottom:6 }}>
        <input type="checkbox" checked={newsletter}
          onChange={e => setNewsletter(e.target.checked)}
          style={{ marginTop:2, accentColor:'var(--amber)' }} />
        <span>Send me occasional product updates and PM resources. No spam, unsubscribe any time.</span>
      </label>
        <button type="submit" disabled={loading} style={{
          width:'100%', padding:12, background:'var(--amber)', color:'var(--navy)', border:'none',
          borderRadius:'var(--radius)', fontSize:14, fontWeight:700, cursor:'pointer',
          fontFamily:'var(--font)', marginTop:4,
        }}>
          {loading ? 'Creating account…' : 'Create free account →'}
        </button>
      </form>
      <p style={{ textAlign:'center', fontSize:12, color:'rgba(255,255,255,.3)', marginTop:16, lineHeight:1.6 }}>
        By signing up you agree to our Terms of Service and Privacy Policy.
      </p>
      <p style={{ textAlign:'center', fontSize:13, color:'rgba(255,255,255,.4)', marginTop:12 }}>
        Already have an account?{' '}
        <Link href="/auth/signin" style={{ color:'var(--amber)', textDecoration:'none', fontWeight:500 }}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
