"use client"
// src/components/projects/tabs/ProjectRisksTab.tsx
import { useState } from "react"
import { Badge, EmptyState } from "@/components/ui"

const PROB_SCORES: Record<string,number> = {
  VERY_LOW:1, LOW:2, MEDIUM:3, HIGH:4, VERY_HIGH:5
}
const IMPACT_SCORES: Record<string,number> = {
  NEGLIGIBLE:1, MINOR:2, MODERATE:3, MAJOR:4, CRITICAL:5
}

function heatColor(score:number) {
  if (score >= 15) return { bg:"#FEF2F2", text:"#DC2626" }
  if (score >= 9)  return { bg:"#FFFBEB", text:"#D97706" }
  if (score >= 4)  return { bg:"#EFF6FF", text:"#1B6CA8" }
  return { bg:"#F1F5F9", text:"#64748B" }
}

export function ProjectRisksTab({ projectId, risks, changes }: {
  projectId:string; risks:any[]; changes:any[]
}) {
  const [tab, setTab]       = useState<"risks"|"changes">("risks")
  const [creating, setCreating] = useState(false)
  const [form, setForm]     = useState({
    title:"", category:"", probability:"MEDIUM", impact:"MODERATE",
    description:"", mitigation:""
  })

  async function createRisk(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    const score = (PROB_SCORES[form.probability]||3) * (IMPACT_SCORES[form.impact]||3)
    await fetch("/api/risks", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ...form, projectId, score })
    })
    setForm({ title:"", category:"", probability:"MEDIUM", impact:"MODERATE",
              description:"", mitigation:"" })
    setCreating(false)
  }

  const inputStyle: React.CSSProperties = {
    width:"100%", padding:"8px 10px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    color:"var(--text)", outline:"none"
  }
  const selStyle: React.CSSProperties = {
    ...inputStyle, appearance:"none" as const, cursor:"pointer",
    background:"url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%2394A3B8'/%3E%3C/svg%3E") right 8px center no-repeat #fff"
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Tabs */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"0 16px", display:"flex", gap:0, flexShrink:0 }}>
        {[["risks","⚠ Risks"], ["changes","↻ Change requests"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            style={{ padding:"10px 16px", border:"none", background:"none", cursor:"pointer",
              fontFamily:"var(--font)", fontSize:12, fontWeight:500,
              color: tab===id ? "var(--steel)" : "var(--text-3)",
              borderBottom: tab===id ? "2px solid var(--steel)" : "2px solid transparent",
              marginBottom:-1 }}>
            {label}
            <span style={{ marginLeft:6, fontSize:11, fontWeight:600,
              padding:"1px 6px", borderRadius:10, background:"var(--surface-1)" }}>
              {id==="risks" ? risks.length : changes.length}
            </span>
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", padding:"0 0 0 8px" }}>
          <button onClick={() => setCreating(true)}
            style={{ padding:"6px 12px", background:"var(--steel)", color:"#fff", border:"none",
              borderRadius:"var(--radius)", fontSize:11, fontWeight:500, cursor:"pointer",
              fontFamily:"var(--font)" }}>
            + {tab==="risks" ? "Log risk" : "New CR"}
          </button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:16 }}>
        {tab === "risks" && (
          <>
            {/* Risk matrix summary */}
            {risks.length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
                {[
                  { label:"Critical (15+)", count:risks.filter(r=>r.score>=15).length, color:"var(--red)" },
                  { label:"High (9–14)",    count:risks.filter(r=>r.score>=9&&r.score<15).length, color:"var(--amber)" },
                  { label:"Medium (4–8)",   count:risks.filter(r=>r.score>=4&&r.score<9).length, color:"var(--steel)" },
                  { label:"Low (1–3)",      count:risks.filter(r=>r.score<4).length, color:"var(--text-3)" },
                ].map(b => (
                  <div key={b.label} style={{ background:"#fff", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", padding:"12px 14px" }}>
                    <div style={{ fontSize:22, fontWeight:700, color:b.color }}>{b.count}</div>
                    <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>{b.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Create form */}
            {creating && (
              <form onSubmit={createRisk} style={{ background:"var(--surface)", border:"1px solid var(--border)",
                borderRadius:"var(--radius)", padding:16, marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:12 }}>
                  Log new risk
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:11, color:"var(--text-3)", display:"block", marginBottom:4 }}>Title *</label>
                  <input style={inputStyle} placeholder="Describe the risk…" value={form.title}
                    onChange={e => setForm(f => ({ ...f, title:e.target.value }))} autoFocus />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ fontSize:11, color:"var(--text-3)", display:"block", marginBottom:4 }}>Category</label>
                    <input style={inputStyle} placeholder="e.g. Technical" value={form.category}
                      onChange={e => setForm(f => ({ ...f, category:e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:"var(--text-3)", display:"block", marginBottom:4 }}>Probability</label>
                    <select style={selStyle} value={form.probability}
                      onChange={e => setForm(f => ({ ...f, probability:e.target.value }))}>
                      {["VERY_LOW","LOW","MEDIUM","HIGH","VERY_HIGH"].map(v =>
                        <option key={v} value={v}>{v.replace("_"," ")}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:"var(--text-3)", display:"block", marginBottom:4 }}>Impact</label>
                    <select style={selStyle} value={form.impact}
                      onChange={e => setForm(f => ({ ...f, impact:e.target.value }))}>
                      {["NEGLIGIBLE","MINOR","MODERATE","MAJOR","CRITICAL"].map(v =>
                        <option key={v} value={v}>{v}</option>
                      )}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:11, color:"var(--text-3)", display:"block", marginBottom:4 }}>Mitigation plan</label>
                  <input style={inputStyle} placeholder="How will this risk be mitigated?" value={form.mitigation}
                    onChange={e => setForm(f => ({ ...f, mitigation:e.target.value }))} />
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button type="submit"
                    style={{ padding:"8px 16px", background:"var(--steel)", color:"#fff", border:"none",
                      borderRadius:"var(--radius)", fontSize:12, fontWeight:500, cursor:"pointer",
                      fontFamily:"var(--font)" }}>
                    Log risk
                  </button>
                  <button type="button" onClick={() => setCreating(false)}
                    style={{ padding:"8px 12px", background:"none", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                      fontFamily:"var(--font)", color:"var(--text-3)" }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {risks.length === 0 && !creating ? (
              <EmptyState icon="✅" title="No open risks"
                description="Log risks to track probability, impact, and mitigation plans." />
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {risks.map(r => {
                  const heat = heatColor(r.score)
                  const score = r.score || (PROB_SCORES[r.probability]||3) * (IMPACT_SCORES[r.impact]||3)
                  return (
                    <div key={r.id} style={{ background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", padding:"14px 16px",
                      display:"flex", gap:14, alignItems:"flex-start" }}>
                      <div style={{ width:36, height:36, borderRadius:8, flexShrink:0,
                        background:heat.bg, display:"flex", alignItems:"center",
                        justifyContent:"center", fontSize:14, fontWeight:700, color:heat.text }}>
                        {score}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{r.title}</span>
                          <span style={{ fontSize:10, fontFamily:"monospace", color:"var(--text-3)" }}>{r.code}</span>
                        </div>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:r.mitigation?6:0 }}>
                          {r.category && <Badge variant="gray">{r.category}</Badge>}
                          <Badge variant="gray">P: {r.probability?.replace("_"," ")}</Badge>
                          <Badge variant="gray">I: {r.impact}</Badge>
                          <Badge variant={score>=15?"red":score>=9?"amber":"blue"}>
                            Score: {score}
                          </Badge>
                        </div>
                        {r.mitigation && (
                          <div style={{ fontSize:12, color:"var(--text-3)", marginTop:4, lineHeight:1.5 }}>
                            <span style={{ fontWeight:500 }}>Mitigation:</span> {r.mitigation}
                          </div>
                        )}
                      </div>
                      <Badge variant={r.status==="CLOSED"?"green":r.status==="TRIGGERED"?"red":"amber"}>
                        {r.status}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === "changes" && (
          changes.length === 0 ? (
            <EmptyState icon="↻" title="No change requests"
              description="Submit change requests to document scope, budget, or schedule changes." />
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {changes.map(cr => (
                <div key={cr.id} style={{ background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", padding:"14px 16px" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{cr.title}</span>
                        <span style={{ fontSize:10, fontFamily:"monospace", color:"var(--text-3)" }}>{cr.code}</span>
                      </div>
                      <div style={{ fontSize:12, color:"var(--text-3)" }}>
                        {cr.createdBy?.name} · {new Date(cr.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                        {cr.budgetImpact && ` · Budget: $${Number(cr.budgetImpact).toLocaleString()}`}
                      </div>
                    </div>
                    <Badge variant={
                      cr.status==="APPROVED"?"green":cr.status==="REJECTED"?"red":
                      cr.status==="PENDING_APPROVAL"?"amber":"gray"
                    }>{cr.status?.replace("_"," ")}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
