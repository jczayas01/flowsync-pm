// Free template library — the SEO front door. Every PM searching for
// "project charter template" or "risk register excel" lands here, gets the
// file free with no signup, and learns the twist: upload it filled and
// FlowSync builds the project from it.
import Link from "next/link"
import type { Metadata } from "next"
import { DOC_TEMPLATES } from "@/lib/doc-templates"

export const metadata: Metadata = {
  title: "18 Free Project Management Templates — Word & Excel | FlowSync PM",
  description: "Free PM templates: project charter, WBS, risk register, budget plan, status report and more. Word & Excel, English & Spanish. No signup required.",
  alternates: { canonical: "https://flowsyncpm.com/free-templates" },
}

const PHASES: Record<string, string> = {
  INITIATION: "Initiation", PLANNING: "Planning", EXECUTION: "Execution & Control", CLOSING: "Closing",
}
const NAVY="#0D1B2A", STEEL="#1B6CA8", AMBER="#F59E0B", SLATE="#64748B", LINE="#E2E8F0"

export default function FreeTemplatesPage() {
  return (
    <div style={{ fontFamily:"var(--font)", color:"#0F172A", background:"#fff" }}>
      <div style={{ background:NAVY, padding:"64px 24px 56px", textAlign:"center" }}>
        <h1 style={{ fontSize:"clamp(28px,4vw,44px)", fontWeight:800, color:"#fff",
          letterSpacing:"-.03em", maxWidth:760, margin:"0 auto 14px", lineHeight:1.15 }}>
          18 free project management templates
        </h1>
        <p style={{ fontSize:16, color:"rgba(255,255,255,.6)", maxWidth:560, margin:"0 auto", lineHeight:1.65 }}>
          Charter to closure, in Word and Excel, English and Spanish. Download free — no
          signup. And when you fill one in, FlowSync PM can read it and build the project for you.
        </p>
      </div>

      <div style={{ maxWidth:1080, margin:"0 auto", padding:"48px 24px 72px" }}>
        {Object.entries(PHASES).map(([phase, label]) => (
          <section key={phase} style={{ marginBottom:40 }}>
            <h2 style={{ fontSize:13, fontWeight:700, color:STEEL, textTransform:"uppercase",
              letterSpacing:".08em", marginBottom:14 }}>{label}</h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:14 }}>
              {DOC_TEMPLATES.filter(t => t.phase === phase).map(t => (
                <Link key={t.id} href={`/free-templates/${t.id}`}
                  style={{ border:`1px solid ${LINE}`, borderRadius:12, padding:"16px 16px 18px",
                    textDecoration:"none", color:"inherit", display:"block" }}>
                  <div style={{ fontSize:22, marginBottom:8 }}>{t.icon}</div>
                  <div style={{ fontSize:14.5, fontWeight:700, marginBottom:4 }}>{t.name}</div>
                  <div style={{ fontSize:12.5, color:SLATE, lineHeight:1.55, marginBottom:8 }}>{t.description}</div>
                  <span style={{ fontSize:11, fontWeight:700, color:STEEL, textTransform:"uppercase" }}>
                    {t.format} · Free →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <div style={{ background:NAVY, borderRadius:14, padding:"28px", textAlign:"center", marginTop:16 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#fff", marginBottom:8 }}>
            Templates are the slow way. Watch one become a live project.
          </div>
          <p style={{ fontSize:13.5, color:"rgba(255,255,255,.55)", maxWidth:520, margin:"0 auto 18px", lineHeight:1.6 }}>
            Upload any filled template to FlowSync PM and the AI extracts phases, tasks, risks
            and budget into a governed project — Gantt, EVM and reporting included.
          </p>
          <Link href="/auth/signup" style={{ display:"inline-block", padding:"12px 26px",
            background:AMBER, color:NAVY, borderRadius:10, fontSize:14, fontWeight:700, textDecoration:"none" }}>
            Try it free for two months →
          </Link>
        </div>
      </div>
    </div>
  )
}
