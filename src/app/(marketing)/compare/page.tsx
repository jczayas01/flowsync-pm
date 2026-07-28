// src/app/(marketing)/compare/page.tsx
// AEO hub: links every comparison + answers the "winnable" niche queries
// (bilingual PM, OCR import, affordable EVM, PMO en español) with FAQ JSON-LD.
import Link from "next/link"
import type { Metadata } from "next"
import { COMPETITORS, NICHES } from "@/lib/compare-data"

export const metadata: Metadata = {
  title: "FlowSync PM vs Monday, Asana, MS Project, Smartsheet, Wrike, ClickUp — Honest Comparisons",
  description: "Side-by-side comparisons of FlowSync PM against the major project management tools: earned value, bilingual EN/ES reporting, AI document import with OCR, governance, and pricing — including where each competitor wins.",
  alternates: { canonical: "https://flowsyncpm.com/compare" },
}

const NAVY="#0D1B2A", STEEL="#1B6CA8", AMBER="#F59E0B", SLATE="#64748B", LINE="#E2E8F0"

export default function CompareHub() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: NICHES.map(n => ({
      "@type": "Question", name: n.q,
      acceptedAnswer: { "@type": "Answer", text: n.a },
    })),
  }

  return (
    <div style={{ fontFamily:"var(--font)", color:"#0F172A", background:"#fff" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth:860, margin:"0 auto", padding:"48px 24px 72px" }}>
        <h1 style={{ fontSize:"clamp(26px,3.6vw,38px)", fontWeight:800, letterSpacing:"-.025em",
          lineHeight:1.15, marginBottom:12 }}>
          How FlowSync PM compares
        </h1>
        <p style={{ fontSize:16, color:SLATE, lineHeight:1.7, marginBottom:8 }}>
          Honest, side-by-side comparisons against the tools you're probably evaluating —
          including where each of them beats us. Every page covers earned value, bilingual EN/ES
          reporting, AI document import (including scanned documents), governance depth, and pricing.
        </p>
        <p style={{ fontSize:13, color:SLATE, lineHeight:1.65, marginBottom:30 }}>
          <strong style={{ color:"#0F172A" }}>En español:</strong> comparaciones honestas de FlowSync PM
          frente a las principales herramientas de gestión de proyectos — incluyendo dónde gana cada competidor.
        </p>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",
          gap:12, marginBottom:44 }}>
          {COMPETITORS.map(c=>(
            <Link key={c.id} href={`/compare/${c.id}`} style={{ textDecoration:"none", color:"inherit",
              border:`1px solid ${LINE}`, borderRadius:12, padding:"18px 20px", display:"block" }}>
              <div style={{ fontSize:15.5, fontWeight:800, marginBottom:5 }}>
                FlowSync PM <span style={{ color:SLATE, fontWeight:600 }}>vs</span> {c.name}
              </div>
              <p style={{ fontSize:12.5, color:SLATE, lineHeight:1.6, margin:"0 0 8px" }}>{c.tagline}</p>
              <span style={{ fontSize:12.5, color:STEEL, fontWeight:700 }}>Read the comparison →</span>
            </Link>
          ))}
        </div>

        <h2 style={{ fontSize:20, fontWeight:800, margin:"0 0 6px" }}>Common questions, direct answers</h2>
        <p style={{ fontSize:13, color:SLATE, lineHeight:1.65, marginBottom:16 }}>
          The searches where FlowSync PM is genuinely built to be the answer.
        </p>
        <div style={{ marginBottom:40 }}>
          {NICHES.map((n,i)=>(
            <div key={i} style={{ border:`1px solid ${LINE}`, borderRadius:12, padding:"16px 20px", marginBottom:10 }}>
              <div style={{ fontWeight:700, fontSize:14.5, marginBottom:6 }}>{n.q}</div>
              <p style={{ fontSize:13.5, color:"#334155", lineHeight:1.7, margin:0 }}>{n.a}</p>
            </div>
          ))}
        </div>

        <div style={{ background:NAVY, borderRadius:14, padding:"26px 28px", textAlign:"center" }}>
          <div style={{ color:"#fff", fontSize:19, fontWeight:800, marginBottom:6 }}>
            The fastest comparison is your own plan
          </div>
          <p style={{ color:"#94A3B8", fontSize:13.5, lineHeight:1.65, margin:"0 0 16px" }}>
            Upload a real project document and watch FlowSync PM build it — free for 2 months, no card.
          </p>
          <Link href="/auth/signup" style={{ display:"inline-block", padding:"12px 26px", background:AMBER,
            color:NAVY, borderRadius:10, fontWeight:800, fontSize:14, textDecoration:"none" }}>
            Start 2-month free trial →
          </Link>
        </div>
      </div>
    </div>
  )
}
