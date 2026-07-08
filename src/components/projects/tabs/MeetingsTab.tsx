"use client"
// src/components/projects/tabs/MeetingsTab.tsx
// Meeting Minutes — standalone tab view

import { useState } from "react"
import { useRouter } from "next/navigation"

const MTG_TYPES = ["KICKOFF","STATUS","PHASE_GATE","RISK_REVIEW","STEERING",
  "SPRINT_PLANNING","RETROSPECTIVE","AD_HOC","OTHER"]

const TYPE_COLORS: Record<string,string> = {
  KICKOFF:"#059669", STATUS:"#1B6CA8", PHASE_GATE:"#7C3AED",
  RISK_REVIEW:"#DC2626", STEERING:"#0E7490", SPRINT_PLANNING:"#F59E0B",
  RETROSPECTIVE:"#EC4899", AD_HOC:"#64748B", OTHER:"#94A3B8",
}

function fmtDate(d:any) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})
}

// Meeting-minutes fields (attendees/decisions/actionItems) may be a plain string
// OR a JSON array of objects. Normalize either shape into displayable text.
function toText(v:any): string {
  if (v == null) return ""
  if (typeof v === "string") return v
  if (Array.isArray(v)) {
    return v.map((item:any) => {
      if (item == null) return ""
      if (typeof item === "string") return item
      if (typeof item === "object") {
        if (item.name)     return item.role ? `${item.name} (${item.role})` : item.name
        if (item.decision) return item.owner ? `${item.decision} — ${item.owner}` : item.decision
        if (item.action)   return item.owner
          ? `${item.action} — ${item.owner}${item.dueDate ? ` (by ${item.dueDate})` : ""}`
          : item.action
        return Object.values(item).filter(Boolean).join(" — ")
      }
      return String(item)
    }).filter(Boolean).join("\n")
  }
  if (typeof v === "object") return Object.values(v).filter(Boolean).join(" — ")
  return String(v)
}

const inp: React.CSSProperties = {
  width:"100%", padding:"8px 12px", border:"1px solid var(--border)",
  borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
  color:"var(--text)", outline:"none",
}
const lbl: React.CSSProperties = {
  display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
  textTransform:"uppercase", letterSpacing:".05em", marginBottom:5,
}

export function MeetingsTab({ projectId, workspaceId, minutes, members }: {
  projectId:string; workspaceId:string; minutes:any[]; members:any[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string|null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    title:"", meetingDate:new Date().toISOString().split("T")[0],
    meetingType:"STATUS", attendees:"", agenda:"", discussion:"",
    decisions:"", actionItems:"", nextMeeting:"",
  })

  function resetForm() {
    setForm({ title:"", meetingDate:new Date().toISOString().split("T")[0],
      meetingType:"STATUS", attendees:"", agenda:"", discussion:"",
      decisions:"", actionItems:"", nextMeeting:"" })
  }

  async function save() {
    if (!form.title.trim()) { setError("Title required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/meeting-minutes`, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        setError(d.error||"Failed to save"); return
      }
      setShowForm(false); resetForm(); router.refresh()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Header */}
      <div style={{ background:"var(--steel)", padding:"12px 20px", color:"#fff",
        display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:700 }}>📝 Meeting Minutes</div>
          <div style={{ fontSize:11, opacity:.6, marginTop:2 }}>
            {minutes.length} meeting record{minutes.length!==1?"s":""}
          </div>
        </div>
        <button onClick={()=>{ setShowForm(s=>!s); setError("") }}
          style={{ padding:"7px 16px", background:"rgba(255,255,255,.15)", color:"#fff",
            border:"1px solid rgba(255,255,255,.3)", borderRadius:"var(--radius)",
            fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}>
          {showForm?"Cancel":"+ New minutes"}
        </button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:16 }}>

        {/* New minutes form */}
        {showForm && (
          <div style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:20, marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text)", marginBottom:14 }}>
              New Meeting Minutes
            </div>
            {error && (
              <div style={{ color:"var(--red)", fontSize:12, marginBottom:10 }}>✗ {error}</div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <div>
                <label style={lbl}>Meeting title *</label>
                <input style={inp} value={form.title}
                  onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                  placeholder="e.g. Sprint 4 Planning Meeting" />
              </div>
              <div>
                <label style={lbl}>Date</label>
                <input type="date" style={inp} value={form.meetingDate}
                  onChange={e=>setForm(f=>({...f,meetingDate:e.target.value}))} />
              </div>
              <div>
                <label style={lbl}>Type</label>
                <select style={{...inp,cursor:"pointer"}} value={form.meetingType}
                  onChange={e=>setForm(f=>({...f,meetingType:e.target.value}))}>
                  {MTG_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={lbl}>Attendees</label>
              <input style={inp} value={form.attendees}
                onChange={e=>setForm(f=>({...f,attendees:e.target.value}))}
                placeholder="Names and roles of attendees" />
            </div>
            {[
              { key:"agenda",      label:"Agenda" },
              { key:"discussion",  label:"Discussion / Notes" },
              { key:"decisions",   label:"Decisions Made" },
              { key:"actionItems", label:"Action Items (who / what / by when)" },
            ].map(({key,label}) => (
              <div key={key} style={{ marginBottom:10 }}>
                <label style={lbl}>{label}</label>
                <textarea rows={3} style={{...inp,resize:"vertical",lineHeight:1.6}}
                  value={(form as any)[key]}
                  onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                  placeholder={`${label}...`} />
              </div>
            ))}
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Next meeting date</label>
              <input type="date" style={{...inp,width:"auto"}} value={form.nextMeeting}
                onChange={e=>setForm(f=>({...f,nextMeeting:e.target.value}))} />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={save} disabled={saving||!form.title.trim()}
                style={{ padding:"9px 20px", background:"var(--steel)", color:"#fff",
                  border:"none", borderRadius:"var(--radius)", fontSize:12, fontWeight:500,
                  cursor:"pointer", fontFamily:"var(--font)",
                  opacity:!form.title.trim()?0.5:1 }}>
                {saving?"Saving…":"Save minutes"}
              </button>
              <button onClick={()=>{setShowForm(false);resetForm();setError("")}}
                style={{ padding:"9px 16px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Minutes list */}
        {minutes.length === 0 && !showForm ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>📝</div>
            <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>
              No meeting minutes yet
            </div>
            <div style={{ fontSize:13, color:"var(--text-3)", maxWidth:400, margin:"0 auto 20px", lineHeight:1.7 }}>
              Record meeting decisions, action items, and discussion notes to maintain a formal project record.
            </div>
            <button onClick={()=>setShowForm(true)}
              style={{ padding:"10px 20px", background:"var(--steel)", color:"#fff",
                border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                cursor:"pointer", fontFamily:"var(--font)" }}>
              + Record first meeting
            </button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {minutes.map(m => {
              const typeColor = TYPE_COLORS[m.meetingType||"OTHER"] || "#64748B"
              const isOpen = expanded === m.id
              return (
                <div key={m.id} style={{ background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", overflow:"hidden",
                  borderLeft:`3px solid ${typeColor}` }}>
                  {/* Header */}
                  <div onClick={()=>setExpanded(isOpen?null:m.id)}
                    style={{ padding:"12px 16px", display:"flex", alignItems:"center",
                      gap:12, cursor:"pointer" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>
                          {m.title}
                        </span>
                        <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px",
                          borderRadius:8, background:typeColor+"15", color:typeColor }}>
                          {(m.meetingType||"OTHER").replace(/_/g," ")}
                        </span>
                      </div>
                      <div style={{ fontSize:11, color:"var(--text-3)", display:"flex", gap:12 }}>
                        <span>📅 {fmtDate(m.meetingDate)}</span>
                        {(() => { const att = toText(m.attendees); return att
                          ? <span>👥 {att.slice(0,50)}{att.length>50?"…":""}</span>
                          : null })()}
                      </div>
                    </div>
                    <span style={{ color:"var(--text-4)", fontSize:12,
                      transform:isOpen?"rotate(0)":"rotate(-90deg)",
                      display:"inline-block", transition:"transform .15s" }}>▼</span>
                  </div>

                  {/* Expanded content */}
                  {isOpen && (
                    <div style={{ borderTop:"1px solid var(--border)", padding:"14px 16px",
                      background:"var(--surface)" }}>
                      {[
                        { label:"Agenda",       value:toText(m.agenda)      },
                        { label:"Discussion",   value:toText(m.discussion)  },
                        { label:"Decisions",    value:toText(m.decisions)   },
                        { label:"Action Items", value:toText(m.actionItems) },
                      ].filter(s=>s.value).map(s=>(
                        <div key={s.label} style={{ marginBottom:12 }}>
                          <div style={{ fontSize:10, fontWeight:700, color:"var(--text-4)",
                            textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>
                            {s.label}
                          </div>
                          <p style={{ fontSize:12, color:"var(--text-2)", margin:0,
                            lineHeight:1.6, whiteSpace:"pre-line" }}>{s.value}</p>
                        </div>
                      ))}
                      {m.nextMeeting && (
                        <div style={{ fontSize:11, color:"var(--steel)", fontWeight:600, marginTop:8 }}>
                          📅 Next meeting: {fmtDate(m.nextMeeting)}
                        </div>
                      )}
                      {m.createdBy && (
                        <div style={{ fontSize:10, color:"var(--text-4)", marginTop:10 }}>
                          Recorded by {m.createdBy.name}
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
    </div>
  )
}
