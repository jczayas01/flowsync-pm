"use client"
// src/components/projects/tabs/DecisionsTab.tsx
// PM Best Practices — Decision Log (formal record of key project decisions)

import { DateField } from "@/components/shared/DatePicker"
import { useState } from "react"
import { usePermissions } from "@/lib/rbac/usePermissions"
import { useRouter } from "next/navigation"
import { AIScanPanel } from "@/components/shared/AIScanPanel"
import { Avatar } from "@/components/ui"

function fmtDate(d: any) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric", timeZone:"UTC" })
}

export function DecisionsTab({ projectId, workspaceId, decisions }: {
  projectId:string; workspaceId:string; decisions:any[]
}) {
  const { can } = usePermissions()
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    title:"", description:"", rationale:"", alternatives:"", impact:"",
    madeAt: new Date().toISOString().split("T")[0],
  })

  async function create() {
    if (!form.title.trim()) { setError("Title required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/decisions`, {
        method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ ...form, madeAt: new Date(form.madeAt+"T00:00:00Z").toISOString() }),
      })
      if (!res.ok) { const d=await res.json().catch(()=>({})); setError(d.error||"Failed"); return }
      setCreating(false)
      setForm({ title:"", description:"", rationale:"", alternatives:"", impact:"",
        madeAt: new Date().toISOString().split("T")[0] })
      router.refresh()
    } catch { setError("Network error") } finally { setSaving(false) }
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
        padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ fontSize:12, color:"var(--text-3)" }}>{decisions.length} decision{decisions.length!==1?"s":""} recorded</div>
        {can("projects:edit") && (
        <div style={{ display:"flex", gap:8 }}>
        <button onClick={()=>setCreating(c=>!c)}
          style={{ padding:"7px 16px", background:"var(--steel)", color:"#fff", border:"none",
            borderRadius:"var(--radius)", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}>
          {creating ? "Cancel" : "+ Record decision"}
        </button>
        <AIScanPanel projectId={projectId} workspaceId={workspaceId} domain="decisions"
          commitLabel="to decision log"
          renderCandidate={(c: any) => (
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{c.title}</div>
              {c.description && <div style={{ fontSize:12, color:"var(--text-2)", lineHeight:1.5 }}>{c.description}</div>}
              {c.rationale && <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>Why: {c.rationale}</div>}
            </div>
          )}
          commit={async (chosen: any[]) => {
            const rs = await Promise.all(chosen.map(c => fetch(`/api/projects/${projectId}/decisions`, {
              method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
              body: JSON.stringify({
                title: String(c.title||"").slice(0,300),
                description: String(c.description||"").slice(0,3000) || null,
                rationale: String(c.rationale||"").slice(0,3000) || null,
              }),
            })))
            return rs.filter(r => !r.ok).length
          }} />
          </div>
        )}
      </div>

      {creating && (
        <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:16 }}>
          <div style={{ maxWidth:720, display:"flex", flexDirection:"column", gap:12 }}>
            {error && <div style={{ color:"var(--red)", fontSize:12 }}>✗ {error}</div>}
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12 }}>
              <div>
                <label style={lbl}>Decision title *</label>
                <input style={inp} value={form.title} placeholder="What was decided?"
                  onChange={e=>setForm(f=>({...f,title:e.target.value}))} />
              </div>
              <div>
                <label style={lbl}>Date made</label>
                <DateField  style={inp} value={form.madeAt}
                  onChange={e=>setForm(f=>({...f,madeAt:e.target.value}))} />
              </div>
            </div>
            <div><label style={lbl}>Description</label>
              <textarea rows={2} style={{...inp,resize:"vertical",lineHeight:1.6}} value={form.description}
                placeholder="Describe the decision in detail..."
                onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div><label style={lbl}>Rationale</label>
                <textarea rows={3} style={{...inp,resize:"vertical",lineHeight:1.6}} value={form.rationale}
                  placeholder="Why was this decision made?"
                  onChange={e=>setForm(f=>({...f,rationale:e.target.value}))} />
              </div>
              <div><label style={lbl}>Alternatives considered</label>
                <textarea rows={3} style={{...inp,resize:"vertical",lineHeight:1.6}} value={form.alternatives}
                  placeholder="What other options were evaluated?"
                  onChange={e=>setForm(f=>({...f,alternatives:e.target.value}))} />
              </div>
            </div>
            <div><label style={lbl}>Impact</label>
              <input style={inp} value={form.impact} placeholder="How does this decision affect the project?"
                onChange={e=>setForm(f=>({...f,impact:e.target.value}))} />
            </div>
            <button onClick={create} disabled={saving||!form.title.trim()}
              style={{ padding:"8px 18px", background:"var(--steel)", color:"#fff", border:"none",
                borderRadius:"var(--radius)", fontSize:12, cursor:saving?"wait":"pointer",
                fontFamily:"var(--font)", width:"fit-content", opacity:!form.title.trim()?0.5:1 }}>
              {saving?"Saving…":"Save decision"}
            </button>
          </div>
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", padding:16 }}>
        {decisions.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>⚡</div>
            <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>No decisions recorded</div>
            <div style={{ fontSize:13, color:"var(--text-3)", maxWidth:380, margin:"0 auto 20px" }}>
              PM Standard recommends formally recording key decisions — what was decided, why, and what alternatives were considered. This creates an audit trail and institutional knowledge.
            </div>
          </div>
        ) : (
          <div style={{ maxWidth:760, margin:"0 auto", display:"flex", flexDirection:"column", gap:8 }}>
            {decisions.map(d => (
              <div key={d.id} onClick={()=>setSelected(selected?.id===d.id?null:d)}
                style={{ background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", padding:"14px 18px", cursor:"pointer",
                  borderLeft:`3px solid var(--steel)` }}
                onMouseOver={e=>(e.currentTarget.style.boxShadow="var(--shadow-md)")}
                onMouseOut={e=>(e.currentTarget.style.boxShadow="none")}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:"var(--text-3)" }}>{d.code}</span>
                      <span style={{ fontSize:11, color:"var(--text-4)" }}>{fmtDate(d.madeAt)}</span>
                    </div>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:4 }}>{d.title}</div>
                    {d.description && (
                      <div style={{ fontSize:12, color:"var(--text-3)", overflow:"hidden",
                        textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.description}</div>
                    )}
                  </div>
                  {d.madeBy && (
                    <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
                      <Avatar name={d.madeBy.name} size={20} />
                      <span style={{ fontSize:11, color:"var(--text-3)" }}>{d.madeBy.name}</span>
                    </div>
                  )}
                </div>
                {selected?.id === d.id && (
                  <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:10,
                    borderTop:"1px solid var(--border)", paddingTop:14 }}>
                    {d.rationale && (
                      <div style={{ background:"var(--surface)", borderRadius:"var(--radius)", padding:12 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:"var(--steel)", textTransform:"uppercase",
                          letterSpacing:".05em", marginBottom:5 }}>Rationale</div>
                        <p style={{ fontSize:13, color:"var(--text-2)", margin:0, lineHeight:1.7, whiteSpace:"pre-line" }}>{d.rationale}</p>
                      </div>
                    )}
                    {d.alternatives && (
                      <div style={{ background:"var(--surface)", borderRadius:"var(--radius)", padding:12 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                          letterSpacing:".05em", marginBottom:5 }}>Alternatives considered</div>
                        <p style={{ fontSize:13, color:"var(--text-2)", margin:0, lineHeight:1.7, whiteSpace:"pre-line" }}>{d.alternatives}</p>
                      </div>
                    )}
                    {d.impact && (
                      <div style={{ background:"#FFFBEB", borderRadius:"var(--radius)", padding:12 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:"#92400E", textTransform:"uppercase",
                          letterSpacing:".05em", marginBottom:5 }}>Impact</div>
                        <p style={{ fontSize:12, color:"#78350F", margin:0, lineHeight:1.7 }}>{d.impact}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
