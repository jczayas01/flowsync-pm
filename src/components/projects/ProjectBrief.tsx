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
  return new Date(d).toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })
}
function fmtCurrency(n: number, currency = "USD") {
  if (n >= 1_000_000) return `${currency} ${(n/1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${currency} ${(n/1_000).toFixed(0)}K`
  return `${currency} ${n.toLocaleString()}`
}

const SECTIONS = [
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

export function ProjectBrief({ projectId, project, members, workspaceName }: {
  projectId: string
  project: any
  members: any[]
  workspaceName?: string
}) {
  const router = useRouter()
  const [editingKey, setEditingKey] = useState<string|null>(null)
  const [editValue, setEditValue]   = useState("")
  const [saving, setSaving]         = useState(false)
  const [localProject, setLocalProject] = useState(project)

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

        {/* Print button */}
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:16 }}>
          <button onClick={() => window.print()}
            style={{ padding:"7px 14px", background:"#fff", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
              fontFamily:"var(--font)", color:"var(--text-2)" }}>
            🖨 Print / Export PDF
          </button>
        </div>

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
            {[
              { label:"Start date",  value: fmtDate(localProject?.startDate) },
              { label:"End date",    value: fmtDate(localProject?.endDate) },
              { label:"Budget",      value: fmtCurrency(localProject?.budgetTotal || 0, localProject?.currency) },
              { label:"Status",      value: localProject?.status || "—" },
            ].map((item, i) => (
              <div key={item.label} style={{ padding:"12px 18px",
                borderRight: i < 3 ? "1px solid var(--border)" : "none" }}>
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
