// src/components/templates/DocTemplateLibrary.tsx
"use client"
import { useState, useMemo } from "react"
import { DOC_TEMPLATES, PHASE_LABELS, type DocPhase, type DocTemplate } from "@/lib/doc-templates"

const NAVY = "#0D1B2A", STEEL = "#1B6CA8", GREEN = "#059669", SLATE = "#64748B"
const PHASES: DocPhase[] = ["INITIATION", "PLANNING", "EXECUTION", "CLOSING"]

export function DocTemplateLibrary({ locale = "en" }: { locale?: "en" | "es" }) {
  const es = locale === "es"
  const [phase, setPhase]   = useState<DocPhase | "all">("all")
  const [aiOnly, setAiOnly] = useState(false)
  const [q, setQ]           = useState("")
  const [busy, setBusy]     = useState<string | null>(null)

  const shown = useMemo(() => {
    const term = q.toLowerCase().trim()
    return DOC_TEMPLATES.filter(t =>
      (phase === "all" || t.phase === phase) &&
      (!aiOnly || !!t.ingestType) &&
      (!term || `${t.name} ${t.nameEs} ${t.description} ${t.descriptionEs}`.toLowerCase().includes(term)))
  }, [phase, aiOnly, q])

  const grouped = useMemo(() => {
    const g: Record<string, DocTemplate[]> = {}
    for (const t of shown) (g[t.phase] ||= []).push(t)
    return g
  }, [shown])

  async function download(t: DocTemplate) {
    setBusy(t.id)
    try {
      const res = await fetch(`/api/doc-templates/${t.id}?locale=${locale}`)
      if (!res.ok) { alert(es ? "No se pudo generar la plantilla." : "Could not generate that template."); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      const name = (es ? t.nameEs : t.name).replace(/[^\w\s-]/g, "").replace(/\s+/g, "_")
      a.href = url; a.download = `${name}.${t.format}`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert(es ? "No se pudo descargar." : "Download failed.")
    } finally { setBusy(null) }
  }

  const aiCount = DOC_TEMPLATES.filter(t => t.ingestType).length

  return (
    <div style={{ marginTop: 8 }}>
      {/* ── Intro ── */}
      <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:12, padding:"16px 18px", marginBottom:14 }}>
        <div style={{ fontSize:15, fontWeight:700, color:NAVY, marginBottom:5 }}>
          📄 {es ? "Plantillas de documentos" : "Document templates"}
        </div>
        <div style={{ fontSize:12.5, color:"var(--text-2)", lineHeight:1.6, maxWidth:760 }}>
          {es
            ? "Formatos en blanco listos para usar en cualquier tipo de proyecto — sin contenido específico de industria. Descárgalos en Word o Excel, complétalos y trabaja como prefieras."
            : "Blank, ready-to-use forms for any type of project — no industry-specific content. Download in Word or Excel, fill them in, and work however you like."}
        </div>
        <div style={{ marginTop:10, padding:"9px 12px", background:"#EFF6FF", borderLeft:`3px solid ${STEEL}`,
          borderRadius:"0 6px 6px 0", fontSize:12, color:"#1E40AF", lineHeight:1.55 }}>
          <strong>🤖 {es ? `${aiCount} de estas son legibles por IA.` : `${aiCount} of these are AI-readable.`}</strong>{" "}
          {es
            ? "Complétalas y súbelas en la pestaña Gobernanza del proyecto — FlowSync las lee y llena tu proyecto automáticamente."
            : "Fill one in and upload it under a project's Governance tab — FlowSync reads it and populates your project automatically."}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="fs-wrap" style={{ display:"flex", alignItems:"center", gap:7, marginBottom:14 }}>
        <Chip active={phase==="all"} onClick={() => setPhase("all")}>
          {es ? "Todas" : "All"} <span style={{ opacity:.55 }}>{DOC_TEMPLATES.length}</span>
        </Chip>
        {PHASES.map(p => (
          <Chip key={p} active={phase===p} onClick={() => setPhase(p)}>
            {PHASE_LABELS[p].icon} {es ? PHASE_LABELS[p].es : PHASE_LABELS[p].en}
          </Chip>
        ))}
        <Chip active={aiOnly} onClick={() => setAiOnly(v => !v)} accent>
          🤖 {es ? "Legibles por IA" : "AI-readable"} <span style={{ opacity:.55 }}>{aiCount}</span>
        </Chip>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={es ? "Buscar…" : "Search…"}
          style={{ marginLeft:"auto", padding:"6px 11px", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", fontSize:12.5, minWidth:170, outline:"none", fontFamily:"var(--font)" }} />
      </div>

      {/* ── Grouped cards ── */}
      {!shown.length && (
        <div style={{ padding:"36px 20px", textAlign:"center", fontSize:13, color:"var(--text-3)" }}>
          {es ? "Ninguna plantilla coincide con ese filtro." : "No templates match that filter."}
        </div>
      )}

      {PHASES.filter(p => grouped[p]?.length).map(p => (
        <div key={p} style={{ marginBottom:18 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase",
            color:"var(--text-3)", marginBottom:8 }}>
            {PHASE_LABELS[p].icon} {es ? PHASE_LABELS[p].es : PHASE_LABELS[p].en}
          </div>
          <div className="fs-cols-3">
            {grouped[p].map(t => (
              <div key={t.id} style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:10,
                padding:"13px 14px", display:"flex", flexDirection:"column", gap:7 }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                  <span style={{ fontSize:18, lineHeight:1.2 }}>{t.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:NAVY, lineHeight:1.35 }}>
                      {es ? t.nameEs : t.name}
                    </div>
                    <div style={{ display:"flex", gap:5, marginTop:4, flexWrap:"wrap" }}>
                      <Tag color={t.format === "xlsx" ? GREEN : STEEL}>
                        {t.format === "xlsx" ? "Excel" : "Word"}
                      </Tag>
                      {t.ingestType && <Tag color="#7C3AED">🤖 {es ? "IA" : "AI"}</Tag>}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize:11.5, color:"var(--text-2)", lineHeight:1.5, flex:1 }}>
                  {es ? t.descriptionEs : t.description}
                </div>
                <button onClick={() => download(t)} disabled={busy === t.id}
                  style={{ padding:"7px 12px", background: busy === t.id ? "#CBD5E1" : NAVY, color:"#fff",
                    border:"none", borderRadius:6, fontSize:12, fontWeight:600,
                    cursor: busy === t.id ? "default" : "pointer", fontFamily:"var(--font)" }}>
                  {busy === t.id ? (es ? "Generando…" : "Generating…") : (es ? "↓ Descargar" : "↓ Download")}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Chip({ active, onClick, children, accent }: {
  active: boolean; onClick: () => void; children: React.ReactNode; accent?: boolean
}) {
  return (
    <button onClick={onClick}
      style={{ padding:"6px 12px", borderRadius:20, fontSize:12, fontWeight:500, cursor:"pointer",
        fontFamily:"var(--font)", whiteSpace:"nowrap",
        border: active ? "none" : "1px solid var(--border)",
        background: active ? (accent ? "#7C3AED" : NAVY) : "#fff",
        color: active ? "#fff" : "var(--text-2)" }}>
      {children}
    </button>
  )
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize:9.5, fontWeight:700, padding:"2px 6px", borderRadius:4,
      background:`${color}18`, color, letterSpacing:".03em" }}>
      {children}
    </span>
  )
}
