// src/components/dashboard/WelcomeBanner.tsx
"use client"
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export function WelcomeBanner({ workspaceName }: { workspaceName: string }) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (searchParams.get('onboarding') === 'complete') {
      setShow(true)
      // Remove query param without refresh
      const url = new URL(window.location.href)
      url.searchParams.delete('onboarding')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  if (!show) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0D1B2A 0%, #1a3550 60%, #1B6CA8 100%)',
      border: '1px solid rgba(27,108,168,.3)',
      borderRadius: 12, padding: '20px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, marginBottom: 20, flexWrap: 'wrap',
      animation: 'slideDown .3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 36 }}>🎉</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 3 }}>
            Welcome to {workspaceName}!
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', lineHeight: 1.5 }}>
            Your workspace is ready. Create your first project, invite your team, or explore the template marketplace.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <a href="/templates" style={{
          padding: '8px 16px', background: 'rgba(255,255,255,.1)',
          border: '1px solid rgba(255,255,255,.15)',
          borderRadius: 8, fontSize: 13, fontWeight: 500,
          color: 'rgba(255,255,255,.8)', textDecoration: 'none',
          transition: 'all .15s',
        }}>
          Browse templates
        </a>
        <a href="/projects" style={{
          padding: '8px 16px', background: 'var(--amber)',
          border: 'none', borderRadius: 8, fontSize: 13,
          fontWeight: 600, color: 'var(--navy)', textDecoration: 'none',
        }}>
          + New project
        </a>
        <button
          onClick={() => setShow(false)}
          style={{ width: 28, height: 28, background: 'rgba(255,255,255,.08)',
            border: '1px solid rgba(255,255,255,.1)', borderRadius: 6,
            color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font)' }}
        >
          ×
        </button>
      </div>
      <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:none; } }`}</style>
    </div>
  )
}
