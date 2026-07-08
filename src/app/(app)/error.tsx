"use client"
import { useEffect } from 'react'

export default function AppError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      flex:1, padding:24 }}>
      <div style={{ textAlign:'center' }}>
        <h2 style={{ fontSize:18, color:'#0F172A', marginBottom:16 }}>Something went wrong</h2>
        <button onClick={reset}
          style={{ padding:'9px 20px', background:'#1B6CA8', color:'#fff',
            border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>
          Try again
        </button>
      </div>
    </div>
  )
}
