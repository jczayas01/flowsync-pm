"use client"
// src/components/projects/ProjectBrief.tsx
// Structured one-page project brief — replaces the Wiki block editor.
// Sections: Background, Objective, Scope, Assumptions, Constraints, Team.
// Every section is inline-editable. Prints cleanly as a single page.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/ui"

const METHODOLOGY_LABEL: Record<string,string> = {
  WATERFALL:"Waterfall", AGILE:"Agile", SCRUM:"Scrum",
  KANBAN:"Kanban", HYBRID:"Hybrid", PRINCE2:"PRINCE2", PMI:"PM Standard",
}

import { getRoleDef } from "@/lib/roles"

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric", timeZone:"UTC" })
}
function fmtCurrency(n: number, currency = "USD") {
  if (n >= 1_000_000) return `${currency} ${(n/1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${currency} ${(n/1_000).toFixed(0)}K`
  return `${currency} ${n.toLocaleString()}`
}

const SECTIONS = [
  { key:"description",   label:"Project Description",  icon:"📝",
    hint:"A short summary of what this project is, in one or two paragraphs." },
  { key:"background",    label:"Background",           icon:"📋",
    hint:"Describe the business context, problem being solved, and why this project was initiated." },
  { key:"objective",     label:"Project Objective",    icon:"🎯",
    hint:"What must this project achieve? State the measurable outcomes and success criteria." },
  { key:"scope",         label:"In Scope",             icon:"✅",
    hint:"What deliverables and work are included in this project?" },
  { key:"outOfScope",    label:"Out of Scope",         icon:"🚫",
    hint:"What is explicitly excluded from this project?" },
  { key:"economicImpact",label:"Economic Impact / ROI",icon:"💹",
    hint:"Describe the expected financial benefit, cost savings, or ROI of this project." },
  { key:"assumptions",   label:"Assumptions",          icon:"💡",
    hint:"What conditions are assumed to be true for this project to succeed?" },
  { key:"constraints",   label:"Constraints",          icon:"⛓",
    hint:"Known limitations: budget ceiling, regulatory requirements, technology choices, deadlines." },
]

export function ProjectBrief({ projectId, project, members, workspaceName, documents = [] }: {
  projectId: string
  project: any
  members: any[]
  workspaceName?: string
  documents?: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [editingKey, setEditingKey] = useState<string|null>(null)
  const [editValue, setEditValue]   = useState("")
  const [saving, setSaving]         = useState(false)
  const [localProject, setLocalProject] = useState(project)

  // ── AI Brief generator state ──
  const [genOpen, setGenOpen]         = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(documents.map(d => d.id)))
  const [generating, setGenerating]   = useState(false)
  const [genError, setGenError]       = useState("")
  const [drafts, setDrafts]           = useState<Record<string,string>|null>(null)
  const [applying, setApplying]       = useState<string|null>(null)

  // ── Inline project date editing ──
  const [editingDate, setEditingDate] = useState<"startDate"|"endDate"|null>(null)

  async function saveDate(key: "startDate"|"endDate", value: string) {
    setEditingDate(null)
    if (!value) return
    const iso = new Date(value + "T00:00:00Z").toISOString()
    const prev = localProject?.[key]
    setLocalProject((p: any) => ({ ...p, [key]: iso }))  // optimistic
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: iso }),
      })
      if (!res.ok) setLocalProject((p: any) => ({ ...p, [key]: prev }))
      else router.refresh()
    } catch { setLocalProject((p: any) => ({ ...p, [key]: prev })) }
  }

  function toggleDoc(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function generateBrief() {
    setGenerating(true); setGenError(""); setDrafts(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/brief/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: [...selectedIds] }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setGenError(data?.error || `Request failed (${res.status})`); return }
      const d = data?.data?.drafts || {}
      if (!Object.keys(d).length) { setGenError("The documents didn't contain enough information to draft the brief"); return }
      setDrafts(d)
    } catch { setGenError("Connection lost — check your internet and try again") }
    finally { setGenerating(false) }
  }

  async function applyDraft(key: string) {
    if (!drafts?.[key]) return
    setApplying(key)
    try {
      await save(key, drafts[key])
      setDrafts(prev => {
        if (!prev) return prev
        const next = { ...prev }; delete next[key]
        return Object.keys(next).length ? next : null
      })
    } finally { setApplying(null) }
  }

  async function save(key: string, value: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ [key]: value || null }),
      })
      if (res.ok) {
        setLocalProject((p: any) => ({ ...p, [key]: value }))
        router.refresh()
      }
    } finally {
      setSaving(false)
      setEditingKey(null)
    }
  }

  // Group members by PMO role
  const byRole = (role: string) => members.filter(m => m.projectRole === role)
  const pm = byRole("PM")[0] || members.find(m => m.role === "PM")

  const sectionTitle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "var(--text-3)",
    textTransform: "uppercase", letterSpacing: ".07em",
    marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
  }
  const editBtn: React.CSSProperties = {
    marginLeft: "auto", fontSize: 11, color: "var(--steel)",
    background: "none", border: "none", cursor: "pointer",
    fontFamily: "var(--font)", fontWeight: 400, padding: "2px 6px",
  }
  const textArea: React.CSSProperties = {
    width: "100%", padding: "10px 12px", border: "1px solid var(--steel)",
    borderRadius: "var(--radius)", fontSize: 13, fontFamily: "var(--font)",
    lineHeight: 1.7, resize: "vertical", outline: "none", color: "var(--text)",
    minHeight: 100,
  }
  const saveBtn: React.CSSProperties = {
    padding: "7px 16px", background: "var(--steel)", color: "#fff",
    border: "none", borderRadius: "var(--radius)", fontSize: 12,
    fontWeight: 500, cursor: "pointer", fontFamily: "var(--font)",
  }
  const cancelBtn: React.CSSProperties = {
    padding: "7px 12px", background: "#fff", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", fontSize: 12, cursor: "pointer",
    fontFamily: "var(--font)", color: "var(--text-2)",
  }

  return (
    <div style={{ flex:1, overflowY:"auto", padding:24, background:"var(--surface)" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        {/* Print + Generate buttons */}
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginBottom:16 }}>
          {documents.length > 0 && (
            <button onClick={() => setGenOpen(o => !o)}
              style={{ padding:"7px 14px", background:"var(--steel)", border:"none",
                borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                fontFamily:"var(--font)", color:"#fff", fontWeight:500 }}>
              ✨ Generate from documents
            </button>
          )}
          <button onClick={() => window.print()}
            style={{ padding:"7px 14px", background:"#fff", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
              fontFamily:"var(--font)", color:"var(--text-2)" }}>
            🖨 Print / Export PDF
          </button>
        </div>

        {/* AI generator panel */}
        {genOpen && (
          <div className="no-print" style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:16, marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"var(--text-2)", marginBottom:10 }}>
              AI reads the selected documents and drafts the brief sections. Nothing is saved until you apply a draft.
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:12 }}>
              {documents.map(d => (
                <label key={d.id} style={{ display:"flex", alignItems:"center", gap:8,
                  fontSize:13, color:"var(--text)", cursor:"pointer" }}>
                  <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleDoc(d.id)} />
                  {d.name}
                </label>
              ))}
            </div>
            <button onClick={generateBrief} disabled={generating || selectedIds.size === 0}
              style={{ padding:"8px 18px", background:"var(--steel)", color:"#fff", border:"none",
                borderRadius:"var(--radius)", fontSize:13, fontWeight:500, fontFamily:"var(--font)",
                cursor: generating || selectedIds.size === 0 ? "not-allowed" : "pointer",
                opacity: generating || selectedIds.size === 0 ? 0.6 : 1 }}>
              {generating ? "Reading documents and drafting… (up to a minute)" : "Generate drafts →"}
            </button>
            {genError && (
              <div style={{ marginTop:10, padding:"8px 12px", background:"#FEF2F2",
                border:"1px solid #FECACA", borderRadius:"var(--radius)", fontSize:12, color:"#B91C1C" }}>
                ✗ {genError}
              </div>
            )}
            {drafts && (
              <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:12 }}>
                {SECTIONS.filter(s => drafts[s.key]).map(s => {
                  const hasExisting = !!(localProject?.[s.key] || "").trim()
                  return (
                    <div key={s.key} style={{ border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", padding:12, background:"var(--surface)" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                        <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                          letterSpacing:".05em", color:"var(--text-3)" }}>{s.icon} {s.label}</span>
                        {hasExisting && (
                          <span style={{ fontSize:11, color:"#B45309" }}>· will replace current text</span>
                        )}
                        <button onClick={() => applyDraft(s.key)} disabled={applying === s.key}
                          style={{ marginLeft:"auto", padding:"4px 12px", background:"var(--steel)",
                            color:"#fff", border:"none", borderRadius:"var(--radius)", fontSize:11,
                            fontWeight:500, fontFamily:"var(--font)",
                            cursor: applying === s.key ? "wait" : "pointer" }}>
                          {applying === s.key ? "Applying…" : "Apply"}
                        </button>
                      </div>
                      <div style={{ fontSize:13, lineHeight:1.6, color:"var(--text)", whiteSpace:"pre-wrap" }}>
                        {drafts[s.key]}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Brief document */}
        <div style={{ background:"#fff", border:"1px solid var(--border)",
          borderRadius:"var(--radius)", overflow:"hidden" }}>

          {/* Header */}
          <div style={{ background:"var(--steel)", padding:"24px 28px" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,.6)",
              textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>
              Project Brief
            </div>
            <h1 style={{ fontSize:22, fontWeight:700, color:"#fff", margin:0, lineHeight:1.2 }}>
              {localProject?.name}
            </h1>
            <div style={{ fontSize:13, color:"rgba(255,255,255,.7)", marginTop:6 }}>
              {localProject?.code}
              {localProject?.methodology && ` · ${METHODOLOGY_LABEL[localProject.methodology] || localProject.methodology}`}
            </div>
          </div>

          {/* Project vitals strip */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)",
            borderBottom:"1px solid var(--border)", background:"var(--surface)" }}>
            {/* Editable date cells */}
            {(["startDate","endDate"] as const).map((dk, i) => (
              <div key={dk} style={{ padding:"12px 18px", borderRight:"1px solid var(--border)" }}>
                <div style={{ fontSize:10, fontWeight:600, color:"var(--text-3)",
                  textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>
                  {dk === "startDate" ? "Start date" : "End date"}
                </div>
                {editingDate === dk ? (
                  <input type="date" autoFocus
                    defaultValue={localProject?.[dk] ? String(localProject[dk]).slice(0,10) : ""}
                    onBlur={e => saveDate(dk, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                      if (e.key === "Escape") setEditingDate(null)
                    }}
                    style={{ fontSize:13, fontWeight:600, color:"var(--text)", padding:"2px 4px",
                      border:"1px solid var(--steel)", borderRadius:6, fontFamily:"var(--font)",
                      background:"#fff", width:"100%" }} />
                ) : (
                  <div title="Click to change" onClick={() => setEditingDate(dk)}
                    style={{ fontSize:13, fontWeight:600, color:"var(--text)", cursor:"pointer",
                      borderBottom:"1px dashed var(--border)", display:"inline-block" }}>
                    {fmtDate(localProject?.[dk]) || "Set date…"}
                  </div>
                )}
              </div>
            ))}
            {[
              { label:"Budget",      value: fmtCurrency(localProject?.budgetTotal || 0, localProject?.currency) },
              { label:"Status",      value: localProject?.status || "—" },
            ].map((item, i) => (
              <div key={item.label} style={{ padding:"12px 18px",
                borderRight: i < 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ fontSize:10, fontWeight:600, color:"var(--text-3)",
                  textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>
                  {item.label}
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Content sections */}
          <div style={{ padding:"0 28px" }}>
            {SECTIONS.map((section, idx) => {
              const value = localProject?.[section.key]
              const isEditing = editingKey === section.key
              return (
                <div key={section.key} style={{
                  padding:"20px 0",
                  borderBottom: idx < SECTIONS.length-1 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={sectionTitle}>
                    <span>{section.icon}</span>
                    <span>{section.label}</span>
                    {!isEditing && (
                      <button style={editBtn}
                        onClick={() => { setEditingKey(section.key); setEditValue(value || "") }}>
                        {value ? "Edit" : "+ Add"}
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div>
                      <textarea
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        placeholder={section.hint}
                        style={textArea}
                      />
                      <div style={{ display:"flex", gap:8, marginTop:8 }}>
                        <button style={saveBtn} disabled={saving}
                          onClick={() => save(section.key, editValue)}>
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button style={cancelBtn}
                          onClick={() => setEditingKey(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : value ? (
                    <p style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.8,
                      margin:0, whiteSpace:"pre-line" }}>
                      {value}
                    </p>
                  ) : (
                    <p style={{ fontSize:13, color:"var(--text-4)", fontStyle:"italic",
                      margin:0, lineHeight:1.7 }}>
                      {section.hint}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Team section */}
          <div style={{ padding:"20px 28px", borderTop:"1px solid var(--border)",
            background:"var(--surface)" }}>
            <div style={sectionTitle}>
              <span>👥</span>
              <span>Project Team</span>
            </div>
            {members.length === 0 ? (
              <p style={{ fontSize:13, color:"var(--text-4)", fontStyle:"italic", margin:0 }}>
                No team members assigned yet — add them in the Team tab.
              </p>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:10 }}>
                {members.map(m => {
                  const roleMeta = m.projectRole
                    ? { label: getRoleDef(m.projectRole).label,
                        color: getRoleDef(m.projectRole).color }
                    : { label: m.role, color: "#94A3B8" }
                  return (
                    <div key={m.id} style={{ display:"flex", alignItems:"center", gap:9,
                      background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", padding:"9px 12px" }}>
                      <Avatar name={m.user?.name} avatarUrl={m.user?.avatarUrl} size={28} />
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:"var(--text)",
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {m.user?.name}
                        </div>
                        <div style={{ fontSize:10, fontWeight:600, marginTop:1,
                          color: roleMeta.color }}>
                          {roleMeta.label}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding:"12px 28px", borderTop:"1px solid var(--border)",
            display:"flex", justifyContent:"space-between",
            fontSize:10, color:"var(--text-4)" }}>
            <span>{workspaceName || "FlowSync PM"}</span>
            <span>Generated {new Date().toLocaleDateString("en-US",
              { month:"long", day:"numeric", year:"numeric" })}</span>
          </div>
        </div>

      </div>
    </div>
  )
}
