// src/components/auth/AuthShell.tsx
import Link from 'next/link'

export function AuthShell({
  title, subtitle, children,
}: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'var(--navy)' }}>
      {/* Left panel */}
      <div style={{ display:'flex', flexDirection:'column', flex:1, alignItems:'center',
        justifyContent:'center', padding:'40px 24px' }}>
        <div style={{ width:'100%', maxWidth:400 }}>
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:8,
            textDecoration:'none', marginBottom:40 }}>
            <div style={{ width:32, height:32, background:'var(--steel)', borderRadius:8,
              position:'relative', flexShrink:0 }}>
              <div style={{ position:'absolute', width:15, height:3, background:'#fff',
                top:9, left:8, borderRadius:2 }} />
              <div style={{ position:'absolute', width:10, height:3, background:'var(--amber)',
                top:15, left:8, borderRadius:2 }} />
            </div>
            <span style={{ fontWeight:700, fontSize:16, color:'#fff' }}>
              FlowSync <span style={{ color:'var(--amber)' }}>PM</span>
            </span>
          </Link>
          <h1 style={{ fontSize:24, fontWeight:600, color:'#fff', marginBottom:8 }}>{title}</h1>
          <p style={{ fontSize:14, color:'rgba(255,255,255,.5)', marginBottom:32, lineHeight:1.6 }}>
            {subtitle}
          </p>
          {children}
        </div>
      </div>

      {/* Right panel — brand */}
      <div style={{ display:'none', flex:'0 0 420px', background:'rgba(27,108,168,.15)',
        borderLeft:'1px solid rgba(255,255,255,.06)', alignItems:'center', justifyContent:'center',
        padding:40, '@media(min-width:900px)':{display:'flex'} } as any}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📊</div>
          <div style={{ fontSize:18, fontWeight:600, color:'#fff', marginBottom:8 }}>
            Enterprise PM for real PMOs
          </div>
          <div style={{ fontSize:14, color:'rgba(255,255,255,.45)', lineHeight:1.7, maxWidth:280 }}>
            Waterfall, Agile, and Scrum in one platform. M365 integration, EVM budget tracking,
            and AI-generated reports.
          </div>
          <div style={{ display:'flex', gap:20, justifyContent:'center', marginTop:28 }}>
            {['84%', '47+', '$0'].map((val, i) => (
              <div key={i} style={{ textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:700, color:'#fff' }}>{val}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:2 }}>
                  {['Feature parity', 'Templates', 'Free tier'][i]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
