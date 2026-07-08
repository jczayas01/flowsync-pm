// src/app/error.tsx — global error boundary
"use client"
import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[GlobalError]', error) }, [error])
  return (
    <html><body>
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        background:'#F8FAFC', fontFamily:'system-ui,sans-serif', padding:24 }}>
        <div style={{ textAlign:'center', maxWidth:440 }}>
          <div style={{ fontSize:64, marginBottom:16 }}>💥</div>
          <h1 style={{ fontSize:22, fontWeight:600, color:'#0F172A', marginBottom:8 }}>Something went wrong</h1>
          <p style={{ fontSize:14, color:'#64748B', lineHeight:1.65, marginBottom:8 }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          {error.digest && (
            <p style={{ fontFamily:'monospace', fontSize:11, color:'#94A3B8', marginBottom:24 }}>
              Error ID: {error.digest}
            </p>
          )}
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <button onClick={reset}
              style={{ padding:'10px 20px', background:'#1B6CA8', color:'#fff', border:'none',
                borderRadius:8, fontSize:14, fontWeight:500, cursor:'pointer' }}>
              Try again
            </button>
            <Link href="/dashboard"
              style={{ padding:'10px 20px', border:'1px solid #E2E8F0', borderRadius:8,
                fontSize:14, fontWeight:500, color:'#334155', textDecoration:'none',
                background:'#fff' }}>
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </body></html>
  )
}
