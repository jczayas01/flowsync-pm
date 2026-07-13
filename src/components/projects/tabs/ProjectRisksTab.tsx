"use client"
// src/components/projects/tabs/ProjectRisksTab.tsx
// PM Best Practices — Uncertainty Performance Domain
// P×I heat map, risk register, opportunity tracking, response strategies

import { useState } from "react"
import { usePermissions } from "@/lib/rbac/usePermissions"
import { useRouter } from "next/navigation"
import { DocScanPicker } from "@/components/shared/DocScanPicker"
import { Avatar } from "@/components/ui"

const PROB_SCORES: Record<string,number> = {
  VERY_LOW:1, LOW:2, MEDIUM:3, HIGH:4, VERY_HIGH:5
}
const PROB_LABEL: Record<string,string> = {
  VERY_LOW:"Very Low (1-20%)", LOW:"Low (21-40%)", MEDIUM:"Medium (41-60%)",
  HIGH:"High (61-80%)", VERY_HIGH:"Very High (81-100%)"
}
const PROB_SHORT: Record<string,string> = {
  VERY_LOW:"VL", LOW:"L", MEDIUM:"M", HIGH:"H", VERY_HIGH:"VH"
}
const IMPACT_SCORES: Record<string,number> = {
  NEGLIGIBLE:1, MINOR:2, MODERATE:3, MAJOR:4, CRITICAL:5
}
const IMPACT_LABEL: Record<string,string> = {
  NEGLIGIBLE:"Negligible", MINOR:"Minor", MODERATE:"Moderate",
  MAJOR:"Major", CRITICAL:"Critical"
}
const IMPACT_SHORT: Record<string,string> = {
  NEGLIGIBLE:"Neg", MINOR:"Min", MODERATE:"Mod", MAJOR:"Maj", CRITICAL:"Crit"
}

const RESPONSE_TYPES_THREAT = ["AVOID","TRANSFER","MITIGATE","ACCEPT","ESCALATE"]
const RESPONSE_TYPES_OPP    = ["EXPLOIT","ENHANCE","SHARE","ACCEPT"]
const RESPONSE_LABEL: Record<string,string> = {
  AVOID:"Avoid", TRANSFER:"Transfer", MITIGATE:"Mitigate",
  ACCEPT:"Accept", ESCALATE:"Escalate",
  EXPLOIT:"Exploit", ENHANCE:"Enhance", SHARE:"Share",
}

const CATEGORIES = ["Schedule","Budget","Technical","Resource","External","Quality","Compliance","Other"]

function heatColor(score: number, isOpp=false): string {
  if (isOpp) {
    if (score >= 15) return "#059669"
    if (score >= 9)  return "#10B981"
    if (score >= 4)  return "#34D399"
    return "#D1FAE5"
  }
  if (score >= 15) return "#DC2626"
  if (score >= 9)  return "#F59E0B"
  if (score >= 4)  return "#1B6CA8"
  return "#94A3B8"
}
function heatBg(score: number, isOpp=false): string {
  if (isOpp) {
    if (score >= 15) return "#ECFDF5"
    if (score >= 9)  return "#F0FDF4"
    return "#F7FEF9"
  }
  if (score >= 15) return "#FEF2F2"
  if (score >= 9)  return "#FFFBEB"
  if (score >= 4)  return "#EFF6FF"
  return "#F8FAFC"
}

function cellColor(prob: number, impact: number): string {
  const s = prob * impact
  if (s >= 15) return "#FCA5A5"
  if (s >= 9)  return "#FCD34D"
  if (s >= 4)  return "#93C5FD"
  return "#E2E8F0"
}

const PROBS   = ["VERY_HIGH","HIGH","MEDIUM","LOW","VERY_LOW"]
const IMPACTS = ["NEGLIGIBLE","MINOR","MODERATE","MAJOR","CRITICAL"]

export function ProjectRisksTab({ projectId, risks, members, workspaceId }: {
  projectId: string; risks: any[]; members: any[]; workspaceId: string
}) {
  const router = useRouter()

  // ── AI document scan → risk candidates ──
  const [scanOpen, setScanOpen]         = useState(false)
  const [scanning, setScanning]         = useState(false)
  const [scanError, setScanError]       = useState("")
  const [candidates, setCandidates]     = useState<any[]|null>(null)
  const [scanSkipped, setScanSkipped] = useState<{name:string;reason:string}[]>([])
  const [pickedCands, setPickedCands]   = useState<Set<number>>(new Set())
  const [committing, setCommitting]     = useState(false)

  async function runScan(documentIds: string[]) {
    setScanning(true); setScanError(""); setCandidates(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/risks-scan?workspaceId=${workspaceId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) { setScanError(d?.error || `Scan failed (${res.status})`); return }
      const c = d?.data?.candidates || []
      setScanSkipped(d?.data?.skippedDocs || [])
      setCandidates(c)
      setPickedCands(new Set(c.map((_: any, i: number) => i)))
    } catch { setScanError("Connection lost — try again") }
    finally { setScanning(false) }
  }

  async function commitCandidates() {
    if (!candidates || committing) return
    const chosen = candidates.filter((_, i) => pickedCands.has(i))
    if (!chosen.length) return
    setCommitting(true); setScanError("")
    try {
      const results = await Promise.all(chosen.map(c =>
        fetch(`/api/risks`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
          body: JSON.stringify({
            projectId,
            title: String(c.title || "").slice(0, 500),
            description: [c.description, c.evidence ? `Source: ${c.sourceDoc} — "${c.evidence}"` : ""].filter(Boolean).join("\n\n").slice(0, 3000),
            category: c.category ? String(c.category).slice(0, 100) : undefined,
            probability: ["VERY_LOW","LOW","MEDIUM","HIGH","VERY_HIGH"].includes(c.probability) ? c.probability : "MEDIUM",
            impact: ["NEGLIGIBLE","MINOR","MODERATE","MAJOR","CRITICAL"].includes(c.impact) ? c.impact : "MODERATE",
            isOpportunity: !!c.isOpportunity,
            responseType: ["AVOID","TRANSFER","MITIGATE","ACCEPT","ESCALATE","EXPLOIT","ENHANCE","SHARE"].includes(c.responseType) ? c.responseType : null,
          }),
        })
      ))
      const failed = results.filter(r => !r.ok).length
      if (failed) setScanError(`${failed} item(s) could not be added`)
      setCandidates(null); setScanOpen(false)
      router.refresh()
    } catch { setScanError("Connection lost — try again") }
    finally { setCommitting(false) }
  }
  const { can } = usePermissions()
  const [view, setView] = useState<"matrix"|"register">("matrix")
  const [showOpp, setShowOpp] = useState(false)
  const [statusFilter, setStatusFilter] = useState("OPEN")
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<any>(null)

  const emptyForm = {
    title:"", description:"", category:"Technical",
    probability:"MEDIUM", impact:"MODERATE",
    isOpportunity:false, responseType:"",
    ownerId:"", mitigationPlan:"", contingencyPlan:"",
    residualRisk:"", reviewDate:"",
  }
  const [form, setForm] = useState(emptyForm)

  const displayed = risks.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false
    if (showOpp !== (r.isOpportunity || false)) return false
    return true
  })

  async function createRisk() {
    if (!form.title.trim()) { setError("Title is required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/risks`, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({
          projectId,
          ...form,
          isOpportunity: form.isOpportunity,
          responseType: form.responseType || null,
          ownerId: form.ownerId || null,
          reviewDate: form.reviewDate ? new Date(form.reviewDate+"T00:00:00.000Z").toISOString() : null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        setError(d.error || "Failed to create risk")
        return
      }
      setCreating(false)
      setForm(emptyForm)
      router.refresh()
    } catch { setError("Network error") }
    finally { setSaving(false) }
  }

  async function updateRisk(riskId: string, patch: any) {
    const res = await fetch(`/api/risks/${riskId}`, {
      method:"PATCH",
      headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const d = await res.json().catch(()=>({}))
      alert(d?.error || `Update failed (${res.status})`)
      return
    }
    router.refresh()
    setSelected(null)
  }

  // ── Full edit mode for the detail drawer ──
  const [editRisk, setEditRisk]     = useState<any|null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  function openEdit() {
    if (!selected) return
    setEditRisk({
      title: selected.title || "",
      category: selected.category || "",
      probability: selected.probability || "MEDIUM",
      impact: selected.impact || "MODERATE",
      responseType: selected.responseType || "",
      ownerId: selected.ownerId || selected.owner?.id || "",
      description: selected.description || "",
      mitigationPlan: selected.mitigationPlan || "",
      contingencyPlan: selected.contingencyPlan || "",
    })
  }

  async function saveEdit() {
    if (!editRisk?.title?.trim() || savingEdit) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/risks/${selected.id}`, {
        method:"PATCH",
        headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({
          title: editRisk.title.trim(),
          category: editRisk.category || null,
          probability: editRisk.probability,
          impact: editRisk.impact,
          responseType: editRisk.responseType || null,
          ownerId: editRisk.ownerId || null,
          description: editRisk.description || null,
          mitigationPlan: editRisk.mitigationPlan || null,
          contingencyPlan: editRisk.contingencyPlan || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        alert(d?.error || `Update failed (${res.status})`)
        return
      }
      setEditRisk(null); setSelected(null)
      router.refresh()
    } finally { setSavingEdit(false) }
  }

  const inp: React.CSSProperties = {
    width:"100%", padding:"8px 11px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    color:"var(--text)", outline:"none",
  }
  const lbl: React.CSSProperties = {
    display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
    marginBottom:4, textTransform:"uppercase", letterSpacing:".05em",
  }

  const responseTypes = form.isOpportunity ? RESPONSE_TYPES_OPP : RESPONSE_TYPES_THREAT

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>

      {/* Toolbar */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"10px 16px", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>

        {/* View toggle */}
        <div style={{ display:"flex", border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" }}>
          {[{id:"matrix",label:"🗺 Heat Map"},{id:"register",label:"📋 Register"}].map(v => (
            <button key={v.id} onClick={() => setView(v.id as any)}
              style={{ padding:"6px 12px", border:"none", fontSize:12, fontWeight:view===v.id?600:400,
                cursor:"pointer", fontFamily:"var(--font)",
                background:view===v.id?"var(--steel)":"#fff",
                color:view===v.id?"#fff":"var(--text-2)" }}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Threat / Opportunity toggle */}
        <div style={{ display:"flex", border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" }}>
          {[{v:false,l:"⚠ Threats"},{v:true,l:"💡 Opportunities"}].map(t => (
            <button key={String(t.v)} onClick={() => setShowOpp(t.v)}
              style={{ padding:"6px 12px", border:"none", fontSize:12, fontWeight:showOpp===t.v?600:400,
                cursor:"pointer", fontFamily:"var(--font)",
                background:showOpp===t.v?(t.v?"var(--green)":"var(--red)"):"#fff",
                color:showOpp===t.v?"#fff":"var(--text-2)" }}>
              {t.l}
            </button>
          ))}
        </div>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ ...inp, width:"auto", padding:"6px 10px", fontSize:12 }}>
          <option value="">All statuses</option>
          {["OPEN","MITIGATED","ACCEPTED","TRIGGERED","CLOSED"].map(s =>
            <option key={s} value={s}>{s.charAt(0)+s.slice(1).toLowerCase()}</option>
          )}
        </select>

        <span style={{ fontSize:12, color:"var(--text-3)" }}>
          {displayed.length} {showOpp ? "opportunit" : "risk"}{displayed.length!==1 ? (showOpp?"ies":"s") : (showOpp?"y":"")}
        </span>

        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          {can("risks:create") && (
          <button onClick={() => { setScanOpen(o => !o); setCandidates(null); setScanError("") }}
            title="AI-scan project documents for risks and opportunities"
            style={{ padding:"7px 14px", background:"#fff", color:"var(--text-2)",
              border:"1px solid var(--border)", borderRadius:"var(--radius)", fontSize:12,
              fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}>
            🤖 Scan documents
          </button>
          )}
          {can("risks:create") && (
          <button onClick={() => { setCreating(true); setForm({...emptyForm, isOpportunity:showOpp}) }}
            style={{ padding:"7px 16px", background:"var(--steel)", color:"#fff", border:"none",
              borderRadius:"var(--radius)", fontSize:12, fontWeight:500, cursor:"pointer",
              fontFamily:"var(--font)" }}>
            + {showOpp ? "Add opportunity" : "Add risk"}
          </button>
          )}
        </div>
      </div>

      {scanOpen && (
        <div style={{ margin:"0 0 12px", padding:14, border:"1px solid var(--border)",
          borderRadius:"var(--radius)", background:"var(--surface)" }}>
          {!candidates ? (
            <DocScanPicker projectId={projectId} workspaceId={workspaceId}
              scanning={scanning} onScan={runScan} />
          ) : (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--text)", marginBottom:8 }}>
                {candidates.length ? `Found ${candidates.length} candidate${candidates.length===1?"":"s"} — review and add:` : "No risks found in the selected documents."}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:320, overflowY:"auto" }}>
                {candidates.map((c: any, i: number) => (
                  <label key={i} style={{ display:"flex", gap:10, alignItems:"flex-start",
                    padding:"10px 12px", background:"#fff", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", cursor:"pointer" }}>
                    <input type="checkbox" checked={pickedCands.has(i)} style={{ marginTop:3 }}
                      onChange={() => setPickedCands(prev => {
                        const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n
                      })} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:2, flexWrap:"wrap" }}>
                        <span style={{ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:4,
                          background: c.isOpportunity ? "#ECFDF5" : "#FEF2F2",
                          color: c.isOpportunity ? "#059669" : "#B91C1C" }}>
                          {c.isOpportunity ? "OPPORTUNITY" : "THREAT"}
                        </span>
                        <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{c.title}</span>
                        <span style={{ fontSize:10, color:"var(--text-3)" }}>
                          {c.probability} × {c.impact}{c.category ? ` · ${c.category}` : ""}
                        </span>
                      </div>
                      {c.description && <div style={{ fontSize:12, color:"var(--text-2)", lineHeight:1.5 }}>{c.description}</div>}
                      {c.evidence && (
                        <div style={{ fontSize:11, color:"var(--text-3)", fontStyle:"italic", marginTop:3 }}>
                          "{c.evidence}" — {c.sourceDoc}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ display:"flex", gap:8, marginTop:10, alignItems:"center" }}>
                {candidates.length > 0 && (
                <button onClick={commitCandidates} disabled={committing || pickedCands.size === 0}
                  style={{ padding:"7px 16px", background:"var(--steel)", color:"#fff", border:"none",
                    borderRadius:"var(--radius)", fontSize:12, fontWeight:500, fontFamily:"var(--font)",
                    cursor: committing || pickedCands.size === 0 ? "not-allowed" : "pointer",
                    opacity: committing || pickedCands.size === 0 ? 0.6 : 1 }}>
                  {committing ? "Adding…" : `＋ Add ${pickedCands.size} to register`}
                </button>
                )}
                <button onClick={() => setCandidates(null)}
                  style={{ padding:"7px 12px", background:"#fff", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                    fontFamily:"var(--font)", color:"var(--text-2)" }}>
                  ← Pick different documents
                </button>
              </div>
            </div>
          )}
          {scanSkipped.length > 0 && candidates && (
            <div style={{ fontSize:11, color:"#B45309", marginTop:8 }}>
              ⚠ Skipped: {scanSkipped.map(x => `${x.name} (${x.reason})`).join(" · ")}
            </div>
          )}
          {scanError && <div style={{ fontSize:12, color:"#B91C1C", marginTop:8 }}>✗ {scanError}</div>}
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto" }}>

        {/* ── Create form ── */}
        {creating && (
          <div style={{ background:"#fff", borderBottom:"1px solid var(--border)", padding:20 }}>
            <div style={{ maxWidth:760, display:"flex", flexDirection:"column", gap:14 }}>
              {error && (
                <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"var(--red)",
                  padding:"9px 12px", borderRadius:"var(--radius)", fontSize:12 }}>
                  ✗ {error}
                </div>
              )}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={lbl}>Title *</label>
                  <input style={inp} value={form.title} placeholder={showOpp?"Describe the opportunity...":"Describe the risk..."}
                    onChange={e => setForm(f=>({...f,title:e.target.value}))} />
                </div>
                <div>
                  <label style={lbl}>Category</label>
                  <select style={{...inp,cursor:"pointer"}} value={form.category}
                    onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Probability</label>
                  <select style={{...inp,cursor:"pointer"}} value={form.probability}
                    onChange={e => setForm(f=>({...f,probability:e.target.value}))}>
                    {Object.entries(PROB_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Impact</label>
                  <select style={{...inp,cursor:"pointer"}} value={form.impact}
                    onChange={e => setForm(f=>({...f,impact:e.target.value}))}>
                    {Object.entries(IMPACT_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Response strategy</label>
                  <select style={{...inp,cursor:"pointer"}} value={form.responseType}
                    onChange={e => setForm(f=>({...f,responseType:e.target.value}))}>
                    <option value="">— Select —</option>
                    {responseTypes.map(r => <option key={r} value={r}>{RESPONSE_LABEL[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Owner</label>
                  <select style={{...inp,cursor:"pointer"}} value={form.ownerId}
                    onChange={e => setForm(f=>({...f,ownerId:e.target.value}))}>
                    <option value="">Unassigned</option>
                    {members.map(m => <option key={m.userId||m.id} value={m.userId||m.id}>{m.user?.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Review date</label>
                  <input type="date" style={inp} value={form.reviewDate}
                    onChange={e => setForm(f=>({...f,reviewDate:e.target.value}))} />
                </div>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={lbl}>{showOpp ? "Enhancement plan" : "Mitigation plan"}</label>
                  <textarea rows={2} style={{...inp,resize:"vertical",lineHeight:1.6}}
                    value={form.mitigationPlan}
                    placeholder={showOpp?"How will you exploit or enhance this opportunity?":"How will you reduce probability or impact?"}
                    onChange={e => setForm(f=>({...f,mitigationPlan:e.target.value}))} />
                </div>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={lbl}>Contingency plan</label>
                  <textarea rows={2} style={{...inp,resize:"vertical",lineHeight:1.6}}
                    value={form.contingencyPlan}
                    placeholder="What will you do if this risk occurs?"
                    onChange={e => setForm(f=>({...f,contingencyPlan:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={createRisk} disabled={saving||!form.title.trim()}
                  style={{ padding:"8px 20px", background:"var(--steel)", color:"#fff", border:"none",
                    borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                    cursor:saving?"wait":"pointer", fontFamily:"var(--font)",
                    opacity:!form.title.trim()?0.5:1 }}>
                  {saving ? "Saving…" : `Save ${showOpp?"opportunity":"risk"}`}
                </button>
                <button onClick={() => { setCreating(false); setError("") }}
                  style={{ padding:"8px 14px", background:"#fff", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", fontSize:13, cursor:"pointer",
                    fontFamily:"var(--font)", color:"var(--text-2)" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── HEAT MAP VIEW ── */}
        {view === "matrix" && (
          <div style={{ padding:20 }}>
            <div style={{ maxWidth:700, margin:"0 auto" }}>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:4 }}>
                {showOpp ? "Opportunity" : "Risk"} Probability × Impact Matrix
              </div>
              <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:16 }}>
                Click any cell to see risks in that zone · Showing {statusFilter || "all"} {showOpp?"opportunities":"risks"}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"auto repeat(5,1fr)", gap:3 }}>
                {/* Y-axis label */}
                <div style={{ gridRow:"1/7", display:"flex", alignItems:"center",
                  justifyContent:"center", writingMode:"vertical-rl",
                  transform:"rotate(180deg)", fontSize:10, fontWeight:700,
                  color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".08em",
                  paddingRight:8 }}>
                  Probability
                </div>

                {/* Column headers */}
                <div style={{ gridColumn:"2/-1", display:"grid",
                  gridTemplateColumns:"repeat(5,1fr)", gap:3, marginBottom:3 }}>
                  {IMPACTS.map(imp => (
                    <div key={imp} style={{ textAlign:"center", fontSize:9, fontWeight:700,
                      color:"var(--text-3)", textTransform:"uppercase", padding:"2px 0" }}>
                      {IMPACT_SHORT[imp]}
                    </div>
                  ))}
                </div>

                {/* Matrix rows */}
                {PROBS.map(prob => (
                  <div key={prob} style={{ display:"contents" }}>
                    <div style={{ textAlign:"right", fontSize:9, fontWeight:700,
                      color:"var(--text-3)", textTransform:"uppercase",
                      padding:"2px 6px 2px 0", display:"flex", alignItems:"center",
                      justifyContent:"flex-end" }}>
                      {PROB_SHORT[prob]}
                    </div>
                    {IMPACTS.map(impact => {
                      const score = PROB_SCORES[prob] * IMPACT_SCORES[impact]
                      const cellRisks = displayed.filter(r =>
                        r.probability === prob && r.impact === impact
                      )
                      const bg = cellColor(PROB_SCORES[prob], IMPACT_SCORES[impact])
                      return (
                        <div key={impact}
                          style={{ background:bg, borderRadius:6, padding:"8px 4px",
                            minHeight:60, display:"flex", flexDirection:"column",
                            alignItems:"center", justifyContent:"center",
                            cursor:cellRisks.length>0?"pointer":"default",
                            border:"2px solid transparent",
                            transition:"border .15s" }}
                          onMouseOver={e => e.currentTarget.style.border="2px solid rgba(0,0,0,.15)"}
                          onMouseOut={e  => e.currentTarget.style.border="2px solid transparent"}>
                          <div style={{ fontSize:10, fontWeight:700,
                            color:"rgba(0,0,0,.4)", marginBottom:4 }}>
                            {score}
                          </div>
                          {cellRisks.map(r => (
                            <div key={r.id} onClick={() => setSelected(r)}
                              style={{ background:"rgba(255,255,255,.8)", borderRadius:4,
                                padding:"2px 5px", margin:"2px 0", fontSize:9,
                                fontWeight:600, color:"#1E293B", maxWidth:"90%",
                                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                                cursor:"pointer", width:"100%", textAlign:"center" }}
                              title={r.title}>
                              {r.code}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ))}

                {/* X-axis label */}
                <div style={{ gridColumn:"2/-1", textAlign:"center", fontSize:10,
                  fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                  letterSpacing:".08em", marginTop:6 }}>
                  Impact
                </div>
              </div>

              {/* Legend */}
              <div style={{ display:"flex", gap:12, marginTop:16, flexWrap:"wrap" }}>
                {showOpp ? (
                  <>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:14, height:14, borderRadius:3, background:"#059669" }} />
                      <span style={{ fontSize:11, color:"var(--text-3)" }}>High value (15-25)</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:14, height:14, borderRadius:3, background:"#10B981" }} />
                      <span style={{ fontSize:11, color:"var(--text-3)" }}>Medium value (9-14)</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:14, height:14, borderRadius:3, background:"#34D399" }} />
                      <span style={{ fontSize:11, color:"var(--text-3)" }}>Low value (1-8)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:14, height:14, borderRadius:3, background:"#FCA5A5" }} />
                      <span style={{ fontSize:11, color:"var(--text-3)" }}>Critical (15-25)</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:14, height:14, borderRadius:3, background:"#FCD34D" }} />
                      <span style={{ fontSize:11, color:"var(--text-3)" }}>High (9-14)</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:14, height:14, borderRadius:3, background:"#93C5FD" }} />
                      <span style={{ fontSize:11, color:"var(--text-3)" }}>Medium (4-8)</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:14, height:14, borderRadius:3, background:"#E2E8F0" }} />
                      <span style={{ fontSize:11, color:"var(--text-3)" }}>Low (1-3)</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── REGISTER VIEW ── */}
        {view === "register" && (
          <div style={{ padding:20 }}>
            {displayed.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px" }}>
                <div style={{ fontSize:36, marginBottom:12 }}>{showOpp?"💡":"⚠"}</div>
                <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>
                  No {showOpp?"opportunities":"risks"} yet
                </div>
                <div style={{ fontSize:13, color:"var(--text-3)", marginBottom:20, maxWidth:360, margin:"0 auto 20px" }}>
                  {showOpp
                    ? "PM best practices recognize positive risks as opportunities to be exploited, enhanced, or shared."
                    : "Identify and track threats to proactively manage uncertainty on this project."}
                </div>
                <button onClick={() => { setCreating(true); setForm({...emptyForm,isOpportunity:showOpp}) }}
                  style={{ padding:"10px 20px", background:"var(--steel)", color:"#fff", border:"none",
                    borderRadius:"var(--radius)", fontSize:13, fontWeight:500, cursor:"pointer",
                    fontFamily:"var(--font)" }}>
                  + Add {showOpp?"opportunity":"risk"}
                </button>
              </div>
            ) : (
              <table style={{ width:"100%", borderCollapse:"collapse", background:"#fff",
                border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" }}>
                <thead>
                  <tr style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)" }}>
                    {["Code","Title","Category","P","I","Score","Response","Owner","Status",""].map((h,i) => (
                      <th key={i} style={{ padding:"9px 12px", textAlign:"left", fontSize:10,
                        fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                        letterSpacing:".05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(r => {
                    const c = heatColor(r.score, r.isOpportunity)
                    const bg = heatBg(r.score, r.isOpportunity)
                    return (
                      <tr key={r.id} style={{ borderBottom:"1px solid var(--surface-1,#F1F5F9)",
                        cursor:"pointer" }}
                        onMouseOver={e => (e.currentTarget.style.background="var(--surface)")}
                        onMouseOut={e  => (e.currentTarget.style.background="transparent")}
                        onClick={() => setSelected(r)}>
                        <td style={{ padding:"9px 12px", fontSize:11, fontWeight:700, color:"var(--text-3)" }}>
                          {r.code}
                        </td>
                        <td style={{ padding:"9px 12px", fontSize:12, fontWeight:500, color:"var(--text)",
                          maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {r.isOpportunity && <span style={{ marginRight:4 }}>💡</span>}
                          {r.title}
                        </td>
                        <td style={{ padding:"9px 12px", fontSize:11, color:"var(--text-3)" }}>
                          {r.category}
                        </td>
                        <td style={{ padding:"9px 12px", fontSize:11, fontWeight:600, color:"var(--text-2)" }}>
                          {PROB_SHORT[r.probability]}
                        </td>
                        <td style={{ padding:"9px 12px", fontSize:11, fontWeight:600, color:"var(--text-2)" }}>
                          {IMPACT_SHORT[r.impact]}
                        </td>
                        <td style={{ padding:"9px 12px" }}>
                          <span style={{ padding:"3px 8px", borderRadius:12, fontSize:11,
                            fontWeight:700, color:c, background:bg }}>
                            {r.score}
                          </span>
                        </td>
                        <td style={{ padding:"9px 12px", fontSize:11, color:"var(--text-3)" }}>
                          {r.responseType ? RESPONSE_LABEL[r.responseType] : "—"}
                        </td>
                        <td style={{ padding:"9px 12px" }}>
                          {r.owner ? (
                            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                              <Avatar name={r.owner.name} avatarUrl={r.owner.avatarUrl} size={18} />
                              <span style={{ fontSize:11, color:"var(--text-2)" }}>{r.owner.name}</span>
                            </div>
                          ) : <span style={{ fontSize:11, color:"var(--text-4)" }}>—</span>}
                        </td>
                        <td style={{ padding:"9px 12px" }}>
                          <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px",
                            borderRadius:10,
                            background:r.status==="OPEN"?"#EFF6FF":r.status==="TRIGGERED"?"#FEF2F2":"#F1F5F9",
                            color:r.status==="OPEN"?"var(--steel)":r.status==="TRIGGERED"?"var(--red)":"var(--text-3)" }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding:"9px 12px" }}>
                          <span style={{ fontSize:11, color:"var(--steel)" }}>View →</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Risk detail panel ── */}
      {selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)",
          display:"flex", alignItems:"flex-end", justifyContent:"flex-end", zIndex:100 }}
          onClick={() => setSelected(null)}>
          <div style={{ width:480, height:"100%", background:"#fff",
            boxShadow:"-8px 0 32px rgba(0,0,0,.15)", overflow:"auto",
            padding:24, display:"flex", flexDirection:"column", gap:16 }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--text-3)", marginBottom:4 }}>
                  {selected.code} · {selected.isOpportunity ? "OPPORTUNITY" : "RISK"}
                </div>
                <h2 style={{ fontSize:17, fontWeight:700, color:"var(--text)", margin:0 }}>
                  {selected.title}
                </h2>
              </div>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                {can("risks:create") && !editRisk && (
                  <button onClick={openEdit}
                    style={{ padding:"5px 12px", background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", fontSize:11, fontWeight:600, cursor:"pointer",
                      fontFamily:"var(--font)", color:"var(--text-2)" }}>
                    ✏️ Edit
                  </button>
                )}
                <button onClick={() => { setEditRisk(null); setSelected(null) }}
                  style={{ background:"none", border:"none", fontSize:18, cursor:"pointer",
                    color:"var(--text-3)", lineHeight:1 }}>✕</button>
              </div>
            </div>

            {editRisk && (
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
                borderRadius:8, padding:14, display:"flex", flexDirection:"column", gap:10 }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                    letterSpacing:".05em", marginBottom:4 }}>Title</div>
                  <input style={inp} value={editRisk.title}
                    onChange={e=>setEditRisk((f:any)=>({...f, title:e.target.value}))} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                      letterSpacing:".05em", marginBottom:4 }}>Probability</div>
                    <select style={{...inp, cursor:"pointer"}} value={editRisk.probability}
                      onChange={e=>setEditRisk((f:any)=>({...f, probability:e.target.value}))}>
                      {["VERY_LOW","LOW","MEDIUM","HIGH","VERY_HIGH"].map(v=>
                        <option key={v} value={v}>{PROB_LABEL[v]||v}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                      letterSpacing:".05em", marginBottom:4 }}>Impact</div>
                    <select style={{...inp, cursor:"pointer"}} value={editRisk.impact}
                      onChange={e=>setEditRisk((f:any)=>({...f, impact:e.target.value}))}>
                      {["NEGLIGIBLE","MINOR","MODERATE","MAJOR","CRITICAL"].map(v=>
                        <option key={v} value={v}>{IMPACT_LABEL[v]||v}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                      letterSpacing:".05em", marginBottom:4 }}>Owner</div>
                    <select style={{...inp, cursor:"pointer"}} value={editRisk.ownerId}
                      onChange={e=>setEditRisk((f:any)=>({...f, ownerId:e.target.value}))}>
                      <option value="">Unassigned</option>
                      {members.map((m:any) => <option key={m.userId||m.id} value={m.userId||m.id}>{m.user?.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                      letterSpacing:".05em", marginBottom:4 }}>Response</div>
                    <select style={{...inp, cursor:"pointer"}} value={editRisk.responseType}
                      onChange={e=>setEditRisk((f:any)=>({...f, responseType:e.target.value}))}>
                      <option value="">—</option>
                      {(selected.isOpportunity
                        ? ["EXPLOIT","ENHANCE","SHARE","ACCEPT"]
                        : ["AVOID","TRANSFER","MITIGATE","ACCEPT","ESCALATE"]
                      ).map(v => <option key={v} value={v}>{RESPONSE_LABEL[v]||v}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                    letterSpacing:".05em", marginBottom:4 }}>Description</div>
                  <textarea style={{...inp, resize:"vertical"}} rows={2} value={editRisk.description}
                    onChange={e=>setEditRisk((f:any)=>({...f, description:e.target.value}))} />
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                    letterSpacing:".05em", marginBottom:4 }}>
                    {selected.isOpportunity ? "Enhancement plan" : "Mitigation plan"}
                  </div>
                  <textarea style={{...inp, resize:"vertical"}} rows={2} value={editRisk.mitigationPlan}
                    onChange={e=>setEditRisk((f:any)=>({...f, mitigationPlan:e.target.value}))} />
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={saveEdit} disabled={savingEdit || !editRisk.title.trim()}
                    style={{ padding:"8px 18px", background:"var(--steel)", color:"#fff", border:"none",
                      borderRadius:"var(--radius)", fontSize:12, fontWeight:600, fontFamily:"var(--font)",
                      cursor: savingEdit ? "wait" : "pointer" }}>
                    {savingEdit ? "Saving…" : "💾 Save changes"}
                  </button>
                  <button onClick={() => setEditRisk(null)}
                    style={{ padding:"8px 14px", background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                      fontFamily:"var(--font)", color:"var(--text-2)" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Score badge */}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <span style={{ padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:700,
                color:heatColor(selected.score, selected.isOpportunity),
                background:heatBg(selected.score, selected.isOpportunity) }}>
                Score: {selected.score}
              </span>
              <span style={{ padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600,
                background:"var(--surface)", color:"var(--text-2)" }}>
                {PROB_LABEL[selected.probability]}
              </span>
              <span style={{ padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600,
                background:"var(--surface)", color:"var(--text-2)" }}>
                {IMPACT_LABEL[selected.impact]} impact
              </span>
              {selected.responseType && (
                <span style={{ padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600,
                  background:"#EFF6FF", color:"var(--steel)" }}>
                  {RESPONSE_LABEL[selected.responseType]}
                </span>
              )}
            </div>

            {selected.description && (
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)",
                  textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>
                  Description
                </div>
                <p style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.7, margin:0 }}>
                  {selected.description}
                </p>
              </div>
            )}
            {selected.mitigationPlan && (
              <div style={{ background:"var(--surface)", borderRadius:"var(--radius)", padding:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)",
                  textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>
                  {selected.isOpportunity ? "Enhancement plan" : "Mitigation plan"}
                </div>
                <p style={{ fontSize:12, color:"var(--text-2)", lineHeight:1.7, margin:0,
                  whiteSpace:"pre-line" }}>
                  {selected.mitigationPlan}
                </p>
              </div>
            )}
            {selected.contingencyPlan && (
              <div style={{ background:"#FFFBEB", borderRadius:"var(--radius)", padding:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#92400E",
                  textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>
                  Contingency plan
                </div>
                <p style={{ fontSize:12, color:"#78350F", lineHeight:1.7, margin:0,
                  whiteSpace:"pre-line" }}>
                  {selected.contingencyPlan}
                </p>
              </div>
            )}
            {selected.residualRisk && (
              <div style={{ background:"#FEF2F2", borderRadius:"var(--radius)", padding:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--red)",
                  textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>
                  Residual risk
                </div>
                <p style={{ fontSize:12, color:"#991B1B", lineHeight:1.7, margin:0 }}>
                  {selected.residualRisk}
                </p>
              </div>
            )}

            {/* Status actions */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)",
                textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>
                Update status
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {["OPEN","MITIGATED","ACCEPTED","TRIGGERED","CLOSED"].map(s => (
                  <button key={s} onClick={() => updateRisk(selected.id, {status:s})}
                    style={{ padding:"5px 12px", fontSize:11, fontWeight:600,
                      cursor:"pointer", fontFamily:"var(--font)",
                      borderRadius:"var(--radius)", border:"1px solid var(--border)",
                      background:selected.status===s?"var(--steel)":"#fff",
                      color:selected.status===s?"#fff":"var(--text-2)" }}>
                    {s.charAt(0)+s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
