// src/components/marketing/LegalPage.tsx
import Link from "next/link"

interface Section { title:string; content:string }

export function LegalPage({ title, lastUpdated, sections }: {
  title:string; lastUpdated:string; sections:Section[]
}) {
  return (
    <div style={{ fontFamily:"system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh" }}>
      <nav style={{ background:"#1a3a5c", padding:"0 40px", height:60,
        display:"flex", alignItems:"center", gap:20 }}>
        <Link href="/" style={{ fontSize:18, fontWeight:800, color:"#fff", textDecoration:"none" }}>
          FlowSync <span style={{ color:"#60A5FA" }}>PM</span>
        </Link>
        <Link href="/legal" style={{ fontSize:13, color:"rgba(255,255,255,.6)", textDecoration:"none" }}>
          ← All legal docs
        </Link>
      </nav>
      <div style={{ maxWidth:720, margin:"0 auto", padding:"60px 20px 80px" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase",
          letterSpacing:".08em", marginBottom:8 }}>
          FlowSync PM Legal
        </div>
        <h1 style={{ fontSize:34, fontWeight:800, color:"#1E293B", marginBottom:8, lineHeight:1.1 }}>
          {title}
        </h1>
        <div style={{ fontSize:13, color:"#94A3B8", marginBottom:40 }}>
          Last updated: {lastUpdated}
        </div>
        {sections.map((s,i) => (
          <div key={i} style={{ marginBottom:28 }}>
            <h2 style={{ fontSize:16, fontWeight:700, color:"#1E293B", marginBottom:8,
              paddingBottom:6, borderBottom:"1px solid #E2E8F0" }}>
              {s.title}
            </h2>
            <p style={{ fontSize:14, color:"#374151", lineHeight:1.8, margin:0 }}>
              {s.content}
            </p>
          </div>
        ))}
        <div style={{ marginTop:48, padding:"20px", background:"#EFF6FF",
          borderRadius:8, textAlign:"center" }}>
          <div style={{ fontSize:13, color:"#1B6CA8" }}>
            Questions? Contact us at{" "}
            <a href="mailto:legal@flowsyncpm.com" style={{ color:"#1B6CA8", fontWeight:600 }}>
              legal@flowsyncpm.com
            </a>
          </div>
        </div>
        <div style={{ marginTop:24, fontSize:11, color:"#94A3B8", textAlign:"center" }}>
          © 2026 FlowSync PM. All rights reserved.
        </div>
      </div>
    </div>
  )
}
