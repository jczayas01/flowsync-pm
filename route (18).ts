// src/app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--surface)', fontFamily:'var(--font)' }}>
      <div style={{ textAlign:'center', padding:'0 24px' }}>
        <div style={{ fontFamily:'monospace', fontSize:72, fontWeight:700,
          color:'var(--border)', lineHeight:1, marginBottom:16 }}>404</div>
        <h1 style={{ fontSize:20, fontWeight:600, color:'var(--text)', marginBottom:8 }}>
          Page not found
        </h1>
        <p style={{ fontSize:14, color:'var(--text-3)', marginBottom:24 }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <Link href="/dashboard"
          style={{ display:'inline-block', padding:'10px 20px', background:'var(--steel)',
            color:'#fff', borderRadius:'var(--radius)', textDecoration:'none',
            fontSize:14, fontWeight:500 }}>
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
