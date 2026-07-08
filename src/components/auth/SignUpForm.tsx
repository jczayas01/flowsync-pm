// src/components/auth/SignUpForm.tsx
"use client"
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

export function SignUpForm() {
  const [form, setForm]     = useState({ name:'', email:'', password:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Registration failed')
        setLoading(false); return
      }
      await signIn('credentials', { email:form.email, password:form.password, redirect:false })
      window.location.href = '/onboarding'
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
