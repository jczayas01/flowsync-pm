// Per-template SEO page: one URL per template, statically generated, each
// targeting its own search intent ("project charter template word", etc.).
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { DOC_TEMPLATES, getDocTemplate } from "@/lib/doc-templates"

export function generateStaticParams() {
  return DOC_TEMPLATES.map(t => ({ templateId: t.id }))
}

export function generateMetadata({ params }: { params: { templateId: string } }): Metadata {
  const t = getDocTemplate(params.templateId)
  if (!t) return {}
  const fmt = t.format === "docx" ? "Word" : "Excel"
  return {
    title: `Free ${t.name} Template (${fmt}) — English & Spanish | FlowSync PM`,
    description: `${t.description} Download the free ${t.name} template in ${fmt} format, in English or Spanish. No signup required.`,
    alternates: { canonical: `https://flowsyncpm.com/free-templates/${t.id}` },
  }
}

const NAVY="#0D1B2A", STEEL="#1B6CA8", AMBER="#F59E0B", SLATE="#64748B", LINE="#E2E8F0"

export default function TemplatePage({ params }: { params: { templateId: string } }) {
  const t = getDocTemplate(params.templateId)
  if (!t) notFound()
  const fmt = t.format === "docx" ? "Word (.docx)" : "Excel (.xlsx)"
  const related = DOC_TEMPLATES.filter(x => x.phase === t.phase && x.id !== t.id).slice(0, 3)

  return (
    <div style={{ fontFamily:"var(--font)", color:"#0F172A", background:"#fff" }}>
      <div style={{ maxWidth:760, margin:"0 auto", padding:"48px 24px 72px" }}>
        <Link href="/free-templates" style={{ fontSize:12.5, color:STEEL, textDecoration:"none", fontWeight:600 }}>
          ← All free templates
        </Link>

        <div style={{ fontSize:40, margin:"18px 0 10px" }}>{t.icon}</div>
        <h1 style={{ fontSize:"clamp(26px,3.6vw,38px)", fontWeight:800, letterSpacing:"-.025em",
          lineHeight:1.15, marginBottom:12 }}>
          Free {t.name} template
        </h1>
        <p style={{ fontSize:16, color:SLATE, lineHeight:1.7, marginBottom:8 }}>{t.description}</p>
        <p style={{ fontSize:13.5, color:SLATE, lineHeight:1.65, marginBottom:24 }}>
          <strong style={{ color:"#0F172A" }}>En español:</strong> {t.nameEs} — {t.descriptionEs}
        </p>

        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:10 }}>
          <a href={`/api/free-templates/${t.id}?lang=en`}
            style={{ padding:"13px 24px", background:NAVY, color:"#fff", borderRadius:10,
              fontSize:14, fontWeight:700, textDecoration:"none" }}>
            ⬇ Download — English ({fmt})
          </a>
          <a href={`/api/free-templates/${t.id}?lang=es`}
            style={{ padding:"13px 24px", background:"#fff", color:NAVY, borderRadius:10,
              fontSize:14, fontWeight:700, textDecoration:"none", border:`1.5px solid ${NAVY}` }}>
            ⬇ Descargar — Español
          </a>
        </div>
        <p style={{ fontSize:12, color:SLATE, marginBottom:36 }}>
          Free, no signup. Industry-standard PM structure, ready to fill in.
        </p>

        <div style={{ background:"#F8FAFC", border:`1px solid ${LINE}`, borderRadius:12,
          padding:"20px 22px", marginBottom:36 }}>
          <div style={{ fontSize:14.5, fontWeight:700, marginBottom:8 }}>
            The template is step one. Here's the shortcut.
          </div>
          <p style={{ fontSize:13.5, color:SLATE, lineHeight:1.7, marginBottom:14 }}>
            Fill this template in, upload it to FlowSync PM, and the AI reads it back —
            {t.ingestType
              ? " this document type is fully understood by the importer, so"
              : " together with your plan documents,"} phases, tasks, risks and budget become
            a live, governed project with a Gantt, EVM and one-click status reports.
          </p>
          <Link href="/auth/signup" style={{ display:"inline-block", padding:"11px 22px",
            background:AMBER, color:NAVY, borderRadius:9, fontSize:13.5, fontWeight:700, textDecoration:"none" }}>
            Start free — two months, full product →
          </Link>
        </div>

        {related.length > 0 && (
          <div>
            <div style={{ fontSize:12.5, fontWeight:700, color:STEEL, textTransform:"uppercase",
              letterSpacing:".07em", marginBottom:12 }}>Related templates</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 }}>
              {related.map(r => (
                <Link key={r.id} href={`/free-templates/${r.id}`}
                  style={{ border:`1px solid ${LINE}`, borderRadius:10, padding:"13px 14px",
                    textDecoration:"none", color:"inherit" }}>
                  <span style={{ fontSize:16, marginRight:7 }}>{r.icon}</span>
                  <span style={{ fontSize:13, fontWeight:600 }}>{r.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
