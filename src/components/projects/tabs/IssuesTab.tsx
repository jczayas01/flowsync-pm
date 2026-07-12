"use client"
// src/components/projects/tabs/IssuesTab.tsx
// PM Best Practices — Issue Log (current problems, distinct from risks which are potential)

import { useState } from "react"
import { usePermissions } from "@/lib/rbac/usePermissions"
import { useRouter } from "next/navigation"
import { AIScanPanel } from "@/components/shared/AIScanPanel"
import { Avatar } from "@/components/ui"

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  OPEN:        { label:"Open",        color:"#DC2626", bg:"#FEF2F2" },
  IN_PROGRESS: { label:"In Progress", color:"#F59E0B", bg:"#FFFBEB" },
  ESCALATED:   { label:"Escalated",   color:"#7C3AED", bg:"#F5F3FF" },
  RESOLVED:    { label:"Resolved",    color:"#059669", bg:"#ECFDF5" },
  CLOSED:      { label:"Closed",      color:"#94A3B8", bg:"#F8FAFC" },
}
const PRI_CFG: Record<string,{color:string}> = {
  CRITICAL:{ color:"#DC2626" }, HIGH:{ color:"#F59E0B" },
  MEDIUM:{ color:"#1B6CA8" },  LOW:{ color:"#94A3B8" },
}
const CATS = ["Scope","Schedule","Budget","Technical","Resource","Stakeholder","Quality","External","Other"]

function fmtDate(d: any) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})
}

export function IssuesTab({ projectId, workspaceId, issues, members }: {
  projectId:string; workspaceId:string; issues:any[]; members:any[]
}) {
  const { can } = usePermissions()
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("OPEN")
  const [form, setForm] = useState({
    title:"", description:"", category:"Technical", priority:"MEDIUM",
    impact:"", ownerId:"", dueDate:"",
  })

  const displayed = issues.filter(i => !statusFilter || i.status === statusFilter)

  async function create() {
    if (!form.title.trim()) { setError("Title required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/issues`, {
        method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ ...form, ownerId:form.ownerId||null, dueDate:form.dueDate?new Date(form.dueDate+"T00:00:00Z").toISOString():null }),
      })
      if (!res.ok) { const d=await res.json().catch(()=>({})); setError(d.error||"Failed"); return }
      setCreating(false)
      setForm({ title:"", description:"", category:"Technical", priority:"MEDIUM", impact:"", ownerId:"", dueDate:"" })
      router.refresh()
    } catch { setError("Network error") } finally { setSaving(false) }
  }

  async function updateStatus(issueId: string, status: string, extra?: any) {
    const res = await fetch(`/api/projects/${projectId}/issues/${issueId}`, {
      method:"PATCH", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
      body: JSON.stringify({ status, ...extra }),
    })
    if (!res.ok) {
      const d = await res.json().catch(()=>({}))
      alert(d?.error || `Update failed (${res.status})`)
      return
    }
    router.refresh()
    setSelected(null)
  }

  // ── Full edit mode for the detail panel ──
  const [editIssue, setEditIssue]   = useState<any|null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  function openEdit() {
    if (!selected) return
    setEditIssue({
      title: selected.title || "",
      category: selected.category || "",
      priority: selected.priority || "MEDIUM",
      ownerId: selected.ownerId || selected.owner?.id || "",
      dueDate: selected.dueDate ? String(selected.dueDate).slice(0,10) : "",
      description: selected.description || "",
      impact: selected.impact || "",
    })
  }

  async function saveEdit() {
    if (!editIssue?.title?.trim() || savingEdit) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/issues/${selected.id}`, {
        method:"PATCH", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({
          title: editIssue.title.trim(),
          category: editIssue.category || null,
          priority: editIssue.priority,
          ownerId: editIssue.ownerId || null,
          dueDate: editIssue.dueDate ? new Date(editIssue.dueDate + "T00:00:00.000Z").toISOString() : null,
          description: editIssue.description || null,
          impact: editIssue.impact || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        alert(d?.error || `Update failed (${res.status})`)
        return
      }
      setEditIssue(null); setSelected(null)
      router.refresh()
    } finally { setSavingEdit(false) }
  }

  const inp: React.CSSProperties = {
    width:"100%", padding:"8px 11px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)", color:"var(--text)", outline:"none",
  }
  const lbl: React.CSSProperties = {
    display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
    marginBottom:4, textTransform:"uppercase", letterSpacing:".05em",
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"10px 16px", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        <div style={{ fontSize:11, color:"var(--text-3)" }}>
          {issues.filter(i=>i.status==="OPEN").length} open · {issues.filter(i=>i.status==="ESCALATED").length} escalated
        </div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          style={{ ...inp, width:"auto", padding:"5px 10px", fontSize:12 }}>
          <option value="">All</option>
          {Object.entries(STATUS_CFG).map(([v,c])=><option key={v} value={v}>{c.label}</option>)}
        </select>
        <div style={{ marginLeft:"auto" }}>
          {can("projects:edit") && (
          <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>setCreating(c=>!c)}
            style={{ padding:"7px 16px", background:"var(--steel)", color:"#fff", border:"none",
              borderRadius:"var(--radius)", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}>
            {creating ? "Cancel" : "+ Log issue"}
          </button>
          <AIScanPanel projectId={projectId} workspaceId={workspaceId} domain="issues"
            commitLabel="to issue log"
            renderCandidate={(c: any) => (
              <div>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{c.title}</span>
                  <span style={{ fontSize:10, color:"var(--text-3)" }}>{c.priority}{c.category ? ` · ${c.category}` : ""}</span>
                </div>
                {c.description && <div style={{ fontSize:12, color:"var(--text-2)", lineHeight:1.5 }}>{c.description}</div>}
              </div>
            )}
            commit={async (chosen: any[]) => {
              const rs = await Promise.all(chosen.map(c => fetch(`/api/projects/${projectId}/issues`, {
                method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
                body: JSON.stringify({
                  title: String(c.title||"").slice(0,300),
                  description: String(c.description||"").slice(0,3000) || null,
                  category: c.category ? String(c.category).slice(0,100) : null,
                  priority: ["CRITICAL","HIGH","MEDIUM","LOW"].includes(c.priority) ? c.priority : "MEDIUM",
                }),
              })))
              return rs.filter(r => !r.ok).length
            }} />
          </div>
          )}
        </div>
      </div>

      {creating && (
        <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:16 }}>
          <div style={{ maxWidth:720, display:"flex", flexDirection:"column", gap:12 }}>
            {error && <div style={{ color:"var(--red)", fontSize:12 }}>✗ {error}</div>}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lbl}>Issue title *</label>
                <input style={inp} value={form.title} placeholder="Describe the current issue..."
                  onChange={e=>setForm(f=>({...f,title:e.target.value}))} />
              </div>
              <div><label style={lbl}>Category</label>
                <select style={{...inp,cursor:"pointer"}} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                  {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Priority</label>
                <select style={{...inp,cursor:"pointer",color:PRI_CFG[form.priority]?.color,fontWeight:600}} value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
                  {Object.keys(PRI_CFG).map(p=><option key={p} value={p}>{p.charAt(0)+p.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Owner</label>
                <select style={{...inp,cursor:"pointer"}} value={form.ownerId} onChange={e=>setForm(f=>({...f,ownerId:e.target.value}))}>
                  <option value="">Unassigned</option>
                  {members.map(m=><option key={m.userId||m.id} value={m.userId||m.id}>{m.user?.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}><label style={lbl}>Description</label>
                <textarea rows={2} style={{...inp,resize:"vertical",lineHeight:1.6}} value={form.description}
                  onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}><label style={lbl}>Impact</label>
                <input style={inp} value={form.impact} placeholder="What is affected by this issue?"
                  onChange={e=>setForm(f=>({...f,impact:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={create} disabled={saving||!form.title.trim()}
                style={{ padding:"8px 18px", background:"var(--steel)", color:"#fff", border:"none",
                  borderRadius:"var(--radius)", fontSize:12, cursor:saving?"wait":"pointer",
                  fontFamily:"var(--font)", opacity:!form.title.trim()?0.5:1 }}>
                {saving?"Saving…":"Log issue"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto" }}>
        {displayed.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🚩</div>
            <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>
              {statusFilter ? `No ${STATUS_CFG[statusFilter]?.label.toLowerCase()} issues` : "No issues logged"}
            </div>
            <div style={{ fontSize:13, color:"var(--text-3)", maxWidth:380, margin:"0 auto 20px" }}>
              Issues are current problems that need resolution — distinct from risks which are potential future threats.
            </div>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)" }}>
                {["Code","Issue","Category","Priority","Owner","Due","Status",""].map((h,i)=>(
                  <th key={i} style={{ padding:"9px 12px", textAlign:"left", fontSize:10, fontWeight:700,
                    color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(issue => {
                const sc = STATUS_CFG[issue.status]||STATUS_CFG.OPEN
                const pc = PRI_CFG[issue.priority]||PRI_CFG.MEDIUM
                return (
                  <tr key={issue.id} onClick={()=>setSelected(issue)}
                    style={{ borderBottom:"1px solid var(--surface-1,#F1F5F9)", cursor:"pointer" }}
                    onMouseOver={e=>(e.currentTarget.style.background="var(--surface)")}
                    onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
                    <td style={{ padding:"9px 12px", fontSize:11, fontWeight:700, color:"var(--text-3)" }}>{issue.code}</td>
                    <td style={{ padding:"9px 12px", fontSize:12, fontWeight:500, color:"var(--text)",
                      maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{issue.title}</td>
                    <td style={{ padding:"9px 12px", fontSize:11, color:"var(--text-3)" }}>{issue.category}</td>
                    <td style={{ padding:"9px 12px", fontSize:11, fontWeight:700, color:pc.color }}>{issue.priority}</td>
                    <td style={{ padding:"9px 12px" }}>
                      {issue.owner ? <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <Avatar name={issue.owner.name} size={18} />
                        <span style={{ fontSize:11 }}>{issue.owner.name}</span>
                      </div> : <span style={{ fontSize:11, color:"var(--text-4)" }}>—</span>}
                    </td>
                    <td style={{ padding:"9px 12px", fontSize:11,
                      color:issue.dueDate&&new Date(issue.dueDate)<new Date()&&issue.status!=="RESOLVED"?"var(--red)":"var(--text-3)" }}>
                      {fmtDate(issue.dueDate)}
                    </td>
                    <td style={{ padding:"9px 12px" }}>
                      <span style={{ padding:"3px 9px", borderRadius:12, fontSize:10, fontWeight:700,
                        color:sc.color, background:sc.bg }}>{sc.label}</span>
                    </td>
                    <td style={{ padding:"9px 12px", fontSize:11, color:"var(--steel)" }}>View →</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", zIndex:100,
          display:"flex", alignItems:"flex-end", justifyContent:"flex-end" }}
          onClick={()=>setSelected(null)}>
          <div style={{ width:460, height:"100%", background:"#fff", overflow:"auto",
            padding:24, boxShadow:"-8px 0 32px rgba(0,0,0,.15)" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--text-3)", marginBottom:4 }}>{selected.code}</div>
                <h2 style={{ fontSize:17, fontWeight:700, color:"var(--text)", margin:0 }}>{selected.title}</h2>
              </div>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                {can("projects:edit") && !editIssue && (
                  <button onClick={openEdit}
                    style={{ padding:"5px 12px", background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", fontSize:11, fontWeight:600, cursor:"pointer",
                      fontFamily:"var(--font)", color:"var(--text-2)" }}>
                    ✏️ Edit
                  </button>
                )}
                <button onClick={()=>{ setEditIssue(null); setSelected(null) }} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"var(--text-3)" }}>✕</button>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
              {Object.entries(STATUS_CFG).map(([v,c]) => (
                <button key={v} onClick={()=>updateStatus(selected.id,v)}
                  style={{ padding:"5px 10px", fontSize:11, fontWeight:600, cursor:"pointer",
                    fontFamily:"var(--font)", border:"1px solid var(--border)", borderRadius:"var(--radius)",
                    background:selected.status===v?c.color:"#fff",
                    color:selected.status===v?"#fff":c.color }}>
                  {c.label}
                </button>
              ))}
            </div>

            {editIssue && (
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
                borderRadius:8, padding:14, display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                    letterSpacing:".05em", marginBottom:4 }}>Title</div>
                  <input style={inp} value={editIssue.title}
                    onChange={e=>setEditIssue((f:any)=>({...f, title:e.target.value}))} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                      letterSpacing:".05em", marginBottom:4 }}>Priority</div>
                    <select style={{...inp, cursor:"pointer"}} value={editIssue.priority}
                      onChange={e=>setEditIssue((f:any)=>({...f, priority:e.target.value}))}>
                      {["CRITICAL","HIGH","MEDIUM","LOW"].map(v=><option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                      letterSpacing:".05em", marginBottom:4 }}>Owner</div>
                    <select style={{...inp, cursor:"pointer"}} value={editIssue.ownerId}
                      onChange={e=>setEditIssue((f:any)=>({...f, ownerId:e.target.value}))}>
                      <option value="">Unassigned</option>
                      {members.map((m:any) => <option key={m.userId||m.id} value={m.userId||m.id}>{m.user?.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                      letterSpacing:".05em", marginBottom:4 }}>Category</div>
                    <input style={inp} value={editIssue.category}
                      onChange={e=>setEditIssue((f:any)=>({...f, category:e.target.value}))} />
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                      letterSpacing:".05em", marginBottom:4 }}>Due date</div>
                    <input type="date" style={inp} value={editIssue.dueDate}
                      onChange={e=>setEditIssue((f:any)=>({...f, dueDate:e.target.value}))} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                    letterSpacing:".05em", marginBottom:4 }}>Description</div>
                  <textarea style={{...inp, resize:"vertical"}} rows={2} value={editIssue.description}
                    onChange={e=>setEditIssue((f:any)=>({...f, description:e.target.value}))} />
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={saveEdit} disabled={savingEdit || !editIssue.title.trim()}
                    style={{ padding:"8px 18px", background:"var(--steel)", color:"#fff", border:"none",
                      borderRadius:"var(--radius)", fontSize:12, fontWeight:600, fontFamily:"var(--font)",
                      cursor: savingEdit ? "wait" : "pointer" }}>
                    {savingEdit ? "Saving…" : "💾 Save changes"}
                  </button>
                  <button onClick={() => setEditIssue(null)}
                    style={{ padding:"8px 14px", background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                      fontFamily:"var(--font)", color:"var(--text-2)" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {selected.description && <p style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.7, marginBottom:12 }}>{selected.description}</p>}
            {selected.impact && (
              <div style={{ background:"#FEF2F2", borderRadius:"var(--radius)", padding:12, marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--red)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 }}>Impact</div>
                <p style={{ fontSize:12, color:"#991B1B", margin:0, lineHeight:1.6 }}>{selected.impact}</p>
              </div>
            )}
            {selected.resolution && (
              <div style={{ background:"#ECFDF5", borderRadius:"var(--radius)", padding:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--green)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 }}>Resolution</div>
                <p style={{ fontSize:12, color:"#065F46", margin:0, lineHeight:1.6 }}>{selected.resolution}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
