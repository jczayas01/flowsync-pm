"use client"
// src/components/projects/tabs/ProjectLessonsTab.tsx
// PM Best Practices — Continuous improvement through lessons learned

import { useState } from "react"
import { usePermissions } from "@/lib/rbac/usePermissions"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/ui"

const CATEGORIES = [
  "PLANNING","EXECUTION","STAKEHOLDER","RISK","COMMUNICATION",
  "TEAM","TECHNICAL","PROCUREMENT","QUALITY","OTHER"
]
const CAT_LABEL: Record<string,string> = {
  PLANNING:"Planning", EXECUTION:"Execution", STAKEHOLDER:"Stakeholder Management",
  RISK:"Risk", COMMUNICATION:"Communication", TEAM:"Team", TECHNICAL:"Technical",
  PROCUREMENT:"Procurement", QUALITY:"Quality", OTHER:"Other"
}
const CAT_COLOR: Record<string,string> = {
  PLANNING:"#1B6CA8", EXECUTION:"#059669", STAKEHOLDER:"#7C3AED",
  RISK:"#DC2626", COMMUNICATION:"#F59E0B", TEAM:"#0E7490",
  TECHNICAL:"#64748B", PROCUREMENT:"#92400E", QUALITY:"#065F46", OTHER:"#94A3B8"
}
const CAT_BG: Record<string,string> = {
  PLANNING:"#EFF6FF", EXECUTION:"#ECFDF5", STAKEHOLDER:"#F5F3FF",
  RISK:"#FEF2F2", COMMUNICATION:"#FFFBEB", TEAM:"#ECFEFF",
  TECHNICAL:"#F8FAFC", PROCUREMENT:"#FFFBEB", QUALITY:"#F0FDF4", OTHER:"#F8FAFC"
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })
}

export function ProjectLessonsTab({ projectId, workspaceId, lessons, phases }: {
  projectId:string; workspaceId:string; lessons:any[]; phases:any[]
}) {
  const { can } = usePermissions()
  const router = useRouter()
  const [view, setView] = useState<"list"|"create"|"detail">("list")
  const [selected, setSelected] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [catFilter, setCatFilter] = useState("")
  const [impactFilter, setImpactFilter] = useState("")
  const [deletingId, setDeletingId] = useState<string|null>(null)

  const emptyForm = {
    title:"", category:"OTHER", phase:"",
    situation:"", lesson:"", recommendation:"", impact:"NEGATIVE" as "POSITIVE"|"NEGATIVE",
  }
  const [form, setForm] = useState(emptyForm)

  const filtered = lessons.filter(l => {
    if (catFilter && l.category !== catFilter) return false
    if (impactFilter && l.impact !== impactFilter) return false
    return true
  })

  const positiveCount = lessons.filter(l => l.impact === "POSITIVE").length
  const negativeCount = lessons.filter(l => l.impact === "NEGATIVE").length

  async function createLesson() {
    if (!form.title.trim() || !form.situation.trim() || !form.lesson.trim() || !form.recommendation.trim()) {
      setError("Title, Situation, Lesson, and Recommendation are all required")
      return
    }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/lessons`, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ ...form, phase: form.phase || null }),
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        setError(d.error || "Failed to save")
        return
      }
      setView("list")
      setForm(emptyForm)
      router.refresh()
    } catch { setError("Network error") }
    finally { setSaving(false) }
  }

  async function deleteLesson(lessonId: string) {
    if (!confirm("Delete this lesson? This cannot be undone.")) return
    setDeletingId(lessonId)
    try {
      await fetch(`/api/projects/${projectId}/lessons/${lessonId}`, {
        method:"DELETE", headers:{"x-workspace-id":workspaceId},
      })
      router.refresh()
      if (selected?.id === lessonId) { setSelected(null); setView("list") }
    } finally { setDeletingId(null) }
  }

  const inp: React.CSSProperties = {
    width:"100%", padding:"9px 12px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    color:"var(--text)", outline:"none",
  }
  const lbl: React.CSSProperties = {
    display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
    marginBottom:5, textTransform:"uppercase", letterSpacing:".05em",
  }
  const card: React.CSSProperties = {
    background:"#fff", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", padding:18, marginBottom:14,
  }

  // ── CREATE FORM ──────────────────────────────────────────────
  if (view === "create") {
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
        <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
          padding:"12px 20px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <button onClick={() => setView("list")}
            style={{ fontSize:12, color:"var(--text-3)", background:"none", border:"none",
              cursor:"pointer", fontFamily:"var(--font)" }}>
            ← Lessons Learned
          </button>
          <span style={{ color:"var(--border)" }}>›</span>
          <span style={{ fontSize:14, fontWeight:600, color:"var(--text)" }}>New Lesson</span>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:20 }}>
          <div style={{ maxWidth:720, margin:"0 auto" }}>
            {error && (
              <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"var(--red)",
                padding:"10px 14px", borderRadius:"var(--radius)", fontSize:13, marginBottom:16 }}>
                ✗ {error}
              </div>
            )}

            {/* PM Standard context banner */}
            <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE",
              borderRadius:"var(--radius)", padding:"12px 14px", marginBottom:20,
              fontSize:12, color:"#1E40AF", lineHeight:1.6 }}>
              <strong>PM Best Practices — Continuous Improvement:</strong> Lessons learned capture
              knowledge gained during a project to improve future performance.
              Record both what went wrong (threats) and what went well (opportunities) —
              both are valuable for the organization.
            </div>

            <div style={card}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:14 }}>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={lbl}>Title *</label>
                  <input style={inp} value={form.title} placeholder="Brief summary of the lesson..."
                    onChange={e => setForm(f=>({...f,title:e.target.value}))} />
                </div>
                <div>
                  <label style={lbl}>Category</label>
                  <select style={{...inp,cursor:"pointer"}} value={form.category}
                    onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Phase</label>
                  <select style={{...inp,cursor:"pointer"}} value={form.phase}
                    onChange={e => setForm(f=>({...f,phase:e.target.value}))}>
                    <option value="">— Project-wide —</option>
                    {phases.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Impact type</label>
                  <div style={{ display:"flex", gap:8 }}>
                    {[
                      {v:"NEGATIVE",l:"⚠ Issue / Threat",  bg:"#FEF2F2", border:"#FECACA", active:"#DC2626"},
                      {v:"POSITIVE",l:"✓ What worked well", bg:"#ECFDF5", border:"#BBF7D0", active:"#059669"},
                    ].map(opt => (
                      <button key={opt.v} onClick={() => setForm(f=>({...f,impact:opt.v as any}))}
                        style={{ flex:1, padding:"8px 6px", border:`2px solid ${form.impact===opt.v?opt.active:opt.border}`,
                          borderRadius:"var(--radius)", background:form.impact===opt.v?opt.bg:"#fff",
                          fontSize:11, fontWeight:form.impact===opt.v?700:400,
                          color:form.impact===opt.v?opt.active:"var(--text-3)",
                          cursor:"pointer", fontFamily:"var(--font)" }}>
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* The three core fields — what happened, what learned, what to do differently */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={card}>
                <label style={lbl}>📋 Situation — What happened? *</label>
                <textarea rows={4} style={{...inp, resize:"vertical", lineHeight:1.65}}
                  value={form.situation}
                  placeholder="Describe the situation or event that occurred. Be specific — when, what, who was involved, what was the impact..."
                  onChange={e => setForm(f=>({...f,situation:e.target.value}))} />
              </div>

              <div style={card}>
                <label style={lbl}>💡 Lesson — What did we learn? *</label>
                <textarea rows={4} style={{...inp, resize:"vertical", lineHeight:1.65}}
                  value={form.lesson}
                  placeholder="What was learned from this situation? What was the root cause? What would you do differently if you could go back?"
                  onChange={e => setForm(f=>({...f,lesson:e.target.value}))} />
              </div>

              <div style={card}>
                <label style={lbl}>→ Recommendation — What should future projects do? *</label>
                <textarea rows={4} style={{...inp, resize:"vertical", lineHeight:1.65}}
                  value={form.recommendation}
                  placeholder="Provide a concrete, actionable recommendation for future projects. Be specific enough that someone who wasn't on this project can follow it..."
                  onChange={e => setForm(f=>({...f,recommendation:e.target.value}))} />
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:20 }}>
              <button onClick={() => setView("list")}
                style={{ padding:"10px 20px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:13, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>
                Cancel
              </button>
              <button onClick={createLesson} disabled={saving||!form.title.trim()}
                style={{ padding:"10px 24px", background:"var(--steel)", color:"#fff", border:"none",
                  borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                  cursor:saving?"wait":"pointer", fontFamily:"var(--font)",
                  opacity:!form.title.trim()?0.5:1 }}>
                {saving ? "Saving…" : "Save Lesson"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── DETAIL VIEW ──────────────────────────────────────────────
  if (view === "detail" && selected) {
    const l = selected
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
        <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
          padding:"12px 20px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <button onClick={() => { setView("list"); setSelected(null) }}
            style={{ fontSize:12, color:"var(--text-3)", background:"none", border:"none",
              cursor:"pointer", fontFamily:"var(--font)" }}>
            ← Lessons Learned
          </button>
          <span style={{ color:"var(--border)" }}>›</span>
          <span style={{ fontSize:14, fontWeight:600, color:"var(--text)" }}>{l.title}</span>
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
            {can("projects:edit") && (
            <button onClick={() => deleteLesson(l.id)} disabled={deletingId===l.id}
              style={{ padding:"6px 12px", background:"#FEF2F2", border:"1px solid #FECACA",
                borderRadius:"var(--radius)", fontSize:12, color:"var(--red)",
                cursor:"pointer", fontFamily:"var(--font)" }}>
              {deletingId===l.id ? "Deleting…" : "Delete"}
            </button>
            )}
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:24, background:"var(--surface)" }}>
          <div style={{ maxWidth:720, margin:"0 auto", background:"#fff",
            border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"28px 32px" }}>

            <div style={{ borderBottom:"3px solid var(--steel)", paddingBottom:16, marginBottom:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700,
                  color:CAT_COLOR[l.category]||"#64748B",
                  background:CAT_BG[l.category]||"#F8FAFC" }}>
                  {CAT_LABEL[l.category]||l.category}
                </span>
                <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700,
                  color:l.impact==="POSITIVE"?"var(--green)":"var(--red)",
                  background:l.impact==="POSITIVE"?"#ECFDF5":"#FEF2F2" }}>
                  {l.impact==="POSITIVE" ? "✓ What worked well" : "⚠ Issue / Threat"}
                </span>
                {l.phase && (
                  <span style={{ fontSize:11, color:"var(--text-3)", fontWeight:500 }}>
                    Phase: {l.phase}
                  </span>
                )}
              </div>
              <h2 style={{ fontSize:20, fontWeight:700, color:"var(--text)", margin:0 }}>{l.title}</h2>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8 }}>
                {l.createdBy && <Avatar name={l.createdBy.name} size={18} />}
                <span style={{ fontSize:11, color:"var(--text-3)" }}>
                  {l.createdBy?.name} · {fmtDate(l.createdAt)}
                </span>
              </div>
            </div>

            {[
              { icon:"📋", label:"Situation", text:l.situation, bg:"var(--surface)" },
              { icon:"💡", label:"Lesson Learned", text:l.lesson, bg:"#FFFBEB" },
              { icon:"→",  label:"Recommendation", text:l.recommendation, bg:"#EFF6FF" },
            ].map(section => (
              <div key={section.label} style={{ background:section.bg,
                borderRadius:"var(--radius)", padding:"14px 16px", marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--text-3)",
                  textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>
                  {section.icon} {section.label}
                </div>
                <p style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.75, margin:0,
                  whiteSpace:"pre-line" }}>
                  {section.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between",
        flexShrink:0 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:600, color:"var(--text)" }}>Lessons Learned</div>
          <div style={{ fontSize:12, color:"var(--text-3)" }}>
            {lessons.length} lessons · {positiveCount} positive · {negativeCount} issues
          </div>
        </div>
        {can("projects:edit") && (<button onClick={() => setView("create")}
          style={{ padding:"8px 16px", background:"var(--steel)", color:"#fff", border:"none",
            borderRadius:"var(--radius)", fontSize:13, fontWeight:500, cursor:"pointer",
            fontFamily:"var(--font)" }}>
          + Add lesson
        </button>)}
      </div>

      {/* Filters */}
      {lessons.length > 0 && (
        <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)",
          padding:"8px 16px", display:"flex", gap:8, flexShrink:0 }}>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            style={{ padding:"5px 10px", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", fontSize:12, fontFamily:"var(--font)",
              color:"var(--text-2)", cursor:"pointer" }}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </select>
          <select value={impactFilter} onChange={e => setImpactFilter(e.target.value)}
            style={{ padding:"5px 10px", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", fontSize:12, fontFamily:"var(--font)",
              color:"var(--text-2)", cursor:"pointer" }}>
            <option value="">All types</option>
            <option value="POSITIVE">✓ What worked well</option>
            <option value="NEGATIVE">⚠ Issues / Threats</option>
          </select>
          <span style={{ fontSize:12, color:"var(--text-3)", alignSelf:"center" }}>
            {filtered.length} shown
          </span>
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", padding:20 }}>
        {lessons.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>📚</div>
            <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>
              No lessons recorded yet
            </div>
            <div style={{ fontSize:13, color:"var(--text-3)", marginBottom:6, maxWidth:440, margin:"0 auto 8px" }}>
              PM best practices require lessons learned to be captured throughout the project life cycle —
              not just at the end.
            </div>
            <div style={{ fontSize:12, color:"var(--text-4)", marginBottom:20, maxWidth:400, margin:"0 auto 20px" }}>
              Record both what went well and what went wrong. Both are valuable knowledge assets.
            </div>
            <button onClick={() => setView("create")}
              style={{ padding:"10px 20px", background:"var(--steel)", color:"#fff", border:"none",
                borderRadius:"var(--radius)", fontSize:13, fontWeight:500, cursor:"pointer",
                fontFamily:"var(--font)" }}>
              Record first lesson
            </button>
          </div>
        ) : (
          <div style={{ maxWidth:760, margin:"0 auto", display:"flex", flexDirection:"column", gap:10 }}>
            {filtered.map(l => {
              const cc = CAT_COLOR[l.category] || "#64748B"
              const cb = CAT_BG[l.category]   || "#F8FAFC"
              return (
                <div key={l.id} onClick={() => { setSelected(l); setView("detail") }}
                  style={{ background:"#fff", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", padding:"14px 18px", cursor:"pointer",
                    display:"flex", alignItems:"flex-start", gap:14 }}
                  onMouseOver={e => (e.currentTarget.style.boxShadow="var(--shadow-md)")}
                  onMouseOut={e  => (e.currentTarget.style.boxShadow="none")}>
                  {/* Impact indicator */}
                  <div style={{ width:4, alignSelf:"stretch", borderRadius:2, flexShrink:0,
                    background:l.impact==="POSITIVE"?"var(--green)":"var(--red)" }} />

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px",
                        borderRadius:10, color:cc, background:cb }}>
                        {CAT_LABEL[l.category]}
                      </span>
                      {l.phase && (
                        <span style={{ fontSize:10, color:"var(--text-3)" }}>{l.phase}</span>
                      )}
                      <span style={{ fontSize:10, fontWeight:600,
                        color:l.impact==="POSITIVE"?"var(--green)":"var(--red)" }}>
                        {l.impact==="POSITIVE" ? "✓ What worked" : "⚠ Issue"}
                      </span>
                    </div>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text)",
                      marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {l.title}
                    </div>
                    <div style={{ fontSize:11, color:"var(--text-3)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {l.lesson?.slice(0,100)}{l.lesson?.length>100?"…":""}
                    </div>
                  </div>

                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end",
                    gap:6, flexShrink:0 }}>
                    {l.createdBy && (
                      <Avatar name={l.createdBy.name} avatarUrl={l.createdBy.avatarUrl} size={22} />
                    )}
                    <span style={{ fontSize:10, color:"var(--text-4)" }}>
                      {fmtDate(l.createdAt)}
                    </span>
                    <span style={{ fontSize:11, color:"var(--steel)" }}>View →</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
