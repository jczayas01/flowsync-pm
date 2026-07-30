// src/app/(marketing)/compare/[competitorId]/page.tsx
// AEO/GEO: one honest comparison page per competitor, statically generated.
// FAQPage + SoftwareApplication JSON-LD so AI search can cite directly.
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { COMPETITORS, getCompetitor } from "@/lib/compare-data"

export function generateStaticParams() {
  return COMPETITORS.map(c => ({ competitorId: c.id }))
}

export function generateMetadata({ params }: { params: { competitorId: string } }): Metadata {
  const c = getCompetitor(params.competitorId)
  if (!c) return {}
  return {
    title: `FlowSync PM vs ${c.name} (2026) — Honest Comparison | FlowSync PM`,
    description: `${c.name} vs FlowSync PM for project management: earned value, bilingual EN/ES reporting, AI document import (incl. scans), governance, and pricing — including where ${c.name} wins.`,
    alternates: { canonical: `https://flowsyncpm.com/compare/${c.id}` },
  }
}

const NAVY="#0D1B2A", STEEL="#1B6CA8", AMBER="#F59E0B", SLATE="#64748B", LINE="#E2E8F0"

export default function ComparePage({ params }: { params: { competitorId: string } }) {
  const c = getCompetitor(params.competitorId)
  if (!c) notFound()

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "FlowSync PM",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://flowsyncpm.com",
        description: "Bilingual (EN/ES) enterprise project & PMO management with automatic earned value, AI document import including OCR of scans, and full governance suite.",
        offers: { "@type": "Offer", price: "19", priceCurrency: "USD",
          description: "Starter $19/user/mo after a free 2-month trial (no card). Business $39/seat + $20 per 10 contributors." },
      },
      {
        "@type": "FAQPage",
        mainEntity: c.faq.map(f => ({
          "@type": "Question", name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  }

  const others = COMPETITORS.filter(x => x.id !== c.id)

  return (
    <div style={{ fontFamily:"var(--font)", color:"#0F172A", background:"#fff" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth:860, margin:"0 auto", padding:"48px 24px 72px" }}>
        <Link href="/compare" style={{ fontSize:12.5, color:STEEL, textDecoration:"none", fontWeight:600 }}>
          ← All comparisons
        </Link>

        <h1 style={{ fontSize:"clamp(26px,3.6vw,38px)", fontWeight:800, letterSpacing:"-.025em",
          lineHeight:1.15, margin:"18px 0 12px" }}>
          FlowSync PM vs {c.name} <span style={{ color:SLATE, fontWeight:600 }}>(2026)</span>
        </h1>
        <p style={{ fontSize:16, color:SLATE, lineHeight:1.7, marginBottom:6 }}>
          {c.tagline} Here's an honest comparison — including where {c.name} is the better choice.
        </p>
        <p style={{ fontSize:13, color:SLATE, lineHeight:1.6, marginBottom:28 }}>
          <strong style={{ color:"#0F172A" }}>Best for {c.name}:</strong> {c.bestFor}
        </p>

        {/* Where each wins — honesty first, it's also what AI search rewards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:14, marginBottom:34 }}>
          <div style={{ border:`1px solid ${LINE}`, borderRadius:12, padding:"18px 20px" }}>
            <div style={{ fontSize:12, fontWeight:800, letterSpacing:".06em", textTransform:"uppercase",
              color:SLATE, marginBottom:10 }}>Where {c.name} wins</div>
            {c.theyWin.map((w,i)=>(
              <p key={i} style={{ fontSize:13.5, lineHeight:1.65, margin:"0 0 8px", color:"#0F172A" }}>• {w}</p>
            ))}
          </div>
          <div style={{ border:`1px solid ${AMBER}55`, background:"#FFFBEB", borderRadius:12, padding:"18px 20px" }}>
            <div style={{ fontSize:12, fontWeight:800, letterSpacing:".06em", textTransform:"uppercase",
              color:"#B45309", marginBottom:10 }}>Where FlowSync PM wins</div>
            {c.weWin.map((w,i)=>(
              <p key={i} style={{ fontSize:13.5, lineHeight:1.65, margin:"0 0 8px", color:"#0F172A" }}>• {w}</p>
            ))}
          </div>
        </div>

        {/* Feature matrix */}
        <h2 style={{ fontSize:20, fontWeight:800, margin:"0 0 14px" }}>Feature comparison</h2>
        <div style={{ border:`1px solid ${LINE}`, borderRadius:12, overflowX:"auto", marginBottom:10,
          WebkitOverflowScrolling:"touch" }}>
          <table style={{ width:"100%", minWidth:560, borderCollapse:"collapse", fontSize:13.5 }}>
            <thead>
              <tr style={{ background:NAVY, color:"#fff" }}>
                <th style={{ textAlign:"left", padding:"11px 14px", fontWeight:700, width:"22%" }}>Capability</th>
                <th style={{ textAlign:"left", padding:"11px 14px", fontWeight:700 }}>FlowSync PM</th>
                <th style={{ textAlign:"left", padding:"11px 14px", fontWeight:700 }}>{c.name}</th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r,i)=>(
                <tr key={i} style={{ borderTop:`1px solid ${LINE}`, background:i%2?"#F8FAFC":"#fff" }}>
                  <td style={{ padding:"11px 14px", fontWeight:700, verticalAlign:"top" }}>
                    {r.feature}
                    <div style={{ fontWeight:500, color:SLATE, fontSize:11.5, marginTop:2 }}>{r.featureEs}</div>
                  </td>
                  <td style={{ padding:"11px 14px", lineHeight:1.6, verticalAlign:"top" }}>{r.flowsync}</td>
                  <td style={{ padding:"11px 14px", lineHeight:1.6, verticalAlign:"top", color:"#334155" }}>{r.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize:11.5, color:SLATE, lineHeight:1.6, marginBottom:34 }}>
          Competitor pricing and capabilities are indicative, based on publicly available information, and change
          frequently — always verify current details on {c.name}'s official site. {c.name} is a trademark of its
          respective owner; FlowSync PM is not affiliated with or endorsed by it.
        </p>

        {/* FAQ (mirrors the JSON-LD) */}
        <h2 style={{ fontSize:20, fontWeight:800, margin:"0 0 14px" }}>Frequently asked</h2>
        <div style={{ marginBottom:30 }}>
          {c.faq.map((f,i)=>(
            <div key={i} style={{ border:`1px solid ${LINE}`, borderRadius:12, padding:"16px 20px", marginBottom:10 }}>
              <div style={{ fontWeight:700, fontSize:14.5, marginBottom:6 }}>{f.q}</div>
              <p style={{ fontSize:13.5, color:"#334155", lineHeight:1.7, margin:0 }}>{f.a}</p>
            </div>
          ))}
        </div>

        {/* Woven Spanish summary */}
        <div style={{ borderLeft:`3px solid ${STEEL}`, padding:"4px 16px", marginBottom:34 }}>
          <div style={{ fontSize:11, fontWeight:800, letterSpacing:".06em", textTransform:"uppercase",
            color:STEEL, marginBottom:6 }}>En español</div>
          <p style={{ fontSize:13.5, color:"#334155", lineHeight:1.7, margin:0 }}>{c.summaryEs}</p>
        </div>

        {/* CTA */}
        <div style={{ background:NAVY, borderRadius:14, padding:"26px 28px", textAlign:"center", marginBottom:34 }}>
          <div style={{ color:"#fff", fontSize:19, fontWeight:800, marginBottom:6 }}>
            Judge it on your own project
          </div>
          <p style={{ color:"#94A3B8", fontSize:13.5, lineHeight:1.65, margin:"0 0 16px" }}>
            Upload a real project plan — Word, Excel, or PDF — and watch the AI build it.
            Free for 2 months, no card required. English & Español.
          </p>
          <Link href="/auth/signup" style={{ display:"inline-block", padding:"12px 26px", background:AMBER,
            color:NAVY, borderRadius:10, fontWeight:800, fontSize:14, textDecoration:"none" }}>
            Start 2-month free trial →
          </Link>
        </div>

        {/* Other comparisons */}
        <div style={{ fontSize:12, fontWeight:800, letterSpacing:".06em", textTransform:"uppercase",
          color:SLATE, marginBottom:10 }}>More comparisons</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {others.map(o=>(
            <Link key={o.id} href={`/compare/${o.id}`} style={{ fontSize:12.5, color:STEEL, fontWeight:600,
              textDecoration:"none", border:`1px solid ${LINE}`, borderRadius:99, padding:"6px 14px" }}>
              vs {o.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
