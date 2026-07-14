"use client"
// src/components/projects/tabs/ProjectPresentationTab.tsx — branded PPTX generation
import { useTranslations } from "next-intl"
import { useState } from "react"

const AUDIENCES = [
  {
    id: "EXECUTIVE", icon: "👔", title: "Executive Briefing",
    desc: "Concise, decision-oriented: summary KPIs, EVM performance, top risks, decisions, next steps.",
    slides: ["Title", "Executive Summary", "Earned Value (chart)", "Top Risks", "Decisions & Changes", "Next Steps"],
  },
  {
    id: "TEAM", icon: "👥", title: "Full Project Review",
    desc: "Everything in the briefing plus the phase timeline and budget-by-category chart.",
    slides: ["Title", "Executive Summary", "Phase Timeline", "Earned Value (chart)", "Budget by Category (chart)", "Top Risks", "Decisions & Changes", "Next Steps"],
  },
]

export function ProjectPresentationTab({ projectId, workspaceId, project }: {
  projectId: string; workspaceId: string; project: any
}) {
  const t = useTranslations("present")
  const [audience, setAudience] = useState<"EXECUTIVE"|"TEAM">("EXECUTIVE")
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState("")

  async function generate() {
    setGenerating(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/export-pptx`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
        body: JSON.stringify({ audience }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d?.error || `Generation failed (${res.status})`); return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${project?.code}_${audience === "TEAM" ? "Review" : "Executive"}_Deck.pptx`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setGenerating(false) }
  }

  const sel = AUDIENCES.find(a => a.id === audience)!

  return (
    <div style={{ padding: 24, maxWidth: 980 }}>
      <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "var(--radius)",
        padding: "10px 14px", fontSize: 12, color: "#1B6CA8", marginBottom: 18 }}>
        PM Standard — Communications Management · Generate a branded PowerPoint deck from live project data
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        {AUDIENCES.map(a => (
          <div key={a.id} onClick={() => setAudience(a.id as any)}
            style={{ background: audience === a.id ? "#EFF6FF" : "#fff",
              border: `2px solid ${audience === a.id ? "var(--steel)" : "var(--border)"}`,
              borderRadius: "var(--radius)", padding: 18, cursor: "pointer" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
              {a.icon} {t(a.title as any)}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>{t(a.desc as any)}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase",
          letterSpacing: ".05em", marginBottom: 10 }}>
          {t("Deck contents")} — {t(sel.title as any)}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {sel.slides.map((sl, i) => (
            <span key={i} style={{ fontSize: 12, padding: "5px 12px", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: 14, color: "var(--text-2)" }}>
              {i + 1}. {sl}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 12 }}>
          Branded with your workspace name and colors · charts are native PowerPoint objects (editable after download) ·
          data is live: {project?._count?.tasks ?? 0} tasks, {project?._count?.risks ?? 0} risks, {project?._count?.milestones ?? 0} milestones
        </div>
      </div>

      <button onClick={generate} disabled={generating}
        style={{ padding: "12px 26px", background: "var(--steel)", color: "#fff", border: "none",
          borderRadius: "var(--radius)", fontSize: 14, fontWeight: 600, fontFamily: "var(--font)",
          cursor: generating ? "wait" : "pointer" }}>
        {generating ? t("Building deck…") : t("🎬 Generate PowerPoint")}
      </button>
      {error && <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 10 }}>✗ {error}</div>}
    </div>
  )
}
