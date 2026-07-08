"use client"
// src/components/projects/tabs/RequirementsTab.tsx
// Requirements Documentation + Traceability Matrix

import { useState } from "react"
import { usePermissions } from "@/lib/rbac/usePermissions"
import { useRouter } from "next/navigation"

const REQ_TYPES  = ["FUNCTIONAL","NON_FUNCTIONAL","BUSINESS","TECHNICAL","REGULATORY","OTHER"]
const PRIORITIES = ["CRITICAL","HIGH","MEDIUM","LOW"]
const STATUSES   = ["DRAFT","APPROVED","IMPLEMENTED","VERIFIED","REJECTED"]

const STATUS_CFG: Record<string,{color:string;bg:string}> = {
  DRAFT:       { color:"#64748B", bg:"#F8FAFC" },
  APPROVED:    { color:"#059669", bg:"#ECFDF5" },
  IMPLEMENTED: { color:"#1B6CA8", bg:"#EFF6FF" },
  VERIFIED:    { color:"#7C3AED", bg:"#F5F3FF" },
  REJECTED:    { color:"#DC2626", bg:"#FEF2F2" },
}
const PRIORITY_CFG: Record<string,{color:string}> = {
  CRITICAL:{ color:"#DC2626" }, HIGH:{ color:"#D97706" },
  MEDIUM:  { color:"#1B6CA8" }, LOW:{ color:"#64748B" },
}

const inp: React.CSSProperties = {
  width:"100%", padding:"8px 12px", border:"1px solid var(--border)",
  borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
  color:"var(--text)", outline:"none",
}
const lbl: React.CSSProperties = {
  display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
  textTransform:"uppercase", letterSpacing:".05em", marginBottom:5,
}

export function RequirementsTab({ projectId, workspaceId, requirements, tasks }: {
  projectId:string; workspaceId:string; requirements:any[]; tasks:any[]
}) {
  const { can } = usePermissions()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"register"|"matrix">("register")
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState("")
  const [filter, setFilter]       = useState("ALL")
  const [form, setForm] = useState({
    code:"", title:"", description:"", type:"FUNCTIONAL",
    priority:"MEDIUM", status:"DRAFT", source:"", acceptanceCriteria:"", linkedTaskId:"",
  })

  function resetForm() {
    setForm({ code:"", title:"", description:"", type:"FUNCTIONAL",
      priority:"MEDIUM", status:"DRAFT", source:"", acceptanceCriteria:"", linkedTaskId:"" })
  }

  // Auto-generate next code
  function nextCode() {
    if (requirements.length === 0) return "REQ-001"
    const nums = requirements.map(r => parseInt((r.code||"").replace(/^REQ-/,""),10)).filter(n=>!isNaN(n))
    const max  = nums.length ? Math.max(...nums) : 0
    return `REQ-${String(max+1).padStart(3,"0")}`
  }

  async function save() {
    if (!form.title.trim()) { setError("Title required"); return }
    setSaving(true); setError("")
    try {
      const code = form.code || nextCode()
      const res = await fetch(`/api/projects/${projectId}/requirements`, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ ...form, code, linkedTaskId:form.linkedTaskId||null }),
      })
      if (!res.ok) { const d=await res.json().catch(()=>({})); setError(d.error||"Failed"); return }
      setShowForm(false); resetForm(); router.refresh()
    } finally { setSaving(false) }
  }

  async function updateStatus(id:string, status:string) {
    await fetch(`/api/projects/${projectId}/requirements/${id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
      body: JSON.stringify({ status }),
    })
    router.refresh()
  }

  const filtered = filter==="ALL" ? requirements : requirements.filter(r=>r.type===filter)

  // Traceability stats
  const total     = requirements.length
  const approved  = requirements.filter(r=>r.status==="APPROVED").length
  const verified  = requirements.filter(r=>r.status==="VERIFIED").length
  const linked    = requirements.filter(r=>r.linkedTaskId).length

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Header */}
      <div style={{ background:"var(--steel)", padding:"12px 20px", color:"#fff", flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:16, fontWeight:700 }}>📋 Requirements</div>
          <div style={{ fontSize:11, opacity:.6, marginTop:2 }}>
            {total} requirements · {approved} approved · {verified} verified · {linked} linked to tasks
          </div>
        </div>
        <button onClick={()=>{setShowForm(s=>!s);setError("")}}
          style={{ padding:"7px 16px", background:"rgba(255,255,255,.15)", color:"#fff",
            border:"1px solid rgba(255,255,255,.3)", borderRadius:"var(--radius)",
            fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}>
          {showForm?"Cancel":"+ Add requirement"}
        </button>
      </div>

      {/* Sub-tabs */}
      <div style={{ display:"flex", borderBottom:"1px solid var(--border)", background:"#fff", flexShrink:0 }}>
        {[
          { id:"register", label:`Requirements Register (${total})` },
          { id:"matrix",   label:"Traceability Matrix" },
        ].map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id as any)}
            style={{ padding:"10px 18px", fontSize:12, fontWeight:500, cursor:"pointer",
              background:"none", border:"none",
              borderBottom:`2px solid ${activeTab===t.id?"var(--steel)":"transparent"}`,
              color:activeTab===t.id?"var(--steel)":"var(--text-3)",
              fontFamily:"var(--font)", marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:16 }}>
        {error && (
          <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"var(--red)",
            padding:"9px 14px", borderRadius:"var(--radius)", fontSize:12, marginBottom:12 }}>
            ✗ {error}
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:20, marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>New Requirement</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 3fr", gap:12, marginBottom:10 }}>
              <div>
                <label style={lbl}>Code</label>
                <input style={inp} value={form.code} placeholder={nextCode()}
                  onChange={e=>setForm(f=>({...f,code:e.target.value}))} />
              </div>
              <div>
                <label style={lbl}>Title *</label>
                <input style={inp} value={form.title}
                  onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                  placeholder="e.g. System must support 500 concurrent users" />
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={lbl}>Description</label>
              <textarea rows={3} style={{...inp,resize:"vertical",lineHeight:1.6}}
                value={form.description}
                onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
              <div>
                <label style={lbl}>Type</label>
                <select style={{...inp,cursor:"pointer"}} value={form.type}
                  onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  {REQ_TYPES.map(t=><option key={t}>{t.replace(/_/g," ")}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Priority</label>
                <select style={{...inp,cursor:"pointer"}} value={form.priority}
                  onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
                  {PRIORITIES.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select style={{...inp,cursor:"pointer"}} value={form.status}
                  onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  {STATUSES.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div>
                <label style={lbl}>Source / Stakeholder</label>
                <input style={inp} value={form.source}
                  onChange={e=>setForm(f=>({...f,source:e.target.value}))}
                  placeholder="Who requested this?" />
              </div>
              <div>
                <label style={lbl}>Link to task</label>
                <select style={{...inp,cursor:"pointer"}} value={form.linkedTaskId}
                  onChange={e=>setForm(f=>({...f,linkedTaskId:e.target.value}))}>
                  <option value="">No linked task</option>
                  {tasks.map(t=><option key={t.id} value={t.id}>{t.code}: {t.title}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Acceptance Criteria</label>
              <textarea rows={2} style={{...inp,resize:"vertical",lineHeight:1.6}}
                value={form.acceptanceCriteria}
                onChange={e=>setForm(f=>({...f,acceptanceCriteria:e.target.value}))}
                placeholder="What must be true for this requirement to be verified?" />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={save} disabled={saving||!form.title.trim()}
                style={{ padding:"9px 20px", background:"var(--steel)", color:"#fff",
                  border:"none", borderRadius:"var(--radius)", fontSize:12, fontWeight:500,
                  cursor:"pointer", fontFamily:"var(--font)", opacity:!form.title.trim()?0.5:1 }}>
                {saving?"Saving…":"Add requirement"}
              </button>
              <button onClick={()=>{setShowForm(false);resetForm();setError("")}}
                style={{ padding:"9px 16px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* REQUIREMENTS REGISTER */}
        {activeTab==="register" && (
          <>
            {/* Filter bar */}
            <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
              {["ALL",...REQ_TYPES].map(t=>(
                <button key={t} onClick={()=>setFilter(t)}
                  style={{ padding:"4px 10px", fontSize:11, cursor:"pointer",
                    borderRadius:20, fontFamily:"var(--font)",
                    border:`1px solid ${filter===t?"var(--steel)":"var(--border)"}`,
                    background:filter===t?"var(--steel)":"#fff",
                    color:filter===t?"#fff":"var(--text-3)" }}>
                  {t.replace(/_/g," ")}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign:"center", padding:"50px 20px" }}>
                <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
                <div style={{ fontSize:15, fontWeight:600, color:"var(--text)", marginBottom:8 }}>
                  No requirements yet
                </div>
                <div style={{ fontSize:13, color:"var(--text-3)", maxWidth:400, margin:"0 auto 16px" }}>
                  Document functional, non-functional, business and regulatory requirements.
                </div>
                {can("projects:edit") && (<button onClick={()=>setShowForm(true)}
                  style={{ padding:"9px 20px", background:"var(--steel)", color:"#fff",
                    border:"none", borderRadius:"var(--radius)", fontSize:13, cursor:"pointer",
                    fontFamily:"var(--font)" }}>
                  + Add first requirement
                </button>)}
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {filtered.map(r => {
                  const sc = STATUS_CFG[r.status]   || STATUS_CFG.DRAFT
                  const pc = PRIORITY_CFG[r.priority] || PRIORITY_CFG.MEDIUM
                  const linkedTask = tasks.find(t=>t.id===r.linkedTaskId)
                  return (
                    <div key={r.id} style={{ background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", padding:"12px 16px" }}>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                        <span style={{ fontFamily:"monospace", fontSize:11, color:"var(--steel)",
                          fontWeight:700, flexShrink:0, padding:"2px 6px",
                          background:"#EFF6FF", borderRadius:4 }}>{r.code}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3, flexWrap:"wrap" }}>
                            <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{r.title}</span>
                            <span style={{ fontSize:9, padding:"1px 6px", borderRadius:8,
                              background:sc.bg, color:sc.color, fontWeight:700 }}>{r.status}</span>
                            <span style={{ fontSize:9, color:pc.color, fontWeight:700 }}>{r.priority}</span>
                            <span style={{ fontSize:9, color:"var(--text-4)" }}>{r.type.replace(/_/g," ")}</span>
                          </div>
                          {r.description && (
                            <p style={{ fontSize:11, color:"var(--text-3)", margin:"0 0 4px", lineHeight:1.5 }}>
                              {r.description}
                            </p>
                          )}
                          {r.acceptanceCriteria && (
                            <div style={{ fontSize:11, color:"var(--green)" }}>
                              ✓ {r.acceptanceCriteria.slice(0,100)}{r.acceptanceCriteria.length>100?"…":""}
                            </div>
                          )}
                          {linkedTask && (
                            <div style={{ fontSize:10, color:"var(--steel)", marginTop:4 }}>
                              🔗 Linked to: {linkedTask.code} — {linkedTask.title}
                            </div>
                          )}
                          {r.source && (
                            <div style={{ fontSize:10, color:"var(--text-4)", marginTop:3 }}>
                              Source: {r.source}
                            </div>
                          )}
                        </div>
                        <select value={r.status}
                          onChange={e=>updateStatus(r.id, e.target.value)}
                          style={{ padding:"4px 8px", fontSize:11, fontWeight:700, cursor:"pointer",
                            border:`1px solid ${sc.color}30`, background:sc.bg, color:sc.color,
                            borderRadius:"var(--radius)", fontFamily:"var(--font)",
                            appearance:"none" as const, flexShrink:0 }}>
                          {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* TRACEABILITY MATRIX */}
        {activeTab==="matrix" && (
          <div>
            <div style={{ fontSize:12, color:"var(--text-3)", marginBottom:14, lineHeight:1.6 }}>
              The Requirements Traceability Matrix (RTM) links each requirement to a task, its status,
              and verification result. Ensures all requirements are implemented and tested.
            </div>
            {requirements.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px", color:"var(--text-3)" }}>
                Add requirements first to build the traceability matrix.
              </div>
            ) : (
              <div style={{ background:"#fff", border:"1px solid var(--border)",
                borderRadius:"var(--radius)", overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"var(--steel)" }}>
                      {["REQ ID","Title","Type","Priority","Status","Linked Task","Task Status","Verified"].map(h=>(
                        <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontSize:10,
                          fontWeight:700, color:"#fff", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requirements.map((r,i)=>{
                      const linkedTask = tasks.find(t=>t.id===r.linkedTaskId)
                      const sc = STATUS_CFG[r.status] || STATUS_CFG.DRAFT
                      return (
                        <tr key={r.id} style={{ borderBottom:"1px solid var(--border)",
                          background:i%2===0?"#fff":"var(--surface)" }}>
                          <td style={{ padding:"9px 12px", fontFamily:"monospace", fontSize:11,
                            color:"var(--steel)", fontWeight:700 }}>{r.code}</td>
                          <td style={{ padding:"9px 12px", fontSize:12, color:"var(--text)",
                            maxWidth:200, overflow:"hidden", textOverflow:"ellipsis",
                            whiteSpace:"nowrap" }}>{r.title}</td>
                          <td style={{ padding:"9px 12px", fontSize:10, color:"var(--text-3)" }}>
                            {r.type?.replace(/_/g," ")}
                          </td>
                          <td style={{ padding:"9px 12px", fontSize:10, fontWeight:700,
                            color:(PRIORITY_CFG[r.priority]||PRIORITY_CFG.MEDIUM).color }}>
                            {r.priority}
                          </td>
                          <td style={{ padding:"9px 12px" }}>
                            <span style={{ fontSize:9, padding:"2px 7px", borderRadius:8,
                              background:sc.bg, color:sc.color, fontWeight:700 }}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ padding:"9px 12px", fontSize:11, color:"var(--text-2)" }}>
                            {linkedTask ? `${linkedTask.code}: ${linkedTask.title?.slice(0,30)}` : "—"}
                          </td>
                          <td style={{ padding:"9px 12px" }}>
                            {linkedTask ? (
                              <span style={{ fontSize:9, fontWeight:700,
                                color:linkedTask.status==="DONE"?"#059669":"#D97706" }}>
                                {linkedTask.status?.replace(/_/g," ")}
                              </span>
                            ) : "—"}
                          </td>
                          <td style={{ padding:"9px 12px", textAlign:"center", fontSize:14 }}>
                            {r.status==="VERIFIED" ? "✅" : r.status==="REJECTED" ? "❌" : "⏳"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {/* Summary */}
                <div style={{ padding:"10px 16px", background:"var(--surface)",
                  borderTop:"1px solid var(--border)", display:"flex", gap:20, fontSize:11 }}>
                  <span>Total: <strong>{total}</strong></span>
                  <span style={{ color:"#059669" }}>Verified: <strong>{verified}</strong></span>
                  <span style={{ color:"#1B6CA8" }}>Approved: <strong>{approved}</strong></span>
                  <span style={{ color:"#D97706" }}>Linked: <strong>{linked}/{total}</strong></span>
                  <span style={{ color:total>0&&verified===total?"#059669":"#D97706", fontWeight:700 }}>
                    Coverage: {total>0?Math.round((verified/total)*100):0}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
