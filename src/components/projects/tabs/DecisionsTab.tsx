"use client"
// src/components/projects/tabs/DecisionsTab.tsx
// PM Best Practices — Decision Log (formal record of key project decisions)

import { DateField } from "@/components/shared/DatePicker"
import { useTranslations } from "next-intl"
import { dateLocale } from "@/lib/date-locale"
import { useState } from "react"
import { usePermissions } from "@/lib/rbac/usePermissions"
import { useRouter } from "next/navigation"
import { AIScanPanel } from "@/components/shared/AIScanPanel"
import { Avatar } from "@/components/ui"

function fmtDate(d: any) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString(dateLocale(), {month:"short",day:"numeric",year:"numeric", timeZone:"UTC" })
}

export function DecisionsTab({ projectId, workspaceId, decisions }: {
  projectId:string; workspaceId:string; decisions:any[]
}) {
  const tip = useTranslations("tips")
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

  const [editId, setEditId] = useState<string|null>(null)
  const [editF, setEditF]   = useState<any>({})

  async function saveDecision(id: string) {
    const res = await fetch(`/api/projects/${projectId}/decisions/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editF.title, description: editF.description || null,
        rationale: editF.rationale || null, alternatives: editF.alternatives || null,
        impact: editF.impact || null,
        madeAt: editF.madeAt ? new Date(`${editF.madeAt}T12:00:00Z`).toISOString() : undefined,
      }),
    }).catch(() => null)
    if (res?.ok) { setEditId(null); router.refresh() }
    else {
      const d2 = await res?.json().catch(() => null)
      alert(d2?.error || tip("decSaveFailed"))
    }
  }

  // Deleting is a normal part of keeping a register honest — a mistyped entry
  // that can't be removed teaches people to stop trusting the register.
  async function removeItem(id: string, label: string) {
    if (!confirm(tip("decConfirmDelete",{l:label}))) return
    const res = await fetch(`/api/projects/${projectId}/decisions/${id}`, { method: "DELETE" }).catch(() => null)
    if (res?.ok) { router.refresh() }
    else {
      const d = await res?.json().catch(() => null)
      alert(d?.error || tip("decDeleteFailed"))
    }
  }

  async function create() {
    if (!form.title.trim()) { setError(tip("titleRequired")); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/decisions`, {
        method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ ...form, madeAt: new Date(form.madeAt+"T00:00:00Z").toISOString() }),
      })
      if (!res.ok) { const d=await res.json().catch(()=>({})); setError(d.error||tip("genFailed")); return }
      setCreating(false)
      setForm({ title:"", description:"", rationale:"", alternatives:"", impact:"",
        madeAt: new Date().toISOString().split("T")[0] })
      router.refresh()
    } catch { setError(tip("netError")) } finally { setSaving(false) }
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
                <label style={lbl}>{tip("dDecisionTitle")}</label>
                <input style={inp} value={form.title} placeholder={tip("decPhTitle")}
                  onChange={e=>setForm(f=>({...f,title:e.target.value}))} />
              </div>
              <div>
                <label style={lbl}>{tip("dDateMade")}</label>
                <DateField  style={inp} value={form.madeAt}
                  onChange={e=>setForm(f=>({...f,madeAt:e.target.value}))} />
              </div>
            </div>
            <div><label style={lbl}>{tip("description")}</label>
              <textarea rows={2} style={{...inp,resize:"vertical",lineHeight:1.6}} value={form.description}
                placeholder={tip("decPhDetail")}
                onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div><label style={lbl}>{tip("dRationale")}</label>
                <textarea rows={3} style={{...inp,resize:"vertical",lineHeight:1.6}} value={form.rationale}
                  placeholder={tip("decPhWhy")}
                  onChange={e=>setForm(f=>({...f,rationale:e.target.value}))} />
              </div>
              <div><label style={lbl}>{tip("dAlternatives")}</label>
                <textarea rows={3} style={{...inp,resize:"vertical",lineHeight:1.6}} value={form.alternatives}
                  placeholder={tip("decPhAlt")}
                  onChange={e=>setForm(f=>({...f,alternatives:e.target.value}))} />
              </div>
            </div>
            <div><label style={lbl}>{tip("impact")}</label>
              <input style={inp} value={form.impact} placeholder={tip("decPhImpact")}
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
            <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>{tip("dEmpty")}</div>
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
<button onClick={e => {
                      e.stopPropagation()
                      setEditId(editId === d.id ? null : d.id)
                      setEditF({ title:d.title||"", description:d.description||"",
                        rationale:d.rationale||"", alternatives:d.alternatives||"",
                        impact:d.impact||"",
                        madeAt: d.madeAt ? new Date(d.madeAt).toISOString().slice(0,10) : "" })
                    }}
                    title={tip("edit")}
                    style={{ background:"none", border:"1px solid var(--border)", color:"var(--text-2)",
                      borderRadius:6, fontSize:11, cursor:"pointer", padding:"3px 9px",
                      flexShrink:0, fontFamily:"var(--font)", marginRight:6 }}>{tip("edit")}</button>
<button onClick={e => { e.stopPropagation(); removeItem(d.id, `${d.code} — ${d.title}`) }}
                    title={tip("delete")}
                    style={{ background:"none", border:"1px solid #FECACA", color:"var(--red)",
                      borderRadius:6, fontSize:11, cursor:"pointer", padding:"3px 8px",
                      flexShrink:0, fontFamily:"var(--font)" }}>✕</button>
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
                          letterSpacing:".05em", marginBottom:5 }}>{tip("dRationale")}</div>
                        <p style={{ fontSize:13, color:"var(--text-2)", margin:0, lineHeight:1.7, whiteSpace:"pre-line" }}>{d.rationale}</p>
                      </div>
                    )}
                    {d.alternatives && (
                      <div style={{ background:"var(--surface)", borderRadius:"var(--radius)", padding:12 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                          letterSpacing:".05em", marginBottom:5 }}>{tip("dAlternatives")}</div>
                        <p style={{ fontSize:13, color:"var(--text-2)", margin:0, lineHeight:1.7, whiteSpace:"pre-line" }}>{d.alternatives}</p>
                      </div>
                    )}
                    {d.impact && (
                      <div style={{ background:"#FFFBEB", borderRadius:"var(--radius)", padding:12 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:"#92400E", textTransform:"uppercase",
                          letterSpacing:".05em", marginBottom:5 }}>{tip("impact")}</div>
                        <p style={{ fontSize:12, color:"#78350F", margin:0, lineHeight:1.7 }}>{d.impact}</p>
                      </div>
                    )}
                  </div>
                )}
                {editId === d.id && (
                  <div onClick={e => e.stopPropagation()}
                    style={{ marginTop:10, paddingTop:10, borderTop:"1px solid var(--border)",
                      display:"flex", flexDirection:"column", gap:8 }}>
                    {([["title",tip("title")],["description",tip("description")],["rationale",tip("decRationale")],
                       ["alternatives",tip("decAlternatives")],["impact",tip("decImpact")]] as const).map(([k,label]) => (
                      <label key={k} style={{ fontSize:11, color:"var(--text-3)" }}>
                        {label}
                        <input value={editF[k] || ""}
                          onChange={e => setEditF((f:any) => ({ ...f, [k]: e.target.value }))}
                          style={{ width:"100%", marginTop:3, padding:"6px 9px", fontSize:12.5,
                            borderRadius:6, border:"1px solid var(--border)", fontFamily:"var(--font)" }} />
                      </label>
                    ))}
                    <label style={{ fontSize:11, color:"var(--text-3)" }}>{tip("dDecidedOn")}<input type="date" value={editF.madeAt || ""}
                        onChange={e => setEditF((f:any) => ({ ...f, madeAt: e.target.value }))}
                        style={{ width:"100%", marginTop:3, padding:"6px 9px", fontSize:12.5,
                          borderRadius:6, border:"1px solid var(--border)", fontFamily:"var(--font)" }} />
                    </label>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => saveDecision(d.id)}
                        style={{ flex:1, padding:"6px 0", background:"var(--steel)", color:"#fff",
                          border:"none", borderRadius:6, fontSize:12, fontWeight:700,
                          cursor:"pointer", fontFamily:"var(--font)" }}>{tip("save")}</button>
                      <button onClick={() => setEditId(null)}
                        style={{ padding:"6px 12px", background:"none", border:"1px solid var(--border)",
                          borderRadius:6, fontSize:12, cursor:"pointer", color:"var(--text-3)",
                          fontFamily:"var(--font)" }}>{tip("cancel")}</button>
                    </div>
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
