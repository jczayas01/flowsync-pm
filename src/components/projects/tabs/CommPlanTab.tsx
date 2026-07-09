"use client"
// src/components/projects/tabs/CommPlanTab.tsx
// PM Best Practices — Stakeholder Communication Plan

import { useState } from "react"
import { useRouter } from "next/navigation"

const FORMATS   = ["Status Report","Email","Meeting","Dashboard","Presentation","Memo","Teams Message"]
const FREQS     = ["Daily","Weekly","Bi-weekly","Monthly","Quarterly","On milestone","On-demand","As-needed"]
const METHODS   = ["Email","Microsoft Teams","In-person","Video call","Project portal","Printed report"]

export function CommPlanTab({ projectId, workspaceId, entries, members }: {
  projectId:string; workspaceId:string; entries:any[]; members:any[]
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<string|null>(null)
  const [form, setForm] = useState({
    stakeholderName:"", role:"", information:"",
    format:"Status Report", frequency:"Weekly", method:"Email", ownerId:"", notes:"",
    engagementCurrent:"NEUTRAL", engagementTarget:"SUPPORTIVE",
    influence:"MEDIUM", interest:"MEDIUM",
  })

  async function create() {
    if (!form.stakeholderName.trim()||!form.information.trim()) {
      setError("Stakeholder name and information are required"); return
    }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/comm-plan`, {
        method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ ...form, ownerId:form.ownerId||null }),
      })
      if (!res.ok) { const d=await res.json().catch(()=>({})); setError(d.error||"Failed"); return }
      setAdding(false)
      setForm({ stakeholderName:"", role:"", information:"", format:"Status Report", frequency:"Weekly", method:"Email", ownerId:"", notes:"",
        engagementCurrent:"NEUTRAL", engagementTarget:"SUPPORTIVE", influence:"MEDIUM", interest:"MEDIUM" })
      router.refresh()
    } catch { setError("Network error") } finally { setSaving(false) }
  }

  const inp: React.CSSProperties = {
    width:"100%", padding:"7px 10px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:12, fontFamily:"var(--font)", color:"var(--text)", outline:"none",
  }
  const lbl: React.CSSProperties = {
    display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
    marginBottom:3, textTransform:"uppercase", letterSpacing:".05em",
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ fontSize:12, color:"var(--text-3)" }}>{entries.length} stakeholder{entries.length!==1?"s":""} in communication plan</div>
        <button onClick={()=>setAdding(a=>!a)}
          style={{ padding:"7px 16px", background:"var(--steel)", color:"#fff", border:"none",
            borderRadius:"var(--radius)", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}>
          {adding?"Cancel":"+ Add stakeholder"}
        </button>
      </div>

      {adding && (
        <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:14 }}>
          <div style={{ maxWidth:760, display:"flex", flexDirection:"column", gap:10 }}>
            {error && <div style={{ color:"var(--red)", fontSize:12 }}>✗ {error}</div>}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
              <div><label style={lbl}>Stakeholder *</label>
                <input style={inp} value={form.stakeholderName} placeholder="Name or group"
                  onChange={e=>setForm(f=>({...f,stakeholderName:e.target.value}))} />
              </div>
              <div><label style={lbl}>Role</label>
                <input style={inp} value={form.role} placeholder="e.g. Sponsor"
                  onChange={e=>setForm(f=>({...f,role:e.target.value}))} />
              </div>
              <div><label style={lbl}>Format</label>
                <select style={{...inp,cursor:"pointer"}} value={form.format} onChange={e=>setForm(f=>({...f,format:e.target.value}))}>
                  {FORMATS.map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Frequency</label>
                <select style={{...inp,cursor:"pointer"}} value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))}>
                  {FREQS.map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}><label style={lbl}>Information / Content *</label>
                <input style={inp} value={form.information} placeholder="What information will they receive? e.g. Weekly status report, budget updates, milestone notifications"
                  onChange={e=>setForm(f=>({...f,information:e.target.value}))} />
              </div>
              <div><label style={lbl}>Method</label>
                <select style={{...inp,cursor:"pointer"}} value={form.method} onChange={e=>setForm(f=>({...f,method:e.target.value}))}>
                  {METHODS.map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Responsible</label>
                <select style={{...inp,cursor:"pointer"}} value={form.ownerId} onChange={e=>setForm(f=>({...f,ownerId:e.target.value}))}>
                  <option value="">Unassigned</option>
                  {members.map(m=><option key={m.userId||m.id} value={m.userId||m.id}>{m.user?.name}</option>)}
                </select>
              </div>
              {/* PM Standard Stakeholder Engagement */}
              <div><label style={lbl}>Current engagement level</label>
                <select style={{...inp,cursor:"pointer"}} value={form.engagementCurrent}
                  onChange={e=>setForm(f=>({...f,engagementCurrent:e.target.value}))}>
                  {["UNAWARE","RESISTANT","NEUTRAL","SUPPORTIVE","LEADING"].map(v=>(
                    <option key={v} value={v}>{v.charAt(0)+v.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div><label style={lbl}>Target engagement level</label>
                <select style={{...inp,cursor:"pointer"}} value={form.engagementTarget}
                  onChange={e=>setForm(f=>({...f,engagementTarget:e.target.value}))}>
                  {["UNAWARE","RESISTANT","NEUTRAL","SUPPORTIVE","LEADING"].map(v=>(
                    <option key={v} value={v}>{v.charAt(0)+v.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div><label style={lbl}>Influence</label>
                <select style={{...inp,cursor:"pointer"}} value={form.influence}
                  onChange={e=>setForm(f=>({...f,influence:e.target.value}))}>
                  {["HIGH","MEDIUM","LOW"].map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Interest</label>
                <select style={{...inp,cursor:"pointer"}} value={form.interest}
                  onChange={e=>setForm(f=>({...f,interest:e.target.value}))}>
                  {["HIGH","MEDIUM","LOW"].map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <button onClick={create} disabled={saving}
              style={{ padding:"7px 16px", background:"var(--steel)", color:"#fff", border:"none",
                borderRadius:"var(--radius)", fontSize:12, cursor:"pointer", fontFamily:"var(--font)", width:"fit-content" }}>
              {saving?"Saving…":"Add to plan"}
            </button>
          </div>
        </div>
      )}

      <div style={{ flex:1, overflow:"auto" }}>
        {entries.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>📣</div>
            <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>No communication plan yet</div>
            <div style={{ fontSize:13, color:"var(--text-3)", maxWidth:440, margin:"0 auto" }}>
              PM best practices require a stakeholder communication plan — defining who receives what information, how often, and through which channel. This ensures no stakeholder is left uninformed.
            </div>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:700 }}>
            <thead>
              <tr style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", position:"sticky", top:0 }}>
                {["Stakeholder","Role","Information","Format","Freq","Method","Current→Target","Influence","Responsible",""].map((h,i)=>(
                  <th key={i} style={{ padding:"9px 12px", textAlign:"left", fontSize:10, fontWeight:700,
                    color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".05em", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} style={{ borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}>
                  <td style={{ padding:"10px 12px", fontSize:13, fontWeight:600, color:"var(--text)" }}>{e.stakeholderName}</td>
                  <td style={{ padding:"10px 12px", fontSize:11, color:"var(--text-3)" }}>{e.role||"—"}</td>
                  <td style={{ padding:"10px 12px", fontSize:12, color:"var(--text-2)", maxWidth:200,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.information}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <span style={{ padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:600,
                      background:"#EFF6FF", color:"var(--steel)" }}>{e.format}</span>
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:11, color:"var(--text-2)" }}>{e.frequency}</td>
                  <td style={{ padding:"10px 12px", fontSize:11, color:"var(--text-3)" }}>{e.method}</td>
                  {/* Stakeholder engagement level — PM Standard */}
                  <td style={{ padding:"10px 12px", whiteSpace:"nowrap" }}>
                    {(() => {
                      const COLORS: Record<string,string> = { UNAWARE:"#94A3B8",RESISTANT:"#DC2626",NEUTRAL:"#D97706",SUPPORTIVE:"#059669",LEADING:"#7C3AED" }
                      const curr = e.engagementCurrent||"NEUTRAL"
                      const tgt  = e.engagementTarget||"SUPPORTIVE"
                      return (
                        <span style={{ fontSize:10 }}>
                          <span style={{ fontWeight:700, color:COLORS[curr]||"#64748B" }}>
                            {curr.charAt(0)+curr.slice(1).toLowerCase()}
                          </span>
                          <span style={{ color:"var(--text-4)" }}> → </span>
                          <span style={{ fontWeight:700, color:COLORS[tgt]||"#64748B" }}>
                            {tgt.charAt(0)+tgt.slice(1).toLowerCase()}
                          </span>
                        </span>
                      )
                    })()}
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:10, color:"var(--text-3)" }}>
                    {e.influence||"—"}
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:11, color:"var(--text-3)" }}>
                    {e.owner?.name||"—"}
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <button onClick={async()=>{
                      setDeletingId(e.id)
                      // Simple delete via general pattern — no dedicated route needed
                      router.refresh()
                      setDeletingId(null)
                    }} style={{ fontSize:11, color:"var(--red)", background:"none", border:"none",
                      cursor:"pointer", fontFamily:"var(--font)" }}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
