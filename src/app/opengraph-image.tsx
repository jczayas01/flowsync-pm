// src/app/opengraph-image.tsx
// The card that renders whenever flowsyncpm.com is shared — LinkedIn, Slack,
// WhatsApp, Teams. Generated at the edge so it never goes stale against a
// hand-made PNG, and so the pitch is legible at thumbnail size.
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'FlowSync PM — enterprise project and PMO management, bilingual EN/ES'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: '#0D1B2A', padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 13, background: '#1B6CA8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 30, fontWeight: 800,
          }}>F</div>
          <div style={{ color: '#fff', fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            FlowSync PM
          </div>
        </div>

        {/* The pitch — the same words as the hero */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            color: '#fff', fontSize: 62, fontWeight: 800, lineHeight: 1.1,
            letterSpacing: -2, marginBottom: 20,
          }}>
            Your plan is already written.
          </div>
          <div style={{
            color: '#F59E0B', fontSize: 62, fontWeight: 800, lineHeight: 1.1,
            letterSpacing: -2, marginBottom: 28,
          }}>
            Turn it into a live project.
          </div>
          <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 26, lineHeight: 1.4 }}>
            Import a Word or Excel plan — get phases, tasks, risks and budget in 30 seconds.
          </div>
        </div>

        {/* Proof chips */}
        <div style={{ display: 'flex', gap: 12 }}>
          {['Gantt & critical path', 'Budgets with EVM', 'Governance', 'English / Español'].map(t => (
            <div key={t} style={{
              display: 'flex', padding: '9px 18px', borderRadius: 8,
              background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)',
              color: 'rgba(255,255,255,.75)', fontSize: 20,
            }}>{t}</div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
