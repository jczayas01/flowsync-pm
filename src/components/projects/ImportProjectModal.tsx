"use client"
// src/components/projects/ImportProjectModal.tsx — New Project from Document (flagship)
import { useTranslations } from "next-intl"
import { DateField } from "@/components/shared/DatePicker"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"

type Stage = "upload" | "analyzing" | "review" | "creating"

const SECTION_META: Record<string, { icon: string; label: string }> = {
  phases:     { icon: "🧭", label: "Phases" },
  tasks:      { icon: "✓",  label: "Tasks" },
  milestones: { icon: "◆",  label: "Milestones" },
  risks:      { icon: "⚠",  label: "Risks" },
  budget:     { icon: "💰", label: "Budget lines" },
}

export function ImportProjectModal({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const t = useTranslations("import")
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>("upload")
  const [error, setError] = useState("")
  const [drag, setDrag] = useState(false)
  const [data, setData] = useState<any>(null)
  // per-section item inclusion: sets of indices EXCLUDED
  const [excluded, setExcluded] = useState<Record<string, Set<number>>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({ phases: true, tasks: true })

  async function analyze(file: File) {
    setStage("analyzing"); setError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/projects/import/analyze", {
        method: "POST", headers: { "x-workspace-id": workspaceId }, body: fd,
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d?.error || `Analysis failed (${res.status})`); setStage("upload"); return }
      setData(d.data)
      setExcluded({})
      setStage("review")
    } catch (e: any) {
      setError(e?.message || "Analysis failed"); setStage("upload")
    }
  }

  function toggleItem(section: string, idx: number) {
    setExcluded(prev => {
      const next = { ...prev, [section]: new Set(prev[section] || []) }
      next[section].has(idx) ? next[section].delete(idx) : next[section].add(idx)
      return next
    })
  }
  const isIn = (section: string, idx: number) => !(excluded[section]?.has(idx))
  const countIn = (section: string) => (data?.[section] || []).filter((_: any, i: number) => isIn(section, i)).length

  function setProjField(k: string, v: any) { setData((d: any) => ({ ...d, project: { ...d.project, [k]: v } })) }

  async function create() {
    setStage("creating"); setError("")
    const pick = (section: string) => (data[section] || []).filter((_: any, i: number) => isIn(section, i))
    // Tasks referencing an excluded phase lose the reference (become unphased)
    const keptPhases = pick("phases")
    const keptNames = new Set(keptPhases.map((p: any) => p.name))
    const payload = {
      project: data.project,
      phases: keptPhases,
      tasks: pick("tasks").map((t: any) => ({ ...t, phaseName: keptNames.has(t.phaseName) ? t.phaseName : null })),
      milestones: pick("milestones"),
      risks: pick("risks"),
      budget: pick("budget"),
      sourceFile: data.sourceFile,
    }
    try {
      const res = await fetch("/api/projects/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
        body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d?.error || `Creation failed (${res.status})`); setStage("review"); return }
      router.push(`/projects/${d?.data?.projectId}`)
      router.refresh()
      onClose()
    } catch (e: any) {
      setError(e?.message || "Creation failed"); setStage("review")
    }
  }

  const inp: React.CSSProperties = {
    padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    fontSize: 13, fontFamily: "var(--font)", width: "100%", background: "#fff",
  }
  const lbl: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase",
    letterSpacing: ".06em", marginBottom: 3,
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(13,27,42,.55)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10,
        width: "min(880px, 96vw)", maxHeight: "92vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 60px rgba(13,27,42,.35)" }}>

        {/* Header */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>📄</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("New project from document")}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              {t("Upload a project plan — the AI builds the project, you review before anything is created")}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20,
            cursor: "pointer", color: "var(--text-3)" }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          {stage === "upload" && (
            <div
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) analyze(f) }}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${drag ? "var(--steel)" : "var(--border)"}`,
                background: drag ? "#EFF6FF" : "var(--surface)", borderRadius: 10,
                padding: "64px 24px", textAlign: "center", cursor: "pointer" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📎</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
                {t("Drop your project plan here, or click to browse")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                {t("Word · PDF (scans read visually) · Excel · text — max 8 MB")}
              </div>
              <input ref={fileRef} type="file" hidden accept=".docx,.doc,.pdf,.xlsx,.txt,.md"
                onChange={e => { const f = e.target.files?.[0]; if (f) analyze(f) }} />
            </div>
          )}

          {stage === "analyzing" && (
            <div style={{ textAlign: "center", padding: "70px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🤖</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>{t("Reading your plan…")}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                {t("Extracting phases, tasks, dates, milestones, risks, and budget — typically 15–30 seconds")}
              </div>
            </div>
          )}

          {stage === "creating" && (
            <div style={{ textAlign: "center", padding: "70px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🏗️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{t("Creating your project…")}</div>
            </div>
          )}

          {stage === "review" && data && (
            <div>
              {/* Summary strip */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                <span style={{ fontSize: 12, padding: "5px 12px", background: "#EFF6FF",
                  border: "1px solid #BFDBFE", borderRadius: 14, color: "var(--steel)", fontWeight: 600 }}>
                  📄 {data.sourceFile}
                </span>
                {Object.keys(SECTION_META).map(sec => (
                  <span key={sec} style={{ fontSize: 12, padding: "5px 12px", background: "var(--surface)",
                    border: "1px solid var(--border)", borderRadius: 14, color: "var(--text-2)" }}>
                    {SECTION_META[sec].icon} {countIn(sec)} {t(SECTION_META[sec].label as any).toLowerCase()}
                  </span>
                ))}
              </div>

              {/* Project fields */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 8, padding: 14, marginBottom: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div><div style={lbl}>{t("Project name *")}</div>
                    <input style={inp} value={data.project.name} onChange={e => setProjField("name", e.target.value)} /></div>
                  <div><div style={lbl}>{t("Methodology")}</div>
                    <select style={{ ...inp, cursor: "pointer" }} value={data.project.methodology}
                      onChange={e => setProjField("methodology", e.target.value)}>
                      {["WATERFALL", "AGILE", "SCRUM", "HYBRID"].map(m => <option key={m} value={m}>{m}</option>)}
                    </select></div>
                  <div><div style={lbl}>Budget ({data.project.currency})</div>
                    <input style={inp} type="number" value={data.project.budgetTotal ?? ""}
                      placeholder={t("from budget lines")}
                      onChange={e => setProjField("budgetTotal", e.target.value === "" ? null : Number(e.target.value))} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div><div style={lbl}>{t("Start date")}</div>
                    <DateField style={inp} value={data.project.startDate || ""}
                      onChange={e => setProjField("startDate", e.target.value || null)} /></div>
                  <div><div style={lbl}>{t("End date")}</div>
                    <DateField style={inp} value={data.project.endDate || ""}
                      onChange={e => setProjField("endDate", e.target.value || null)} /></div>
                </div>
                {data.project.objective && (
                  <div><div style={lbl}>{t("Objective")}</div>
                    <textarea style={{ ...inp, resize: "vertical" }} rows={2} value={data.project.objective}
                      onChange={e => setProjField("objective", e.target.value)} /></div>
                )}
              </div>

              {/* Sections */}
              {Object.keys(SECTION_META).map(sec => {
                const items = data[sec] || []
                if (!items.length) return null
                const meta = SECTION_META[sec]
                return (
                  <div key={sec} style={{ border: "1px solid var(--border)", borderRadius: 8, marginBottom: 10 }}>
                    <div onClick={() => setOpen(o => ({ ...o, [sec]: !o[sec] }))}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                        background: "var(--surface)", cursor: "pointer",
                        borderRadius: open[sec] ? "8px 8px 0 0" : 8 }}>
                      <span style={{ fontSize: 13 }}>{open[sec] ? "▾" : "▸"}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                        {meta.icon} {t(meta.label as any)}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {countIn(sec)} {t("of")} {items.length} {t("selected")}
                      </span>
                    </div>
                    {open[sec] && (
                      <div style={{ maxHeight: 260, overflowY: "auto" }}>
                        {items.map((it: any, i: number) => (
                          <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10,
                            padding: "8px 14px", borderTop: "1px solid var(--border)", cursor: "pointer",
                            opacity: isIn(sec, i) ? 1 : 0.45 }}>
                            <input type="checkbox" checked={isIn(sec, i)} onChange={() => toggleItem(sec, i)}
                              style={{ marginTop: 3 }} />
                            <span style={{ fontSize: 12.5, color: "var(--text)", flex: 1 }}>
                              {sec === "phases" && <strong>{i + 1}. {it.name}</strong>}
                              {sec === "tasks" && (<>
                                {it.title}
                                <span style={{ color: "var(--text-3)", fontSize: 11 }}>
                                  {it.phaseName ? `  · ${it.phaseName}` : ""}
                                  {it.startDate || it.dueDate ? `  · ${it.startDate || "…"} → ${it.dueDate || "…"}` : ""}
                                  {it.priority ? `  · ${it.priority}` : ""}
                                </span>
                              </>)}
                              {sec === "milestones" && (<><strong>{it.name}</strong>
                                <span style={{ color: "var(--text-3)", fontSize: 11 }}>  · {it.dueDate}</span></>)}
                              {sec === "risks" && (<>
                                {it.title}
                                <span style={{ color: "var(--text-3)", fontSize: 11 }}>  · {it.probability} / {it.impact}</span>
                              </>)}
                              {sec === "budget" && (<>
                                {it.name}
                                <span style={{ color: "var(--text-3)", fontSize: 11 }}>
                                  {"  "}· {it.category} · {Number(it.plannedCost).toLocaleString("en-US", { style: "currency", currency: data.project.currency || "USD", maximumFractionDigits: 0 })}
                                </span>
                              </>)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {error && <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 12 }}>✗ {error}</div>}
        </div>

        {/* Footer */}
        {stage === "review" && data && (
          <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)",
            display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => { setStage("upload"); setData(null); setError("") }}
              style={{ padding: "9px 14px", background: "#fff", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", fontSize: 13, cursor: "pointer",
                fontFamily: "var(--font)", color: "var(--text-2)" }}>
              {t("← Different file")}
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={create} disabled={!data.project.name?.trim()}
              style={{ padding: "11px 22px", background: "var(--steel)", color: "#fff", border: "none",
                borderRadius: "var(--radius)", fontSize: 14, fontWeight: 600,
                fontFamily: "var(--font)", cursor: "pointer" }}>
              {t("🏗️ Create project with")} {countIn("phases") + countIn("tasks") + countIn("milestones") + countIn("risks") + countIn("budget")} {t("items")}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
