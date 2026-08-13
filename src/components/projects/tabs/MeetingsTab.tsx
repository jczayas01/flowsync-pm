"use client"
// src/components/projects/tabs/MeetingsTab.tsx
// Meeting Minutes — standalone tab view

import { DateField } from "@/components/shared/DatePicker"
import { dateLocale } from "@/lib/date-locale"
import { AIScanPanel } from "@/components/shared/AIScanPanel"
import { useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { enumLabel } from "@/lib/enum-labels"
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
  return new Date(d).toLocaleDateString(dateLocale(), {weekday:"short",month:"short",day:"numeric",year:"numeric", timeZone:"UTC" })
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
  const mt = useTranslations("meetingsTab")
  const locale = useLocale()
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string|null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    title:"", meetingDate:new Date().toISOString().split("T")[0],
    meetingType:"STATUS", location:"", facilitator:"", attendees:"",
    agenda:"", discussion:"", decisions:"", actionItems:"", nextMeeting:"",
    status:"DRAFT",
  })

  function resetForm() {
    setForm({ title:"", meetingDate:new Date().toISOString().split("T")[0],
      meetingType:"STATUS", location:"", facilitator:"", attendees:"",
      agenda:"", discussion:"", decisions:"", actionItems:"", nextMeeting:"",
      status:"DRAFT" })
  }

  const [editId, setEditId] = useState<string|null>(null)
  const [editF, setEditF]   = useState<any>({})

  function openEdit(m2: any) {
    setEditF({
      title: m2.title || "",
      meetingDate: m2.meetingDate ? new Date(m2.meetingDate).toISOString().slice(0,10) : "",
      meetingType: m2.meetingType || "STATUS",
      facilitator: m2.facilitator || "",
      attendees:   toText(m2.attendees) || "",
      agenda:      toText(m2.agenda) || "",
      discussion:  toText(m2.discussion) || "",
      decisions:   toText(m2.decisions) || "",
      actionItems: toText(m2.actionItems) || "",
      location:    m2.location || "",
      nextMeeting: m2.nextMeeting ? new Date(m2.nextMeeting).toISOString().slice(0,10) : "",
      status:      m2.status || "DRAFT",
    })
    setEditId(m2.id)
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/projects/${projectId}/meeting-minutes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editF.title,
        meetingDate: editF.meetingDate ? new Date(`${editF.meetingDate}T12:00:00Z`).toISOString() : undefined,
        meetingType: editF.meetingType,
        facilitator: editF.facilitator || null,
        attendees:   editF.attendees || [],
        agenda:      editF.agenda || null,
        discussion:  editF.discussion || null,
        decisions:   editF.decisions || [],
        actionItems: editF.actionItems || [],
        location:    editF.location || null,
        nextMeeting: editF.nextMeeting ? new Date(`${editF.nextMeeting}T12:00:00Z`).toISOString() : null,
        status:      editF.status || "DRAFT",
      }),
    }).catch(() => null)
    if (res?.ok) { setEditId(null); router.refresh() }
    else {
      const d = await res?.json().catch(() => null)
      alert(d?.error || mt("saveFailed"))
    }
  }

  async function removeMinutes(m2: any) {
    if (!confirm(mt("confirmDelete",{t:m2.title}))) return
    const res = await fetch(`/api/projects/${projectId}/meeting-minutes/${m2.id}`, { method: "DELETE" })
      .catch(() => null)
    if (res?.ok) router.refresh()
    else alert(mt("deleteFailed"))
  }

  async function save() {
    if (!form.title.trim()) { setError(mt("Title required")); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/meeting-minutes`, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        setError(d.error||mt("Failed to save")); return
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
          <div style={{ fontSize:16, fontWeight:700 }}>📝 {mt("Meeting Minutes")}</div>
          <div style={{ fontSize:11, opacity:.6, marginTop:2 }}>
            {mt("recordCount",{n:minutes.length})}
          </div>
        </div>
        <AIScanPanel projectId={projectId} workspaceId={workspaceId} domain="meetings"
          commitLabel={mt("to the meeting record")}
          renderCandidate={(c:any)=>(
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{c.title}</div>
              <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>
                {c.meetingDate || mt("no date")}{c.facilitator ? ` · ${c.facilitator}` : ""}
                {Array.isArray(c.attendees) && c.attendees.length ? ` · ${mt("attendeeCount",{n:c.attendees.length})}` : ""}
              </div>
              {Array.isArray(c.decisions) && c.decisions.length > 0 && (
                <div style={{ fontSize:11.5, color:"var(--text-3)", marginTop:3 }}>
                  ⚡ {mt("decisionCount",{n:c.decisions.length})}
                  {Array.isArray(c.actionItems) && c.actionItems.length ? ` · ✓ ${mt("actionItemCount",{n:c.actionItems.length})}` : ""}
                </div>
              )}
              {c.evidence && (
                <div style={{ fontSize:11, color:"var(--text-4)", fontStyle:"italic", marginTop:4 }}>
                  "{c.evidence}" — {c.sourceDoc}
                </div>
              )}
            </div>
          )}
          commit={async (chosen:any[]) => {
            const rs = await Promise.all(chosen.map(c => fetch(`/api/projects/${projectId}/meeting-minutes`, {
              method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
              body: JSON.stringify({
                title: String(c.title || "Meeting").slice(0,300),
                meetingDate: c.meetingDate ? new Date(`${c.meetingDate}T12:00:00Z`).toISOString() : new Date().toISOString(),
                meetingType: c.meetingType || "STATUS",
                attendees: Array.isArray(c.attendees) ? c.attendees.join(", ") : (c.attendees || null),
                agenda: c.agenda || null,
                discussion: c.discussion || null,
                decisions: Array.isArray(c.decisions) ? c.decisions.join("\n") : (c.decisions || null),
                actionItems: Array.isArray(c.actionItems) ? c.actionItems : [],
              }),
            }).catch(() => null)))
            return rs.filter(r => !r?.ok).length
          }} />
        <button onClick={()=>{ setShowForm(s=>!s); setError("") }}
          style={{ padding:"7px 16px", background:"rgba(255,255,255,.15)", color:"#fff",
            border:"1px solid rgba(255,255,255,.3)", borderRadius:"var(--radius)",
            fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}>
          {showForm?mt("Cancel"):mt("+ New minutes")}
        </button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:16 }}>

        {/* New minutes form */}
        {showForm && (
          <div style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:20, marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text)", marginBottom:14 }}>
              {mt("New Meeting Minutes")}
            </div>
            {error && (
              <div style={{ color:"var(--red)", fontSize:12, marginBottom:10 }}>✗ {error}</div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <div>
                <label style={lbl}>{mt("Meeting title *")}</label>
                <input style={inp} value={form.title}
                  onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                  placeholder={mt("phMeetingTitle")} />
              </div>
              <div>
                <label style={lbl}>{mt("Date")}</label>
                <DateField  style={inp} value={form.meetingDate}
                  onChange={e=>setForm(f=>({...f,meetingDate:e.target.value}))} />
              </div>
              <div>
                <label style={lbl}>{mt("Type")}</label>
                <select style={{...inp,cursor:"pointer"}} value={form.meetingType}
                  onChange={e=>setForm(f=>({...f,meetingType:e.target.value}))}>
                  {MTG_TYPES.map(t=><option key={t} value={t}>{enumLabel(t, locale)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{mt("docStatus")}</label>
                <select style={{...inp,cursor:"pointer"}} value={form.status}
                  onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  {["DRAFT","FINAL","APPROVED"].map(t=><option key={t} value={t}>{mt("mst_" + t)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div>
                <label style={lbl}>{mt("locationLbl")}</label>
                <input style={inp} value={form.location}
                  onChange={e=>setForm(f=>({...f,location:e.target.value}))}
                  placeholder={mt("phLocation")} />
              </div>
              <div>
                <label style={lbl}>{mt("Facilitator")}</label>
                <input style={inp} value={form.facilitator}
                  onChange={e=>setForm(f=>({...f,facilitator:e.target.value}))} />
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={lbl}>{mt("Attendees")}</label>
              <input style={inp} value={form.attendees}
                onChange={e=>setForm(f=>({...f,attendees:e.target.value}))}
                placeholder={mt("phAttendees")} />
            </div>
            {[
              { key:"agenda",      label:mt("Agenda") },
              { key:"discussion",  label:mt("Discussion / Notes") },
              { key:"decisions",   label:mt("Decisions Made") },
              { key:"actionItems", label:mt("Action Items (who / what / by when)") },
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
              <label style={lbl}>{mt("Next meeting date")}</label>
              <DateField  style={{...inp,width:"auto"}} value={form.nextMeeting}
                onChange={e=>setForm(f=>({...f,nextMeeting:e.target.value}))} />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={save} disabled={saving||!form.title.trim()}
                style={{ padding:"9px 20px", background:"var(--steel)", color:"#fff",
                  border:"none", borderRadius:"var(--radius)", fontSize:12, fontWeight:500,
                  cursor:"pointer", fontFamily:"var(--font)",
                  opacity:!form.title.trim()?0.5:1 }}>
                {saving?mt("Saving…"):mt("Save minutes")}
              </button>
              <button onClick={()=>{setShowForm(false);resetForm();setError("")}}
                style={{ padding:"9px 16px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>
                {mt("Cancel")}
              </button>
            </div>
          </div>
        )}

        {/* Minutes list */}
        {minutes.length === 0 && !showForm ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>📝</div>
            <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>
              {mt("emptyTitle")}
            </div>
            <div style={{ fontSize:13, color:"var(--text-3)", maxWidth:400, margin:"0 auto 20px", lineHeight:1.7 }}>
              {mt("emptyBody")}
            </div>
            <button onClick={()=>setShowForm(true)}
              style={{ padding:"10px 20px", background:"var(--steel)", color:"#fff",
                border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                cursor:"pointer", fontFamily:"var(--font)" }}>
              {mt("+ Record first meeting")}
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
                    <button onClick={e=>{ e.stopPropagation();
                        window.open(`/print/projects/${projectId}/minutes/${m.id}`, "_blank") }}
                      style={{ padding:"3px 9px", fontSize:11, fontWeight:600, cursor:"pointer",
                        border:"1px solid var(--border)", borderRadius:6, background:"#fff",
                        color:"var(--text-2)", fontFamily:"var(--font)" }}>{mt("pdfBtn")}</button>
                    <button onClick={e=>{ e.stopPropagation(); openEdit(m) }}
                      style={{ padding:"3px 9px", fontSize:11, fontWeight:600, cursor:"pointer",
                        border:"1px solid var(--border)", borderRadius:6, background:"#fff",
                        color:"var(--text-2)", fontFamily:"var(--font)" }}>{mt("Edit")}</button>
                    <button onClick={e=>{ e.stopPropagation(); removeMinutes(m) }}
                      style={{ padding:"3px 8px", fontSize:11, fontWeight:600, cursor:"pointer",
                        border:"1px solid #FECACA", borderRadius:6, background:"#fff",
                        color:"var(--red)", fontFamily:"var(--font)" }}>✕</button>
                    <span style={{ color:"var(--text-4)", fontSize:12,
                      transform:isOpen?"rotate(0)":"rotate(-90deg)",
                      display:"inline-block", transition:"transform .15s" }}>▼</span>
                  </div>

                  {editId === m.id && (
                    <div style={{ borderTop:"1px solid var(--border)", padding:"14px 16px",
                      background:"var(--surface)", display:"flex", flexDirection:"column", gap:9 }}>
                      <label style={{ fontSize:11, color:"var(--text-3)" }}>{mt("Title")}
                        <input value={editF.title} onChange={e=>setEditF((f:any)=>({...f,title:e.target.value}))}
                          style={inp} />
                      </label>
                      <div style={{ display:"flex", gap:9 }}>
                        <label style={{ flex:1, fontSize:11, color:"var(--text-3)" }}>{mt("Date")}
                          <input type="date" value={editF.meetingDate}
                            onChange={e=>setEditF((f:any)=>({...f,meetingDate:e.target.value}))}
                            style={inp} />
                        </label>
                        <label style={{ flex:1, fontSize:11, color:"var(--text-3)" }}>{mt("Type")}
                          <select value={editF.meetingType}
                            onChange={e=>setEditF((f:any)=>({...f,meetingType:e.target.value}))}
                            style={{...inp, cursor:"pointer"}}>
                            {["KICKOFF","STATUS","PHASE_GATE","RISK_REVIEW","STEERING",
                              "SPRINT_PLANNING","RETROSPECTIVE","AD_HOC","OTHER"]
                              .map(t2=><option key={t2} value={t2}>{enumLabel(t2, locale)}</option>)}
                          </select>
                        </label>
                        <label style={{ flex:1, fontSize:11, color:"var(--text-3)" }}>{mt("docStatus")}
                          <select value={editF.status}
                            onChange={e=>setEditF((f:any)=>({...f,status:e.target.value}))}
                            style={{...inp, cursor:"pointer"}}>
                            {["DRAFT","FINAL","APPROVED"]
                              .map(t2=><option key={t2} value={t2}>{mt("mst_" + t2)}</option>)}
                          </select>
                        </label>
                      </div>
                      {([["location",mt("locationLbl")],["facilitator",mt("Facilitator")],["attendees",mt("Attendees")]] as const).map(([k,lb])=>(
                        <label key={k} style={{ fontSize:11, color:"var(--text-3)" }}>{lb}
                          <input value={editF[k]} onChange={e=>setEditF((f:any)=>({...f,[k]:e.target.value}))}
                            style={inp} />
                        </label>
                      ))}
                      {([["agenda",mt("Agenda")],["discussion",mt("Discussion")],["decisions",mt("Decisions")],["actionItems",mt("Action Items (who / what / by when)")]] as const).map(([k,lb])=>(
                        <label key={k} style={{ fontSize:11, color:"var(--text-3)" }}>{lb}
                          <textarea rows={3} value={editF[k]}
                            onChange={e=>setEditF((f:any)=>({...f,[k]:e.target.value}))}
                            style={{...inp, resize:"vertical"}} />
                        </label>
                      ))}
                      <label style={{ fontSize:11, color:"var(--text-3)" }}>{mt("Next meeting date")}
                        <input type="date" value={editF.nextMeeting || ""}
                          onChange={e=>setEditF((f:any)=>({...f,nextMeeting:e.target.value}))}
                          style={{...inp, width:"auto", display:"block"}} />
                      </label>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={()=>saveEdit(m.id)}
                          style={{ flex:1, padding:"8px 0", background:"var(--steel)", color:"#fff",
                            border:"none", borderRadius:"var(--radius)", fontSize:12.5, fontWeight:700,
                            cursor:"pointer", fontFamily:"var(--font)" }}>{mt("Save changes")}</button>
                        <button onClick={()=>setEditId(null)}
                          style={{ padding:"8px 14px", background:"none", border:"1px solid var(--border)",
                            borderRadius:"var(--radius)", fontSize:12.5, cursor:"pointer",
                            color:"var(--text-3)", fontFamily:"var(--font)" }}>{mt("Cancel")}</button>
                      </div>
                    </div>
                  )}

                  {/* Expanded content */}
                  {isOpen && (
                    <div style={{ borderTop:"1px solid var(--border)", padding:"14px 16px",
                      background:"var(--surface)" }}>
                      {[
                        { label:mt("Agenda"),       value:toText(m.agenda)      },
                        { label:mt("Discussion"),   value:toText(m.discussion)  },
                        { label:mt("Decisions"),    value:toText(m.decisions)   },
                        { label:mt("Action Items"), value:toText(m.actionItems) },
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
                          📅 {mt("Next meeting")}: {fmtDate(m.nextMeeting)}
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
