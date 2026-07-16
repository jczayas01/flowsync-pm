"use client"
// src/components/projects/tabs/BenefitsTab.tsx
// PM Best Practices — Benefits Realization (value delivery tracking)

import { DateField } from "@/components/shared/DatePicker"
import { useState } from "react"
import { usePermissions } from "@/lib/rbac/usePermissions"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/ui"
import { AIScanPanel } from "@/components/shared/AIScanPanel"

const STATUS_CFG: Record<string,{label:string;color:string;bg:string;icon:string}> = {
  PROJECTED: { label:"Projected",  color:"#1B6CA8", bg:"#EFF6FF",  icon:"📊" },
  TRACKING:  { label:"Tracking",   color:"#F59E0B", bg:"#FFFBEB",  icon:"📡" },
  REALIZED:  { label:"Realized",   color:"#059669", bg:"#ECFDF5",  icon:"✓"  },
  MISSED:    { label:"Missed",     color:"#DC2626", bg:"#FEF2F2",  icon:"✗"  },
}
const CATS = ["Financial","Operational","Strategic","Customer","Employee","Compliance","Technology","Other"]

function fmtDate(d: any) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric", timeZone:"UTC" })
}

export function BenefitsTab({ projectId, workspaceId, benefits, members }: {
  projectId:string; workspaceId:string; benefits:any[]; members:any[]
}) {
  const { can } = usePermissions()
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string|null>(null)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    title:"", description:"", category:"Financial",
    projectedValue:"", ownerId:"", measureBy:"",
  })

  const realized = benefits.filter(b=>b.status==="REALIZED").length
  const total    = benefits.length

  async function create() {
    if (!form.title.trim()) { setError("Title required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/benefits`, {
        method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ ...form, ownerId:form.ownerId||null,
          measureBy: form.measureBy ? new Date(form.measureBy+"T00:00:00Z").toISOString() : null }),
      })
      if (!res.ok) { const d=await res.json().catch(()=>({})); setError(d.error||"Failed"); return }
      setCreating(false)
      setForm({ title:"", description:"", category:"Financial", projectedValue:"", ownerId:"", measureBy:"" })
      router.refresh()
    } catch { setError("Network error") } finally { setSaving(false) }
  }

  async function updateBenefit(benefitId: string, patch: any) {
    setUpdatingId(benefitId)
    try {
      await fetch(`/api/projects/${projectId}/benefits/${benefitId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify(patch),
      })
      router.refresh()
    } finally { setUpdatingId(null) }
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
      {/* Header */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"10px 16px", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
        {total > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ height:8, width:120, background:"var(--border)", borderRadius:4, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${total>0?(realized/total)*100:0}%`,
                background:"var(--green)", borderRadius:4 }} />
            </div>
            <span style={{ fontSize:12, color:"var(--text-3)" }}>{realized}/{total} realized</span>
          </div>
        )}
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          {can("projects:edit") && (<button onClick={()=>setCreating(c=>!c)}
            style={{ padding:"7px 16px", background:"var(--steel)", color:"#fff", border:"none",
              borderRadius:"var(--radius)", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}>
            {creating?"Cancel":"+ Add benefit"}
          </button>)}
          {can("projects:edit") && (
            <AIScanPanel projectId={projectId} workspaceId={workspaceId} domain="benefits"
              commitLabel="to benefits register"
              renderCandidate={(c: any) => (
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{c.title}</div>
                  {c.description && <div style={{ fontSize:12, color:"var(--text-2)", marginTop:2 }}>{c.description}</div>}
                  <div style={{ fontSize:11, color:"var(--text-3)", marginTop:3 }}>
                    {c.category ? `${c.category}` : ""}{c.projectedValue ? ` · ${c.projectedValue}` : ""}
                    {c.sourceDoc ? ` · ${c.sourceDoc}` : ""}
                  </div>
                </div>
              )}
              commit={async (chosen: any[]) => {
                let failed = 0
                for (const c of chosen) {
                  try {
                    const res = await fetch(`/api/projects/${projectId}/benefits`, {
                      method:"POST", headers:{ "Content-Type":"application/json", "x-workspace-id":workspaceId },
                      body: JSON.stringify({
                        title: c.title, description: c.description || null,
                        category: c.category || null, projectedValue: c.projectedValue || null,
                        status: "PROJECTED",
                      }),
                    })
                    if (!res.ok) failed++
                  } catch { failed++ }
                }
                return failed
              }} />
          )}
        </div>
      </div>

      {creating && (
        <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:16 }}>
          <div style={{ maxWidth:720, display:"flex", flexDirection:"column", gap:12 }}>
            {error && <div style={{ color:"var(--red)", fontSize:12 }}>✗ {error}</div>}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lbl}>Benefit title *</label>
                <input style={inp} value={form.title} placeholder="What benefit will this project deliver?"
                  onChange={e=>setForm(f=>({...f,title:e.target.value}))} />
              </div>
              <div><label style={lbl}>Category</label>
                <select style={{...inp,cursor:"pointer"}} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                  {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Projected value</label>
                <input style={inp} value={form.projectedValue} placeholder="e.g. $50K/year savings"
                  onChange={e=>setForm(f=>({...f,projectedValue:e.target.value}))} />
              </div>
              <div><label style={lbl}>Measure by</label>
                <DateField  style={inp} value={form.measureBy}
                  onChange={e=>setForm(f=>({...f,measureBy:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}><label style={lbl}>Description</label>
                <textarea rows={2} style={{...inp,resize:"vertical",lineHeight:1.6}} value={form.description}
                  onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
              </div>
            </div>
            <button onClick={create} disabled={saving||!form.title.trim()}
              style={{ padding:"8px 18px", background:"var(--steel)", color:"#fff", border:"none",
                borderRadius:"var(--radius)", fontSize:12, cursor:saving?"wait":"pointer",
                fontFamily:"var(--font)", width:"fit-content", opacity:!form.title.trim()?0.5:1 }}>
              {saving?"Saving…":"Add benefit"}
            </button>
          </div>
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", padding:16 }}>
        {benefits.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>💹</div>
            <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>No benefits defined</div>
            <div style={{ fontSize:13, color:"var(--text-3)", maxWidth:400, margin:"0 auto 20px" }}>
              project management best practices focus on value delivery. Define the benefits this project should deliver, track whether they're realized, and measure actual vs projected value.
            </div>
          </div>
        ) : (
          <div style={{ maxWidth:800, margin:"0 auto", display:"grid",
            gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))", gap:12 }}>
            {benefits.map(b => {
              const sc = STATUS_CFG[b.status]||STATUS_CFG.PROJECTED
              return (
                <div key={b.id} style={{ background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                    <div>
                      <div style={{ fontSize:10, color:"var(--text-3)", fontWeight:600,
                        textTransform:"uppercase", marginBottom:4 }}>{b.category}</div>
                      <div style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>{b.title}</div>
                    </div>
                    <span style={{ padding:"3px 9px", borderRadius:12, fontSize:10, fontWeight:700,
                      color:sc.color, background:sc.bg, whiteSpace:"nowrap", flexShrink:0 }}>
                      {sc.icon} {sc.label}
                    </span>
                  </div>
                  {b.description && <p style={{ fontSize:12, color:"var(--text-3)", margin:0, lineHeight:1.6 }}>{b.description}</p>}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <div style={{ background:"var(--surface)", borderRadius:6, padding:"8px 10px" }}>
                      <div style={{ fontSize:9, fontWeight:700, color:"var(--text-4)", textTransform:"uppercase", marginBottom:2 }}>Projected</div>
                      <div style={{ fontSize:13, fontWeight:700, color:"var(--steel)" }}>{b.projectedValue||"—"}</div>
                    </div>
                    <div style={{ background:b.actualValue?"#ECFDF5":"var(--surface)", borderRadius:6, padding:"8px 10px" }}>
                      <div style={{ fontSize:9, fontWeight:700, color:"var(--text-4)", textTransform:"uppercase", marginBottom:2 }}>Actual</div>
                      <div style={{ fontSize:13, fontWeight:700, color:b.actualValue?"var(--green)":"var(--text-4)" }}>
                        {b.actualValue||"Not yet measured"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:11, color:"var(--text-4)" }}>
                      {b.measureBy ? `Measure by ${fmtDate(b.measureBy)}` : ""}
                      {b.measuredAt ? ` · Measured ${fmtDate(b.measuredAt)}` : ""}
                    </span>
                  </div>
                  {/* Status update buttons */}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {Object.entries(STATUS_CFG).map(([v,c]) => (
                      <button key={v} onClick={()=>updateBenefit(b.id,{status:v})}
                        disabled={updatingId===b.id}
                        style={{ padding:"4px 8px", fontSize:10, fontWeight:600, cursor:"pointer",
                          fontFamily:"var(--font)", border:"1px solid var(--border)", borderRadius:6,
                          background:b.status===v?c.color:"#fff",
                          color:b.status===v?"#fff":c.color }}>
                        {c.label}
                      </button>
                    ))}
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
