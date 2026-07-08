"use client"
import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <html><body>
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center',
        justifyContent:'center', background:'#F8FAFC', fontFamily:'system-ui', padding:24 }}>
        <div style={{ textAlign:'center' }}>
          <h1 style={{ fontSize:22, color:'#0F172A', marginBottom:16 }}>Something went wrong</h1>
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <button onClick={reset}
              style={{ padding:'10px 20px', background:'#1B6CA8', color:'#fff',
                border:'none', borderRadius:8, fontSize:14, cursor:'pointer' }}>
              Try again
            </button>
            <Link href="/dashboard"
              style={{ padding:'10px 20px', border:'1px solid #E2E8F0',
                borderRadius:8, color:'#334155', textDecoration:'none', fontSize:14 }}>
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </body></html>
  )
}
