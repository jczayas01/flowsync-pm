"use client"
// src/components/projects/BaselinesPage.tsx
// PM Best Practices — Baseline Management (Planning Performance Domain §2.4)
// Three formal baselines: Schedule, Cost, Scope
// Approval workflow: Working → Approved (locked, permanent record)
// Re-baseline prompt after Change Request implementation

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/ui"
import { BaselineComparison } from "@/components/projects/BaselineComparison"

function fmtDate(d: any) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric", timeZone:"UTC" })
}
function fmtCurrency(n: number, currency="USD") {
  if (n>=1_000_000) return `${currency} ${(n/1_000_000).toFixed(2)}M`
  if (n>=1_000)     return `${currency} ${(n/1_000).toFixed(0)}K`
  return `${currency} ${n.toFixed(0)}`
}
function daysDiff(a: any, b: any): string {
  if (!a || !b) return "—"
  const diff = Math.round((new Date(b).getTime()-new Date(a).getTime())/86400000)
  if (diff===0) return "No change"
  return (diff>0?"+":"")+diff+" days"
}

export function BaselinesPage({ projectId, workspaceId, baselines, project, changeRequests, tasks }: {
  projectId:string; workspaceId:string; baselines:any[]; project:any; changeRequests?:any[]; tasks?:any[]
}) {
  const router = useRouter()
  const [deletingId, setDeletingId]   = useState<string|null>(null)
  const [approvingId, setApprovingId] = useState<string|null>(null)
  const [approvalNotes, setApprovalNotes] = useState("")
  const [approveModal, setApproveModal]   = useState<any>(null)
  const [comparing, setComparing]         = useState<[string,string]|null>(null)
  const [savingNew, setSavingNew]         = useState(false)
  const [newName, setNewName]             = useState("")
  const [newDesc, setNewDesc]             = useState("")
  const [showSaveForm, setShowSaveForm]   = useState(false)
  const [linkedCr, setLinkedCr]           = useState("")
  const [error, setError]                 = useState("")
  const [showScopeOf, setShowScopeOf]     = useState<string|null>(null)
  const [showVsActual, setShowVsActual]   = useState(false)

  // Implemented CRs that haven't triggered a re-baseline yet
  const implementedCrs = (changeRequests||[]).filter(cr =>
    cr.status === "IMPLEMENTED" &&
    !baselines.some(b => b.linkedCrId === cr.id)
  )

  async function saveBaseline() {
    if (!newName.trim()) { setError("Name required"); return }
    setSavingNew(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/baselines`, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ name:newName, description:newDesc||null, linkedCrId:linkedCr||null }),
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        setError(d.error || "Failed to save baseline"); return
      }
      setShowSaveForm(false); setNewName(""); setNewDesc(""); setLinkedCr("")
      router.refresh()
    } finally { setSavingNew(false) }
  }

  async function approveBaseline() {
    if (!approveModal) return
    setApprovingId(approveModal.id)
    try {
      await fetch(`/api/projects/${projectId}/baselines/${approveModal.id}`, {
        method:"PATCH",
        headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ action:"approve", approvalNotes:approvalNotes||null }),
      })
      setApproveModal(null); setApprovalNotes("")
      router.refresh()
    } finally { setApprovingId(null) }
  }

  async function deleteBaseline(baselineId: string) {
    if (!confirm("Delete this working baseline? This cannot be undone.")) return
    setDeletingId(baselineId)
    try {
      await fetch(`/api/projects/${projectId}/baselines/${baselineId}`, {
        method:"DELETE", headers:{"x-workspace-id":workspaceId},
      })
      router.refresh()
    } finally { setDeletingId(null) }
  }

  const compareA = comparing ? baselines.find(b=>b.id===comparing[0]) : null
  const compareB = comparing ? baselines.find(b=>b.id===comparing[1]) : null
  const approvedBaselines = baselines.filter(b => b.isApproved)
  const workingBaselines  = baselines.filter(b => !b.isApproved)

  const inp: React.CSSProperties = {
    width:"100%", padding:"8px 12px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    color:"var(--text)", outline:"none",
  }
  const lbl: React.CSSProperties = {
    display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
    textTransform:"uppercase", letterSpacing:".05em", marginBottom:5,
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflowY:"auto" }}>

      {/* ── Approval modal ── */}
      {approveModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:200,
          display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={() => setApproveModal(null)}>
          <div style={{ background:"#fff", borderRadius:12, padding:28, width:460,
            boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:17, fontWeight:700, color:"var(--text)", marginBottom:4 }}>
              Approve Baseline
            </div>
            <div style={{ fontSize:12, color:"var(--text-3)", marginBottom:16, lineHeight:1.6 }}>
              <strong>{approveModal.name}</strong><br/>
              Approving a baseline makes it the official reference point for this project.
              Approved baselines <strong>cannot be deleted</strong> — they are part of the
              project's permanent governance record per PM best practices.
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Approval notes (optional)</label>
              <textarea rows={3} value={approvalNotes}
                onChange={e => setApprovalNotes(e.target.value)}
                placeholder="e.g. Approved by Steering Committee on June 30, 2026 — Phase 1 completion baseline."
                style={{...inp, resize:"vertical", lineHeight:1.6}} />
            </div>
            <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:"var(--radius)",
              padding:"10px 14px", fontSize:12, color:"#92400E", marginBottom:20, lineHeight:1.5 }}>
              ⚠️ This action is permanent. Once approved, this baseline is locked.
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button onClick={() => { setApproveModal(null); setApprovalNotes("") }}
                style={{ padding:"9px 18px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:13, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>Cancel</button>
              <button onClick={approveBaseline} disabled={!!approvingId}
                style={{ padding:"9px 20px", background:"var(--green)", color:"#fff",
                  border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:600,
                  cursor:"pointer", fontFamily:"var(--font)" }}>
                {approvingId ? "Approving…" : "✓ Approve baseline"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scope snapshot modal ── */}
      {showScopeOf && (() => {
        const b = baselines.find(x => x.id === showScopeOf)
        if (!b) return null
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:200,
            display:"flex", alignItems:"center", justifyContent:"center" }}
            onClick={() => setShowScopeOf(null)}>
            <div style={{ background:"#fff", borderRadius:12, padding:28, width:540, maxHeight:"80vh",
              overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--text)", marginBottom:4 }}>
                Scope Baseline — {b.name}
              </div>
              <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:20 }}>
                Captured {fmtDate(b.createdAt)}
              </div>
              {[
                { label:"Project Objective", value:b.objectiveSnapshot },
                { label:"In Scope",          value:b.scopeSnapshot     },
                { label:"Out of Scope",      value:b.outOfScopeSnapshot },
              ].map(s => s.value && (
                <div key={s.label} style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)",
                    textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>
                    {s.label}
                  </div>
                  <p style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.75, margin:0,
                    whiteSpace:"pre-line", background:"var(--surface)", padding:"10px 12px",
                    borderRadius:"var(--radius)" }}>
                    {s.value}
                  </p>
                </div>
              ))}
              <div style={{ textAlign:"right", marginTop:16 }}>
                <button onClick={() => setShowScopeOf(null)}
                  style={{ padding:"8px 18px", background:"var(--steel)", color:"#fff",
                    border:"none", borderRadius:"var(--radius)", fontSize:13,
                    cursor:"pointer", fontFamily:"var(--font)" }}>Close</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Header ── */}
      <div style={{ background:"var(--steel)", padding:"20px 24px", color:"#fff", flexShrink:0 }}>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Baseline Management</div>
        <div style={{ fontSize:13, opacity:.75, marginBottom:12 }}>
          PM Best Practices — Planning Performance Domain (§2.4) · {project?.name}
        </div>
        <div style={{ display:"flex", gap:20, fontSize:12 }}>
          <span>📸 {baselines.length} baseline{baselines.length!==1?"s":""} saved</span>
          <span style={{ color:"#86EFAC" }}>✓ {approvedBaselines.length} approved</span>
          <span style={{ color:"#FDE68A" }}>⏳ {workingBaselines.length} working</span>
        </div>
      </div>

      {/* ── PM Standard banner ── */}
      <div style={{ background:"#EFF6FF", borderBottom:"1px solid #BFDBFE",
        padding:"10px 20px", fontSize:12, color:"#1E40AF", flexShrink:0 }}>
        <strong>PM Best Practices — Three Formal Baselines:</strong> &nbsp;
        📅 <strong>Schedule Baseline</strong> (task dates + dependencies) &nbsp;·&nbsp;
        💰 <strong>Cost Baseline</strong> (budget by period) &nbsp;·&nbsp;
        📐 <strong>Scope Baseline</strong> (objective + scope + WBS) &nbsp;·&nbsp;
        Changes to any baseline require a formal Change Request.
      </div>

      {/* ── CR Re-baseline prompt ── */}
      {implementedCrs.length > 0 && (
        <div style={{ background:"#FFFBEB", borderBottom:"1px solid #FDE68A",
          padding:"12px 20px", flexShrink:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#92400E", marginBottom:8 }}>
            ⚠️ {implementedCrs.length} implemented Change Request{implementedCrs.length!==1?"s":""} without a re-baseline
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {implementedCrs.map(cr => (
              <div key={cr.id} style={{ background:"#fff", border:"1px solid #FDE68A",
                borderRadius:"var(--radius)", padding:"6px 12px", fontSize:12 }}>
                <span style={{ fontWeight:700, color:"#92400E" }}>{cr.code}</span>
                <span style={{ color:"#78350F", marginLeft:6 }}>{cr.title}</span>
                <button onClick={() => {
                  setLinkedCr(cr.id)
                  setNewName(`Re-baseline after ${cr.code} — ${new Date().toLocaleDateString("en-US", { timeZone:"UTC" })}`)
                  setShowSaveForm(true)
                }} style={{ marginLeft:10, fontSize:11, color:"var(--steel)",
                  background:"none", border:"none", cursor:"pointer",
                  fontFamily:"var(--font)", fontWeight:600 }}>
                  + Re-baseline →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex:1, padding:20, display:"flex", flexDirection:"column", gap:16 }}>

        {/* ── Save new baseline form ── */}
        {showSaveForm ? (
          <div style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text)", marginBottom:16 }}>
              📸 Save New Baseline
            </div>
            {error && (
              <div style={{ color:"var(--red)", fontSize:12, marginBottom:12 }}>✗ {error}</div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lbl}>Baseline name *</label>
                <input style={inp} value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Original Baseline — Approved Jun 30, 2026" />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lbl}>Description (optional)</label>
                <textarea rows={2} style={{...inp, resize:"vertical", lineHeight:1.6}}
                  value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder="Context for why this baseline was saved..." />
              </div>
              {linkedCr && (
                <div style={{ gridColumn:"1/-1", background:"#FFFBEB", padding:"8px 12px",
                  borderRadius:"var(--radius)", fontSize:12, color:"#92400E" }}>
                  🔗 Linked to Change Request: {(changeRequests||[]).find(c=>c.id===linkedCr)?.code}
                </div>
              )}
            </div>
            <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0",
              borderRadius:"var(--radius)", padding:"10px 14px", fontSize:12,
              color:"#065F46", marginBottom:16, lineHeight:1.6 }}>
              ✓ This will snapshot: all task dates + % complete, project start/end/budget,
              and the current scope/objective text. Save first, then approve to make it official.
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={saveBaseline} disabled={savingNew||!newName.trim()}
                style={{ padding:"9px 20px", background:"var(--steel)", color:"#fff",
                  border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                  cursor:"pointer", fontFamily:"var(--font)", opacity:!newName.trim()?0.5:1 }}>
                {savingNew ? "Saving…" : "📸 Save baseline"}
              </button>
              <button onClick={() => { setShowSaveForm(false); setError(""); setLinkedCr("") }}
                style={{ padding:"9px 18px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:13, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => { setShowSaveForm(true); setLinkedCr("") }}
              style={{ padding:"8px 16px", background:"var(--steel)", color:"#fff",
                border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                cursor:"pointer", fontFamily:"var(--font)" }}>
              📸 Save new baseline
            </button>
            {baselines.length >= 2 && (
              <button onClick={() => comparing
                ? setComparing(null)
                : setComparing([baselines[0].id, baselines[1].id])}
                style={{ padding:"8px 14px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:13, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>
                {comparing ? "Close compare" : "⚖ Compare baselines"}
              </button>
            )}
            {baselines.some(b => b.isApproved) && (
              <button onClick={() => setShowVsActual(v => !v)}
                style={{ padding:"8px 14px",
                  background: showVsActual ? "#EFF6FF" : "#fff",
                  border:`1px solid ${showVsActual ? "#BFDBFE" : "var(--border)"}`,
                  borderRadius:"var(--radius)", fontSize:13, cursor:"pointer",
                  fontFamily:"var(--font)", fontWeight: showVsActual ? 600 : 400,
                  color: showVsActual ? "#1B6CA8" : "var(--text-2)" }}>
                {showVsActual ? "Close vs Actual" : "📊 Baseline vs Actual"}
              </button>
            )}
          </div>
        )}

        {/* ── Baseline vs Actual (schedule variance) ── */}
        {showVsActual && (
          <div style={{ marginBottom:16 }}>
            <BaselineComparison baselines={baselines} tasks={tasks || []} />
          </div>
        )}

        {/* ── Comparison panel ── */}
        {comparing && compareA && compareB && (
          <div style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:14 }}>
              ⚖ Baseline Comparison
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:14 }}>
              <div>
                <label style={lbl}>Compare A</label>
                <select value={comparing[0]} onChange={e=>setComparing([e.target.value,comparing[1]])}
                  style={{...inp, cursor:"pointer"}}>
                  {baselines.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"center", paddingBottom:4 }}>
                <span style={{ fontSize:20, color:"var(--text-3)" }}>vs</span>
              </div>
              <div>
                <label style={lbl}>Compare B</label>
                <select value={comparing[1]} onChange={e=>setComparing([comparing[0],e.target.value])}
                  style={{...inp, cursor:"pointer"}}>
                  {baselines.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"var(--surface)" }}>
                  {["Metric","Baseline A","Baseline B","Variance"].map((h,i)=>(
                    <th key={i} style={{ padding:"9px 12px", textAlign:"left", fontSize:10,
                      fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                      letterSpacing:".05em", borderBottom:"1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label:"Start date",
                    a:fmtDate(compareA.startDate), b:fmtDate(compareB.startDate),
                    delta:daysDiff(compareA.startDate, compareB.startDate) },
                  { label:"End date",
                    a:fmtDate(compareA.endDate), b:fmtDate(compareB.endDate),
                    delta:daysDiff(compareA.endDate, compareB.endDate) },
                  { label:"Budget (BAC)",
                    a:fmtCurrency(Number(compareA.budgetTotal)),
                    b:fmtCurrency(Number(compareB.budgetTotal)),
                    delta:(()=>{
                      const diff=Number(compareB.budgetTotal)-Number(compareA.budgetTotal)
                      return (diff>=0?"+":"")+fmtCurrency(Math.abs(diff))
                    })() },
                  { label:"Task count",
                    a:compareA.snapshotData?.tasks?.length||"—",
                    b:compareB.snapshotData?.tasks?.length||"—",
                    delta:(()=>{
                      const diff=(compareB.snapshotData?.tasks?.length||0)-(compareA.snapshotData?.tasks?.length||0)
                      return diff===0?"No change":(diff>0?"+":"")+diff+" tasks"
                    })() },
                  { label:"Status",
                    a:compareA.isApproved?"✓ Approved":"⏳ Working",
                    b:compareB.isApproved?"✓ Approved":"⏳ Working",
                    delta:"—" },
                ].map(row => (
                  <tr key={row.label} style={{ borderBottom:"1px solid var(--surface-1,#F8FAFC)" }}>
                    <td style={{ padding:"9px 12px", fontSize:12, fontWeight:600, color:"var(--text-2)" }}>{row.label}</td>
                    <td style={{ padding:"9px 12px", fontSize:12, color:"var(--text)" }}>{row.a}</td>
                    <td style={{ padding:"9px 12px", fontSize:12, color:"var(--text)" }}>{row.b}</td>
                    <td style={{ padding:"9px 12px", fontSize:12, fontWeight:600,
                      color:String(row.delta).startsWith("+")||String(row.delta).includes("days")
                        ?"var(--amber)":"var(--text-3)" }}>
                      {row.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Approved baselines ── */}
        {approvedBaselines.length > 0 && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--green)",
              textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>
              ✓ Official Approved Baselines — Permanent Record
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {approvedBaselines.map(b => (
                <BaselineCard key={b.id} baseline={b}
                  onViewScope={() => setShowScopeOf(b.id)}
                  onApprove={null}
                  onDelete={null}
                  deletingId={deletingId} />
              ))}
            </div>
          </div>
        )}

        {/* ── Working baselines ── */}
        {workingBaselines.length > 0 && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--amber)",
              textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>
              ⏳ Working Baselines — Pending Approval
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {workingBaselines.map(b => (
                <BaselineCard key={b.id} baseline={b}
                  onViewScope={() => setShowScopeOf(b.id)}
                  onApprove={() => setApproveModal(b)}
                  onDelete={() => deleteBaseline(b.id)}
                  deletingId={deletingId} />
              ))}
            </div>
          </div>
        )}

        {baselines.length === 0 && !showSaveForm && (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>📸</div>
            <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>
              No baselines saved yet
            </div>
            <div style={{ fontSize:13, color:"var(--text-3)", maxWidth:480, margin:"0 auto 20px",
              lineHeight:1.7 }}>
              PM best practices require formal baselines before project execution begins.
              Save a baseline to freeze the current schedule, budget, and scope as the
              reference point for measuring performance and variance.
            </div>
            <button onClick={() => setShowSaveForm(true)}
              style={{ padding:"10px 20px", background:"var(--steel)", color:"#fff", border:"none",
                borderRadius:"var(--radius)", fontSize:13, fontWeight:500, cursor:"pointer",
                fontFamily:"var(--font)" }}>
              📸 Save first baseline
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Baseline Card ──────────────────────────────────────────────────────────

function BaselineCard({ baseline:b, onViewScope, onApprove, onDelete, deletingId }: {
  baseline:any; onViewScope:()=>void;
  onApprove:(()=>void)|null; onDelete:(()=>void)|null;
  deletingId:string|null
}) {
  const taskCount = b.snapshotData?.tasks?.length || 0

  return (
    <div style={{ background:"#fff", border:`1px solid ${b.isApproved?"#BBF7D0":"var(--border)"}`,
      borderRadius:"var(--radius)", padding:"16px 20px",
      borderLeft:`3px solid ${b.isApproved?"var(--green)":"var(--amber)"}` }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
            <span style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>{b.name}</span>
            {b.isApproved && (
              <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10,
                background:"#ECFDF5", color:"var(--green)" }}>✓ APPROVED</span>
            )}
            {!b.isApproved && (
              <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10,
                background:"#FFFBEB", color:"var(--amber)" }}>⏳ WORKING</span>
            )}
            {b.linkedCrId && (
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10,
                background:"#EFF6FF", color:"var(--steel)" }}>🔗 Re-baseline</span>
            )}
          </div>

          {/* Three baselines summary */}
          <div style={{ display:"flex", gap:16, fontSize:11, color:"var(--text-3)", flexWrap:"wrap" }}>
            <span>📅 {new Date(b.startDate).toLocaleDateString("en-US", {month:"short",day:"numeric", timeZone:"UTC" })} → {new Date(b.endDate).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric", timeZone:"UTC" })}</span>
            <span>💰 {b.budgetTotal ? `$${Number(b.budgetTotal).toLocaleString("en-US")}` : "—"}</span>
            <span>📋 {taskCount} tasks</span>
            <span>📐 Scope {b.scopeSnapshot ? "✓" : "—"}</span>
            <span>Saved {new Date(b.createdAt).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric", timeZone:"UTC" })}</span>
          </div>

          {b.description && (
            <p style={{ fontSize:12, color:"var(--text-3)", margin:"6px 0 0", lineHeight:1.5 }}>
              {b.description}
            </p>
          )}

          {/* Approval info */}
          {b.isApproved && b.approvedBy && (
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8,
              fontSize:11, color:"var(--green)" }}>
              <Avatar name={b.approvedBy.name} size={16} />
              Approved by {b.approvedBy.name} · {new Date(b.approvedAt).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric", timeZone:"UTC" })}
              {b.approvalNotes && <span style={{ color:"var(--text-3)" }}> · {b.approvalNotes}</span>}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:8, flexShrink:0, alignItems:"center" }}>
          {b.scopeSnapshot && (
            <button onClick={onViewScope}
              style={{ padding:"6px 12px", background:"#EFF6FF", border:"1px solid #BFDBFE",
                borderRadius:"var(--radius)", fontSize:11, cursor:"pointer",
                fontFamily:"var(--font)", color:"var(--steel)" }}>
              📐 View scope
            </button>
          )}
          {onApprove && (
            <button onClick={onApprove}
              style={{ padding:"6px 14px", background:"var(--green)", color:"#fff",
                border:"none", borderRadius:"var(--radius)", fontSize:11, fontWeight:600,
                cursor:"pointer", fontFamily:"var(--font)" }}>
              ✓ Approve
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} disabled={deletingId===b.id}
              style={{ padding:"6px 10px", background:"#FEF2F2", border:"1px solid #FECACA",
                borderRadius:"var(--radius)", fontSize:11, color:"var(--red)",
                cursor:"pointer", fontFamily:"var(--font)" }}>
              {deletingId===b.id ? "…" : "Delete"}
            </button>
          )}
          {b.isApproved && !onApprove && (
            <div style={{ fontSize:10, color:"var(--text-4)", fontStyle:"italic" }}>
              Locked · permanent record
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
