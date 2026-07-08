"use client"
// src/components/intake/IntakeView.tsx
import { useState } from "react"
import { useRouter } from "next/navigation"

type Item = {
  id:string; title:string; description:string; problem:string|null; expectedValue:string|null
  urgency:string; status:string; reviewNote:string|null; convertedProjectId:string|null
  createdAt:string; submittedBy:string; submittedById:string; reviewedBy:string|null; files?:{id:string;name:string;fileUrl:string;fileType:string}[]
}

const STATUS_CFG: Record<string,{label:string;color:string}> = {
  SUBMITTED:    { label:"Submitted",    color:"#64748B" },
  UNDER_REVIEW: { label:"Under review", color:"#1B6CA8" },
  APPROVED:     { label:"Approved",     color:"#059669" },
  REJECTED:     { label:"Rejected",     color:"#DC2626" },
  CONVERTED:    { label:"Converted",    color:"#7C3AED" },
}
const URGENCY_COLOR: Record<string,string> = { CRITICAL:"#DC2626", HIGH:"#EA580C", MEDIUM:"#2563EB", LOW:"#64748B" }
const empty = { title:"", description:"", problem:"", expectedValue:"", urgency:"MEDIUM" }

export function IntakeView({ items, currentUserId, canSubmit, canReview, canApprove, canConvert }: {
  items:Item[]; currentUserId:string; canSubmit:boolean; canReview:boolean; canApprove:boolean; canConvert:boolean
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>(empty)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [busy, setBusy] = useState("")
  const [err, setErr]   = useState("")
  const [expandedId, setExpanded] = useState<string|null>(null)

  async function submit() {
    if (!form.title.trim() || !form.description.trim()) { setErr("Title and description are required."); return }
    setBusy("submit"); setErr("")
    try {
      const res = await fetch("/api/intake", {
        method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErr(data.error || `Couldn't submit (server ${res.status}). If this persists, run: npx prisma generate`)
        return
      }
      const resp = await res.json().catch(() => ({}))
      const item = resp?.data?.item || resp?.item
      const failed: string[] = []
      if (item?.id) {
        for (const f of pendingFiles) {
          const fd = new FormData(); fd.append("file", f)
          try {
            const r = await fetch(`/api/intake/${item.id}/files`, { method:"POST", body: fd })
            if (!r.ok) { const d = await r.json().catch(() => ({})); failed.push(`${f.name} — server ${r.status}${d.error ? `: ${d.error}` : ""}`) }
          } catch { failed.push(`${f.name} — network error`) }
        }
      }
      setForm(empty); setPendingFiles([]); setShowForm(false); router.refresh()
      if (failed.length) {
        alert("The idea was saved, but the attachment(s) could not be uploaded:\n\n" + failed.join("\n") +
          "\n\nIf this says 'server 500', the intake_files table isn't ready — run MIGRATION-intake-files.sql, then `npx prisma generate` and restart the dev server.")
      }
    } finally { setBusy("") }
  }

  async function act(id:string, action:string) {
    if (action === "reject" && !confirm("Reject this idea?")) return
    if (action === "convert" && !confirm("Convert this idea into a new project?")) return
    setBusy(id+action)
    try {
      const res = await fetch(`/api/intake/${id}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        if (action === "convert" && data.projectId) { router.push(`/projects/${data.projectId}`); return }
        router.refresh()
      } else alert(data.error || "Action failed")
    } finally { setBusy("") }
  }

  const btn = (id:string, action:string, label:string, color:string) => (
    <button onClick={() => act(id, action)} disabled={busy===id+action}
      style={{ padding:"5px 12px", fontSize:12, fontWeight:600, borderRadius:"var(--radius)",
        border:`1px solid ${color}`, background:"#fff", color, cursor:"pointer", fontFamily:"var(--font)" }}>
      {busy===id+action ? "…" : label}
    </button>
  )

  return (
    <div style={{ padding:"28px 32px", maxWidth:960, margin:"0 auto", fontFamily:"var(--font)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
        <h1 style={{ fontSize:24, fontWeight:700, color:"var(--text-1)", margin:0 }}>Project Intake</h1>
        {canSubmit && (
          <button onClick={() => { setShowForm(s => !s); setErr("") }}
            style={{ padding:"8px 16px", background:"var(--steel)", color:"#fff", border:"none",
              borderRadius:"var(--radius)", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}>
            {showForm ? "Cancel" : "+ Submit an idea"}
          </button>
        )}
      </div>
      <p style={{ fontSize:13, color:"var(--text-3)", margin:"0 0 20px" }}>
        Submit project ideas and business needs for review and approval.
      </p>

      {showForm && canSubmit && (
        <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:16, marginBottom:20 }}>
          {err && <div style={{ color:"#DC2626", fontSize:12, marginBottom:8 }}>{err}</div>}
          <Field label="Title *">
            <input value={form.title} onChange={e => setForm({...form, title:e.target.value})}
              style={inp} placeholder="Short name for the idea" />
          </Field>
          <Field label="Description *">
            <textarea value={form.description} rows={3} onChange={e => setForm({...form, description:e.target.value})}
              style={{...inp, resize:"vertical"}} placeholder="What is being proposed?" />
          </Field>
          <Field label="Problem / opportunity">
            <textarea value={form.problem} rows={2} onChange={e => setForm({...form, problem:e.target.value})}
              style={{...inp, resize:"vertical"}} placeholder="What problem does it solve, or what's the opportunity?" />
          </Field>
          <div style={{ display:"flex", gap:12 }}>
            <Field label="Expected value">
              <input value={form.expectedValue} onChange={e => setForm({...form, expectedValue:e.target.value})}
                style={inp} placeholder="e.g. $200K/yr, 30% faster" />
            </Field>
            <Field label="Urgency">
              <select value={form.urgency} onChange={e => setForm({...form, urgency:e.target.value})} style={inp}>
                {["LOW","MEDIUM","HIGH","CRITICAL"].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>

          {/* Attachments (multi-file) */}
          <div style={{ marginBottom:10 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--text-3)",
              textTransform:"uppercase", letterSpacing:".04em", marginBottom:4 }}>Attachments (optional)</label>
            <input type="file" multiple
              onChange={e => setPendingFiles(Array.from(e.target.files || []))}
              style={{ fontSize:12, fontFamily:"var(--font)", color:"var(--text-2)" }} />
            {pendingFiles.length > 0 && (
              <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:6 }}>
                {pendingFiles.map((f,i) => (
                  <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 8px",
                    background:"var(--surface-1,#F1F5F9)", borderRadius:12, fontSize:11, color:"var(--text-2)" }}>
                    📎 {f.name}
                    <button onClick={() => setPendingFiles(fs => fs.filter((_,j) => j!==i))}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-4)", fontSize:12, padding:0 }}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ fontSize:10.5, color:"var(--text-4)", marginTop:4 }}>
              Proposals, specs, or cost estimates. These are attached to the idea for reviewers.
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
            <button onClick={submit} disabled={busy==="submit"}
              style={{ padding:"8px 18px", background:"var(--steel)", color:"#fff", border:"none",
                borderRadius:"var(--radius)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"var(--font)" }}>
              {busy==="submit" ? "Submitting…" : "Submit idea"}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)",
          padding:"48px 20px", textAlign:"center", color:"var(--text-3)", fontSize:14 }}>
          No ideas submitted yet.
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {items.map(it => {
            const sc = STATUS_CFG[it.status] || STATUS_CFG.SUBMITTED
            const expanded = expandedId === it.id
            return (
              <div key={it.id} style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:16 }}>
                  <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={() => setExpanded(expanded ? null : it.id)}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontSize:10, color:"var(--text-3)" }}>{expanded ? "▼" : "▶"}</span>
                      <span style={{ fontSize:15, fontWeight:600, color:"var(--text-1)" }}>{it.title}</span>
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10,
                        background:sc.color+"1A", color:sc.color }}>{sc.label}</span>
                      <span style={{ fontSize:10, fontWeight:700, color:URGENCY_COLOR[it.urgency]||"#64748B" }}>{it.urgency}</span>
                      {it.files && it.files.length > 0 && (
                        <span style={{ fontSize:11, color:"var(--steel)" }}>📎 {it.files.length}</span>
                      )}
                    </div>
                    {!expanded && (
                      <div style={{ fontSize:13, color:"var(--text-3)", overflow:"hidden", textOverflow:"ellipsis",
                        whiteSpace:"nowrap", marginBottom:4 }}>{it.description}</div>
                    )}
                    <div style={{ fontSize:11, color:"var(--text-4)" }}>
                      By {it.submittedBy}{it.reviewedBy && ` · Reviewed by ${it.reviewedBy}`}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
                    {canReview && it.status === "SUBMITTED" && btn(it.id, "review", "Start review", "#1B6CA8")}
                    {canApprove && it.submittedById !== currentUserId && ["SUBMITTED","UNDER_REVIEW"].includes(it.status) && btn(it.id, "approve", "Approve", "#059669")}
                    {canApprove && ["SUBMITTED","UNDER_REVIEW"].includes(it.status) && btn(it.id, "reject", "Reject", "#DC2626")}
                    {canConvert && it.submittedById !== currentUserId && it.status === "APPROVED" && btn(it.id, "convert", "Convert to project", "#7C3AED")}
                    {it.convertedProjectId && (
                      <a href={`/projects/${it.convertedProjectId}`} style={{ fontSize:12, color:"var(--steel)", textDecoration:"none" }}>Open project ↗</a>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div style={{ padding:"4px 16px 16px", borderTop:"1px solid var(--border)", background:"#F8FAFC" }}>
                    <DetailRow label="Description">{it.description}</DetailRow>
                    {it.problem && <DetailRow label="Problem / Opportunity">{it.problem}</DetailRow>}
                    {it.expectedValue && <DetailRow label="Expected value">{it.expectedValue}</DetailRow>}
                    <DetailRow label="Urgency">{it.urgency}</DetailRow>

                    <div style={{ marginTop:12 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                        letterSpacing:".04em", marginBottom:6 }}>Attachments</div>
                      {(!it.files || it.files.length === 0) ? (
                        <div style={{ fontSize:12, color:"var(--text-4)" }}>No documents attached.</div>
                      ) : it.files.map(fl => (
                        <div key={fl.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px",
                          background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)", marginBottom:6 }}>
                          <span style={{ fontSize:18 }}>📄</span>
                          <span style={{ flex:1, minWidth:0, fontSize:13, color:"var(--text-1)", overflow:"hidden",
                            textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fl.name}</span>
                          <a href={fl.fileUrl} target="_blank" rel="noopener noreferrer"
                            style={{ padding:"5px 10px", fontSize:12, borderRadius:"var(--radius)", border:"1px solid var(--border)",
                              background:"#fff", color:"var(--text-2)", textDecoration:"none" }}>👁 Preview</a>
                          <a href={fl.fileUrl} download={fl.name}
                            style={{ padding:"5px 10px", fontSize:12, borderRadius:"var(--radius)", border:"1px solid var(--border)",
                              background:"var(--surface)", color:"var(--text-2)", textDecoration:"none" }}>↓ Download</a>
                        </div>
                      ))}
                    </div>

                    {it.reviewNote && (
                      <div style={{ marginTop:12, fontSize:12, color:"var(--text-3)", fontStyle:"italic" }}>
                        <b style={{ fontStyle:"normal" }}>Review note:</b> “{it.reviewNote}”
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div style={{ marginTop:10 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".04em", marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:13, color:"var(--text-1)", whiteSpace:"pre-wrap", lineHeight:1.5 }}>{children}</div>
    </div>
  )
}

const inp: React.CSSProperties = {
  width:"100%", padding:"8px 10px", fontSize:13, borderRadius:"var(--radius)",
  border:"1px solid var(--border)", fontFamily:"var(--font)", color:"var(--text-1)", boxSizing:"border-box",
}
function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div style={{ flex:1, marginBottom:10 }}>
      <label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--text-3)",
        textTransform:"uppercase", letterSpacing:".04em", marginBottom:4 }}>{label}</label>
      {children}
    </div>
  )
}
