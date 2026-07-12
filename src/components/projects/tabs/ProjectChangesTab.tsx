"use client"
// src/components/projects/tabs/ProjectChangesTab.tsx
// Change Request management — submit, review, approve/reject, implement

import { useState } from "react"
import { usePermissions } from "@/lib/rbac/usePermissions"
import { useRouter } from "next/navigation"
import { AIScanPanel } from "@/components/shared/AIScanPanel"
import { Avatar, Badge } from "@/components/ui"

const STATUS_CONFIG: Record<string, { label:string; color:string; bg:string }> = {
  DRAFT:        { label:"Draft",        color:"#64748B", bg:"#F1F5F9" },
  SUBMITTED:    { label:"Submitted",    color:"#1B6CA8", bg:"#EFF6FF" },
  UNDER_REVIEW: { label:"Under Review", color:"#F59E0B", bg:"#FFFBEB" },
  APPROVED:     { label:"Approved",     color:"#059669", bg:"#ECFDF5" },
  REJECTED:     { label:"Rejected",     color:"#DC2626", bg:"#FEF2F2" },
  IMPLEMENTED:  { label:"Implemented",  color:"#7C3AED", bg:"#F5F3FF" },
}

const PRIORITY_CONFIG: Record<string, { color:string; label:string }> = {
  CRITICAL: { color:"#DC2626", label:"Critical" },
  HIGH:     { color:"#F59E0B", label:"High"     },
  MEDIUM:   { color:"#1B6CA8", label:"Medium"   },
  LOW:      { color:"#64748B", label:"Low"       },
}

const CATEGORIES = ["SCOPE","SCHEDULE","BUDGET","RESOURCE","QUALITY","OTHER"]

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric", timeZone:"UTC" })
}

function StatusBadge({ status }: { status: string }) {
  const { can } = usePermissions()
  const cfg = STATUS_CONFIG[status] || { label:status, color:"#64748B", bg:"#F1F5F9" }
  return (
    <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600,
      color:cfg.color, background:cfg.bg }}>
      {cfg.label}
    </span>
  )
}

export function ProjectChangesTab({ projectId, workspaceId, changeRequests, members, currentUserId }: {
  projectId: string; workspaceId: string; changeRequests: any[];
  members: any[]; currentUserId: string
}) {
  const router = useRouter()
  const { can } = usePermissions()
  const [view, setView] = useState<"list"|"create"|"detail">("list")
  const [selected, setSelected] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [rejecting, setRejecting] = useState(false)
  const [rejectedReason, setRejectedReason] = useState("")

  const [form, setForm] = useState({
    title:"", description:"", category:"SCOPE", priority:"MEDIUM",
    scheduleImpact:"", budgetImpact:"", scopeImpact:"", qualityImpact:"",
  })

  const inp: React.CSSProperties = {
    width:"100%", padding:"9px 12px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    color:"var(--text)", outline:"none",
  }
  const lbl: React.CSSProperties = {
    display:"block", fontSize:11, fontWeight:600, color:"var(--text-2)",
    marginBottom:5, textTransform:"uppercase", letterSpacing:".04em",
  }
  const card: React.CSSProperties = {
    background:"#fff", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", padding:18, marginBottom:14,
  }

  async function submitCR() {
    if (!form.title.trim()) { setError("Title is required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/change-requests`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-workspace-id":workspaceId },
        body: JSON.stringify({
          ...form,
          budgetImpact: form.budgetImpact ? Number(form.budgetImpact) : null,
          scheduleImpact: form.scheduleImpact || null,
          scopeImpact: form.scopeImpact || null,
          qualityImpact: form.qualityImpact || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || "Failed to submit change request")
        return
      }
      router.refresh()
      setView("list")
      setForm({ title:"", description:"", category:"SCOPE", priority:"MEDIUM",
        scheduleImpact:"", budgetImpact:"", scopeImpact:"", qualityImpact:"" })
    } catch { setError("Network error") }
    finally { setSaving(false) }
  }

  async function updateStatus(crId: string, status: string, extra?: any) {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/change-requests/${crId}`, {
        method:"PATCH",
        headers:{ "Content-Type":"application/json", "x-workspace-id":workspaceId },
        body: JSON.stringify({ status, ...extra }),
      })
      if (res.ok) {
        router.refresh()
        const updated = await res.json()
        setSelected(updated.data || updated)
      }
    } finally { setSaving(false) }
  }

  const filtered = changeRequests.filter(cr =>
    !statusFilter || cr.status === statusFilter
  )

  const counts = {
    submitted:    changeRequests.filter(c => c.status === "SUBMITTED").length,
    under_review: changeRequests.filter(c => c.status === "UNDER_REVIEW").length,
    approved:     changeRequests.filter(c => c.status === "APPROVED").length,
  }

  // ── CREATE FORM ─────────────────────────────────────
  if (view === "create") {
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
        <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
          padding:"12px 20px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <button onClick={() => setView("list")}
            style={{ fontSize:12, color:"var(--text-3)", background:"none", border:"none",
              cursor:"pointer", fontFamily:"var(--font)" }}>← Change Requests</button>
          <span style={{ color:"var(--border)" }}>›</span>
          <span style={{ fontSize:14, fontWeight:600, color:"var(--text)" }}>New Change Request</span>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:20 }}>
          <div style={{ maxWidth:720, margin:"0 auto" }}>
            {error && (
              <div style={{ background:"#FEF2F2", border:"1px solid #FECACA",
                color:"var(--red)", padding:"10px 14px", borderRadius:"var(--radius)",
                fontSize:13, marginBottom:16 }}>✗ {error}</div>
            )}
            <div style={card}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:14 }}>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={lbl}>Title *</label>
                  <input style={inp} value={form.title} placeholder="Brief description of the change"
                    onChange={e => setForm(f => ({...f, title:e.target.value}))} />
                </div>
                <div>
                  <label style={lbl}>Category</label>
                  <select style={{...inp, cursor:"pointer"}} value={form.category}
                    onChange={e => setForm(f => ({...f, category:e.target.value}))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0)+c.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Priority</label>
                  <select style={{...inp, cursor:"pointer",
                    color:PRIORITY_CONFIG[form.priority]?.color, fontWeight:600}}
                    value={form.priority}
                    onChange={e => setForm(f => ({...f, priority:e.target.value}))}>
                    {Object.entries(PRIORITY_CONFIG).map(([v,c]) =>
                      <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={lbl}>Description</label>
                <textarea rows={4} style={{...inp, resize:"vertical", lineHeight:1.65}}
                  value={form.description}
                  placeholder="Describe what change is being requested and why it is needed..."
                  onChange={e => setForm(f => ({...f, description:e.target.value}))} />
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:12 }}>
                Impact Assessment
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <div style={card}>
                  <label style={lbl}>📅 Schedule impact</label>
                  <input style={inp} value={form.scheduleImpact}
                    placeholder="e.g. +2 weeks, No impact"
                    onChange={e => setForm(f => ({...f, scheduleImpact:e.target.value}))} />
                </div>
                <div style={card}>
                  <label style={lbl}>💰 Budget impact ($)</label>
                  <input type="number" style={inp} value={form.budgetImpact}
                    placeholder="e.g. 15000 or -5000"
                    onChange={e => setForm(f => ({...f, budgetImpact:e.target.value}))} />
                </div>
                <div style={card}>
                  <label style={lbl}>📐 Scope impact</label>
                  <textarea rows={3} style={{...inp, resize:"vertical"}}
                    value={form.scopeImpact}
                    placeholder="What is added, removed, or changed in scope?"
                    onChange={e => setForm(f => ({...f, scopeImpact:e.target.value}))} />
                </div>
                <div style={card}>
                  <label style={lbl}>⭐ Quality impact</label>
                  <textarea rows={3} style={{...inp, resize:"vertical"}}
                    value={form.qualityImpact}
                    placeholder="How does this affect quality, deliverables, or acceptance criteria?"
                    onChange={e => setForm(f => ({...f, qualityImpact:e.target.value}))} />
                </div>
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button onClick={() => setView("list")}
                style={{ padding:"10px 20px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:13, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>
                Cancel
              </button>
              <button onClick={submitCR} disabled={saving || !form.title.trim()}
                style={{ padding:"10px 24px", background:"var(--steel)", color:"#fff", border:"none",
                  borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                  cursor:saving?"wait":"pointer", fontFamily:"var(--font)",
                  opacity:!form.title.trim()?0.5:1 }}>
                {saving ? "Submitting…" : "Submit Change Request"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── DETAIL VIEW ─────────────────────────────────────
  if (view === "detail" && selected) {
    const cr = selected
    const cfg = STATUS_CONFIG[cr.status] || STATUS_CONFIG.DRAFT
    const canApprove = ["SUBMITTED","UNDER_REVIEW"].includes(cr.status)
    const canImplement = cr.status === "APPROVED"

    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
        <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
          padding:"12px 20px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <button onClick={() => { setView("list"); setSelected(null); setRejecting(false) }}
            style={{ fontSize:12, color:"var(--text-3)", background:"none", border:"none",
              cursor:"pointer", fontFamily:"var(--font)" }}>
            ← Change Requests
          </button>
          <span style={{ color:"var(--border)" }}>›</span>
          <span style={{ fontSize:14, fontWeight:600, color:"var(--text)" }}>{cr.code}</span>
          <StatusBadge status={cr.status} />
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
            {cr.status === "SUBMITTED" && (
              <button onClick={() => updateStatus(cr.id, "UNDER_REVIEW")} disabled={saving}
                style={{ padding:"7px 14px", background:"#FFFBEB", border:"1px solid #FDE68A",
                  borderRadius:"var(--radius)", fontSize:12, fontWeight:500, cursor:"pointer",
                  fontFamily:"var(--font)", color:"#92400E" }}>
                Mark Under Review
              </button>
            )}
            {canApprove && !rejecting && (
              <>
                <button onClick={() => setRejecting(true)} disabled={saving}
                  style={{ padding:"7px 14px", background:"#FEF2F2", border:"1px solid #FECACA",
                    borderRadius:"var(--radius)", fontSize:12, fontWeight:500, cursor:"pointer",
                    fontFamily:"var(--font)", color:"var(--red)" }}>
                  Reject
                </button>
                <button onClick={() => updateStatus(cr.id, "APPROVED")} disabled={saving}
                  style={{ padding:"7px 14px", background:"var(--green)", color:"#fff", border:"none",
                    borderRadius:"var(--radius)", fontSize:12, fontWeight:500,
                    cursor:"pointer", fontFamily:"var(--font)" }}>
                  {saving ? "Saving…" : "✓ Approve"}
                </button>
              </>
            )}
            {canImplement && (
              <button onClick={() => updateStatus(cr.id, "IMPLEMENTED")} disabled={saving}
                style={{ padding:"7px 14px", background:"#7C3AED", color:"#fff", border:"none",
                  borderRadius:"var(--radius)", fontSize:12, fontWeight:500,
                  cursor:"pointer", fontFamily:"var(--font)" }}>
                Mark Implemented
              </button>
            )}
          </div>
        </div>

        {rejecting && (
          <div style={{ background:"#FEF2F2", borderBottom:"1px solid #FECACA", padding:"12px 20px" }}>
            <div style={{ fontSize:12, fontWeight:600, color:"var(--red)", marginBottom:8 }}>
              Rejection reason (required)
            </div>
            <textarea rows={2} value={rejectedReason}
              onChange={e => setRejectedReason(e.target.value)}
              placeholder="Explain why this change request is being rejected..."
              style={{...inp, marginBottom:8}} />
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => {
                if (!rejectedReason.trim()) return
                updateStatus(cr.id, "REJECTED", { rejectedReason })
                setRejecting(false)
              }} disabled={!rejectedReason.trim() || saving}
                style={{ padding:"7px 14px", background:"var(--red)", color:"#fff", border:"none",
                  borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                  fontFamily:"var(--font)", opacity:!rejectedReason.trim()?0.5:1 }}>
                Confirm Rejection
              </button>
              <button onClick={() => setRejecting(false)}
                style={{ padding:"7px 12px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ flex:1, overflowY:"auto", padding:24, background:"var(--surface)" }}>
          <div style={{ maxWidth:760, margin:"0 auto", background:"#fff",
            border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"28px 32px" }}>

            {/* Header */}
            <div style={{ borderBottom:`3px solid ${cfg.color}`, paddingBottom:16, marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--text-3)",
                    textTransform:"uppercase", letterSpacing:".08em", marginBottom:4 }}>
                    Change Request · {cr.code}
                  </div>
                  <h2 style={{ fontSize:20, fontWeight:700, color:"var(--text)", margin:"0 0 6px" }}>
                    {cr.title}
                  </h2>
                  <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                    <StatusBadge status={cr.status} />
                    <span style={{ fontSize:11, fontWeight:600,
                      color:PRIORITY_CONFIG[cr.priority]?.color }}>
                      {PRIORITY_CONFIG[cr.priority]?.label} priority
                    </span>
                    <span style={{ fontSize:11, color:"var(--text-3)" }}>
                      {(cr.category||"General").charAt(0)+(cr.category||"General").slice(1).toLowerCase()} change
                    </span>
                  </div>
                </div>
                <div style={{ textAlign:"right", fontSize:11, color:"var(--text-3)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end", marginBottom:4 }}>
                    <Avatar name={cr.requestedBy?.name} avatarUrl={cr.requestedBy?.avatarUrl} size={18} />
                    <span>{cr.requestedBy?.name}</span>
                  </div>
                  <div>Submitted {fmtDate(cr.createdAt)}</div>
                  {cr.approvedBy && (
                    <div style={{ marginTop:4 }}>
                      Approved by {cr.approvedBy.name} · {fmtDate(cr.approvedAt)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {cr.description && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--text-3)",
                  textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>
                  Description
                </div>
                <p style={{ fontSize:13, lineHeight:1.75, color:"var(--text-2)", margin:0,
                  whiteSpace:"pre-line" }}>
                  {cr.description}
                </p>
              </div>
            )}

            {/* Impact grid */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14, marginBottom:20 }}>
              {[
                { icon:"📅", label:"Schedule impact", value:cr.scheduleImpact },
                { icon:"💰", label:"Budget impact",   value:cr.budgetImpact != null
                  ? `${cr.budgetImpact >= 0 ? "+" : ""}$${Math.abs(cr.budgetImpact).toLocaleString("en-US")}` : null },
                { icon:"📐", label:"Scope impact",    value:cr.scopeImpact },
                { icon:"⭐", label:"Quality impact",  value:cr.qualityImpact },
              ].map(item => item.value && (
                <div key={item.label} style={{ background:"var(--surface)", borderRadius:"var(--radius)",
                  padding:"12px 14px" }}>
                  <div style={{ fontSize:11, fontWeight:600, color:"var(--text-3)",
                    textTransform:"uppercase", letterSpacing:".05em", marginBottom:5 }}>
                    {item.icon} {item.label}
                  </div>
                  <div style={{ fontSize:13, color:"var(--text-2)", whiteSpace:"pre-line" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Rejection reason */}
            {cr.status === "REJECTED" && cr.rejectedReason && (
              <div style={{ background:"#FEF2F2", border:"1px solid #FECACA",
                borderRadius:"var(--radius)", padding:"12px 14px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--red)",
                  textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>
                  Rejection Reason
                </div>
                <p style={{ fontSize:13, color:"#991B1B", margin:0, lineHeight:1.7 }}>
                  {cr.rejectedReason}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between",
        flexShrink:0 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:600, color:"var(--text)" }}>Change Requests</div>
          <div style={{ fontSize:12, color:"var(--text-3)" }}>{changeRequests.length} total</div>
        </div>
        {can("changes:create") && (
        <div style={{ display:"flex", gap:8 }}>
        <button onClick={() => setView("create")}
          style={{ padding:"8px 16px", background:"var(--steel)", color:"#fff", border:"none",
            borderRadius:"var(--radius)", fontSize:13, fontWeight:500, cursor:"pointer",
            fontFamily:"var(--font)" }}>
          + New Change Request
        </button>
        <AIScanPanel projectId={projectId} workspaceId={workspaceId} domain="changes"
          commitLabel="as change requests"
          renderCandidate={(c: any) => (
            <div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{c.title}</span>
                <span style={{ fontSize:10, color:"var(--text-3)" }}>{c.priority}</span>
              </div>
              {c.description && <div style={{ fontSize:12, color:"var(--text-2)", lineHeight:1.5 }}>{c.description}</div>}
              {c.justification && <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>Why: {c.justification}</div>}
            </div>
          )}
          commit={async (chosen: any[]) => {
            const rs = await Promise.all(chosen.map(c => fetch(`/api/projects/${projectId}/change-requests`, {
              method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
              body: JSON.stringify({
                title: String(c.title||"").slice(0,200),
                description: String(c.description||"").slice(0,5000) || null,
                priority: ["CRITICAL","HIGH","MEDIUM","LOW"].includes(c.priority) ? c.priority : "MEDIUM",
                justification: String(c.justification||"").slice(0,3000) || null,
              }),
            })))
            return rs.filter(r => !r.ok).length
          }} />
          </div>
        )}
      </div>

      {/* Status summary strip */}
      {changeRequests.length > 0 && (
        <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)",
          padding:"10px 20px", display:"flex", gap:16 }}>
          {[
            { label:"Awaiting review", count:counts.submitted,    color:"#1B6CA8" },
            { label:"Under review",    count:counts.under_review, color:"#F59E0B" },
            { label:"Approved",        count:counts.approved,     color:"#059669" },
          ].map(s => (
            <div key={s.label} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.count}</span>
              <span style={{ fontSize:11, color:"var(--text-3)" }}>{s.label}</span>
            </div>
          ))}
          <div style={{ marginLeft:"auto" }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding:"5px 10px", border:"1px solid var(--border)",
                borderRadius:"var(--radius)", fontSize:12, fontFamily:"var(--font)",
                color:"var(--text-2)", cursor:"pointer" }}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_CONFIG).map(([v,c]) =>
                <option key={v} value={v}>{c.label}</option>)}
            </select>
          </div>
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", padding:20 }}>
        {changeRequests.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🔄</div>
            <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>
              No change requests yet
            </div>
            <div style={{ fontSize:13, color:"var(--text-3)", marginBottom:20, maxWidth:380, margin:"0 auto 20px" }}>
              All project changes should go through a formal change request process.
              Nothing changes without approval.
            </div>
            <button onClick={() => setView("create")}
              style={{ padding:"10px 20px", background:"var(--steel)", color:"#fff", border:"none",
                borderRadius:"var(--radius)", fontSize:13, fontWeight:500, cursor:"pointer",
                fontFamily:"var(--font)" }}>
              Submit first change request
            </button>
          </div>
        ) : (
          <div style={{ maxWidth:800, margin:"0 auto", display:"flex", flexDirection:"column", gap:8 }}>
            {filtered.map(cr => {
              const cfg = STATUS_CONFIG[cr.status] || STATUS_CONFIG.DRAFT
              const pc  = PRIORITY_CONFIG[cr.priority]
              return (
                <div key={cr.id} onClick={() => { setSelected(cr); setView("detail") }}
                  style={{ background:"#fff", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", padding:"14px 18px", cursor:"pointer",
                    display:"flex", alignItems:"center", gap:14 }}
                  onMouseOver={e => (e.currentTarget.style.boxShadow="var(--shadow-md)")}
                  onMouseOut={e  => (e.currentTarget.style.boxShadow="none")}>
                  <div style={{ width:3, alignSelf:"stretch", borderRadius:2,
                    background:cfg.color, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:"var(--text-3)" }}>
                        {cr.code}
                      </span>
                      <StatusBadge status={cr.status} />
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px",
                        borderRadius:4, color:pc?.color, background:`${pc?.color}14` }}>
                        {pc?.label}
                      </span>
                      <span style={{ fontSize:11, color:"var(--text-3)" }}>
                        {(cr.category||'').charAt(0)+(cr.category||'').slice(1).toLowerCase()}
                      </span>
                    </div>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {cr.title}
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10,
                    flexShrink:0, fontSize:11, color:"var(--text-3)" }}>
                    {cr.requestedBy && (
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <Avatar name={cr.requestedBy.name} avatarUrl={cr.requestedBy.avatarUrl} size={18} />
                        <span>{cr.requestedBy.name}</span>
                      </div>
                    )}
                    <span>{fmtDate(cr.createdAt)}</span>
                    <span style={{ color:"var(--steel)" }}>View →</span>
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
