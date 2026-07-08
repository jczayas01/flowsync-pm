// src/app/(marketing)/legal/page.tsx
import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Legal — FlowSync PM',
  description: 'Terms of Service, Privacy Policy, and legal information for FlowSync PM.',
}

const DOCS = [
  { title:"Terms of Service",      href:"/legal/terms",   icon:"📋",
    desc:"Usage rights, subscription terms, cancellation policy, and acceptable use guidelines." },
  { title:"Privacy Policy",        href:"/legal/privacy", icon:"🔒",
    desc:"How we collect, store, and protect your data. GDPR and CCPA compliant." },
  { title:"Cookie Policy",         href:"/legal/cookies", icon:"🍪",
    desc:"What cookies FlowSync PM sets and why." },
  { title:"Data Processing Agreement", href:"/legal/dpa", icon:"📝",
    desc:"DPA for enterprise customers and organizations in regulated industries." },
  { title:"DMCA Policy",           href:"/legal/dmca",    icon:"©",
    desc:"Copyright and intellectual property policy for user-submitted content." },
  { title:"AI Disclaimer",         href:"/legal/ai",      icon:"🤖",
    desc:"Important information about AI-generated reports and content." },
]

export default function LegalHub() {
  return (
    <div style={{ fontFamily:"system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh" }}>
      <nav style={{ background:"#1a3a5c", padding:"0 40px", height:60,
        display:"flex", alignItems:"center" }}>
        <Link href="/" style={{ fontSize:18, fontWeight:800, color:"#fff", textDecoration:"none" }}>
          FlowSync <span style={{ color:"#60A5FA" }}>PM</span>
        </Link>
      </nav>
      <div style={{ maxWidth:680, margin:"0 auto", padding:"60px 20px" }}>
        <h1 style={{ fontSize:32, fontWeight:800, marginBottom:8, color:"#1E293B" }}>Legal</h1>
        <p style={{ fontSize:15, color:"#64748B", marginBottom:40, lineHeight:1.6 }}>
          FlowSync PM is committed to transparency. Find all our legal documents below.
          Last updated: July 2026.
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {DOCS.map(d=>(
            <Link key={d.href} href={d.href}
              style={{ display:"flex", gap:16, padding:"18px 20px",
                background:"#fff", borderRadius:10, border:"1px solid #E2E8F0",
                textDecoration:"none", alignItems:"flex-start" }}>
              <span style={{ fontSize:24, flexShrink:0 }}>{d.icon}</span>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:"#1E293B", marginBottom:4 }}>{d.title}</div>
                <div style={{ fontSize:13, color:"#64748B", lineHeight:1.5 }}>{d.desc}</div>
              </div>
              <span style={{ marginLeft:"auto", color:"#94A3B8", fontSize:18, flexShrink:0 }}>→</span>
            </Link>
          ))}
        </div>
        <div style={{ marginTop:40, fontSize:12, color:"#94A3B8", textAlign:"center" }}>
          Questions? Contact us at <a href="mailto:legal@flowsyncpm.com" style={{ color:"#1B6CA8" }}>legal@flowsyncpm.com</a>
        </div>
      </div>
      <div style={{ textAlign:"center", padding:"20px", fontSize:12, color:"#94A3B8" }}>
        © 2026 FlowSync PM. All rights reserved.
      </div>
    </div>
  )
}
