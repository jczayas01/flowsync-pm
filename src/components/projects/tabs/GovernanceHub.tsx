"use client"
// src/components/projects/tabs/GovernanceHub.tsx
// Unified PM Governance Best Practices Documents Hub
// Team Charter · WBS Dictionary · Quality Plan · Requirements · Meeting Minutes · Handover Plan

import { useState } from "react"
import { useRouter } from "next/navigation"

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d:any) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric", timeZone:"UTC" })
}

// Meeting-minutes fields may be a string OR a JSON array of objects — normalize to text.
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
function TextArea({ label, value, onChange, rows=4, placeholder="" }: {
  label:string; value:string; onChange:(v:string)=>void; rows?:number; placeholder?:string
}) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={lbl}>{label}</label>
      <textarea rows={rows} value={value}
        onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        style={{...inp, resize:"vertical", lineHeight:1.6}} />
    </div>
  )
}

function SectionHeader({ title, standardRef, icon }: { title:string; standardRef:string; icon:string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16,
      paddingBottom:10, borderBottom:"2px solid var(--steel)" }}>
      <span style={{ fontSize:20 }}>{icon}</span>
      <div>
        <div style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>{title}</div>
        <div style={{ fontSize:10, color:"var(--text-4)" }}>{standardRef}</div>
      </div>
    </div>
  )
}

// ── NAV TABS ────────────────────────────────────────────────────────────────

const DOCS = [
  { id:"charter",      label:"Team Charter",    icon:"🤝", standardRef:"PM Standard" },
  { id:"wbs",          label:"WBS Dictionary",  icon:"🗂",  standardRef:"PM Standard" },
  { id:"requirements", label:"Requirements",    icon:"📋", standardRef:"PM Standard" },
  { id:"quality",      label:"Quality Plan",    icon:"✅", standardRef:"PM Standard" },
  { id:"minutes",      label:"Meeting Minutes", icon:"📝", standardRef:"PM Standard" },
  { id:"handover",     label:"Handover Plan",   icon:"🔄", standardRef:"Close" },
]

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────

export function GovernanceHub({ projectId, workspaceId, project, charter, qmp,
  wbsEntries, requirements, minutes, handover, tasks, members }: {
  projectId:string; workspaceId:string; project:any;
  charter:any; qmp:any; wbsEntries:any[]; requirements:any[];
  minutes:any[]; handover:any; tasks:any[]; members:any[]
}) {
  const router = useRouter()
  const [activeDoc, setActiveDoc] = useState("charter")
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const [success, setSuccess] = useState("")
  const [ingesting, setIngesting] = useState(false)
  const [ingestMsg, setIngestMsg] = useState("")

  const DOC_TYPE_MAP: Record<string,string> = {
    charter:"TEAM_CHARTER", wbs:"WBS", requirements:"REQUIREMENTS",
    quality:"QUALITY_PLAN", minutes:"MEETING_MINUTES", handover:"HANDOVER_PLAN"
  }

  function downloadTemplate() {
    const type = DOC_TYPE_MAP[activeDoc]
    window.location.href = `/api/projects/${projectId}/templates?type=${type}`
  }

  async function ingestDocument(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIngesting(true); setIngestMsg("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("docType", DOC_TYPE_MAP[activeDoc])
      const res = await fetch(`/api/projects/${projectId}/ingest-document`, {
        method:"POST", body:fd,
        headers:{ "x-workspace-id":workspaceId },
      })
      const d = await res.json()
      if (!res.ok) { setIngestMsg(`✗ ${d.error||"Ingestion failed"}`); return }
      setIngestMsg(`✓ ${d.message}`)
      setTimeout(()=>setIngestMsg(""), 4000)
      router.refresh()
    } finally { setIngesting(false); if (e.target) e.target.value="" }
  }

  const ingestRef = { current: null as HTMLInputElement|null }

  function showSuccess(msg:string) {
    setSuccess(msg); setTimeout(()=>setSuccess(""), 3000)
  }

  // ── TEAM CHARTER state ──────────────────────────────────────────────────
  const [charterForm, setCharterForm] = useState({
    vision:             charter?.vision||"",
    objectives:         charter?.objectives||"",
    values:             charter?.values||"",
    norms:              charter?.norms||"",
    decisionMaking:     charter?.decisionMaking||"",
    conflictResolution: charter?.conflictResolution||"",
    communicationPlan:  charter?.communicationPlan||"",
    toolsAndProcesses:  charter?.toolsAndProcesses||"",
  })

  async function saveCharter() {
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/team-charter`, {
        method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify(charterForm),
      })
      if (!res.ok) { setError("Save failed"); return }
      showSuccess("Team Charter saved"); router.refresh()
    } finally { setSaving(false) }
  }

  // ── WBS state ──────────────────────────────────────────────────────────
  const [wbsEntryList, setWbsEntryList] = useState(wbsEntries)
  const [wbsForm, setWbsForm] = useState({ code:"", title:"", description:"", acceptanceCriteria:"", responsible:"", taskId:"" })
  const [showWbsForm, setShowWbsForm] = useState(false)

  async function saveWbsEntry() {
    if (!wbsForm.code||!wbsForm.title) { setError("Code and title required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/wbs`, {
        method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ ...wbsForm, taskId:wbsForm.taskId||null }),
      })
      if (!res.ok) { setError("Save failed"); return }
      showSuccess("WBS entry added"); setShowWbsForm(false)
      setWbsForm({ code:"", title:"", description:"", acceptanceCriteria:"", responsible:"", taskId:"" })
      router.refresh()
    } finally { setSaving(false) }
  }

  async function deleteWbsEntry(id:string) {
    if (!confirm("Delete this WBS entry?")) return
    await fetch(`/api/projects/${projectId}/wbs/${id}`, {
      method:"DELETE", headers:{"x-workspace-id":workspaceId}
    })
    router.refresh()
  }

  // ── REQUIREMENTS state ────────────────────────────────────────────────
  const REQ_TYPES = ["FUNCTIONAL","NON_FUNCTIONAL","BUSINESS","TECHNICAL","REGULATORY","OTHER"]
  const REQ_STATUS = { DRAFT:"#64748B", APPROVED:"#059669", IMPLEMENTED:"#1B6CA8", VERIFIED:"#7C3AED", REJECTED:"#DC2626" }
  const [reqForm, setReqForm] = useState({ code:"", title:"", description:"", type:"FUNCTIONAL", priority:"MEDIUM", status:"DRAFT", source:"", acceptanceCriteria:"", linkedTaskId:"" })
  const [showReqForm, setShowReqForm] = useState(false)

  async function saveReq() {
    if (!reqForm.code||!reqForm.title) { setError("Code and title required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/requirements`, {
        method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ ...reqForm, linkedTaskId:reqForm.linkedTaskId||null }),
      })
      if (!res.ok) { setError("Save failed"); return }
      showSuccess("Requirement added"); setShowReqForm(false)
      setReqForm({ code:"", title:"", description:"", type:"FUNCTIONAL", priority:"MEDIUM", status:"DRAFT", source:"", acceptanceCriteria:"", linkedTaskId:"" })
      router.refresh()
    } finally { setSaving(false) }
  }

  // ── QUALITY PLAN state ────────────────────────────────────────────────
  const [qmpForm, setQmpForm] = useState({
    qualityStandards:  qmp?.qualityStandards||"",
    qualityObjectives: qmp?.qualityObjectives||"",
    roles:             qmp?.roles||"",
    processes:         qmp?.processes||"",
    tools:             qmp?.tools||"",
    metrics:           qmp?.metrics||"",
    audits:            qmp?.audits||"",
    nonConformance:    qmp?.nonConformance||"",
  })

  async function saveQmp() {
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/quality-plan`, {
        method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify(qmpForm),
      })
      if (!res.ok) { setError("Save failed"); return }
      showSuccess("Quality Plan saved"); router.refresh()
    } finally { setSaving(false) }
  }

  // ── MEETING MINUTES state ─────────────────────────────────────────────
  const MTG_TYPES = ["KICKOFF","STATUS","PHASE_GATE","RISK_REVIEW","STEERING","SPRINT_PLANNING","RETROSPECTIVE","AD_HOC","OTHER"]
  const [minutesForm, setMinutesForm] = useState({
    title:"", meetingDate:new Date().toISOString().split("T")[0],
    meetingType:"STATUS", attendees:"", agenda:"", discussion:"", decisions:"",
    actionItems:"", nextMeeting:""
  })
  const [showMinutesForm, setShowMinutesForm] = useState(false)

  async function saveMinutes() {
    if (!minutesForm.title) { setError("Title required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/meeting-minutes`, {
        method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify(minutesForm),
      })
      if (!res.ok) { setError("Save failed"); return }
      showSuccess("Minutes saved"); setShowMinutesForm(false)
      setMinutesForm({ title:"", meetingDate:new Date().toISOString().split("T")[0], meetingType:"STATUS", attendees:"", agenda:"", discussion:"", decisions:"", actionItems:"", nextMeeting:"" })
      router.refresh()
    } finally { setSaving(false) }
  }

  // ── HANDOVER state ────────────────────────────────────────────────────
  const [handoverForm, setHandoverForm] = useState({
    overview:            handover?.overview||"",
    operationsContact:   handover?.operationsContact||"",
    systemsHandedOver:   handover?.systemsHandedOver||"",
    documentation:       handover?.documentation||"",
    trainingCompleted:   handover?.trainingCompleted||"",
    knownIssues:         handover?.knownIssues||"",
    supportArrangements: handover?.supportArrangements||"",
    handoverDate:        handover?.handoverDate?.split("T")[0]||"",
  })

  async function saveHandover() {
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/handover`, {
        method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify(handoverForm),
      })
      if (!res.ok) { setError("Save failed"); return }
      showSuccess("Handover Plan saved"); router.refresh()
    } finally { setSaving(false) }
  }

  // ── RENDER ────────────────────────────────────────────────────────────

  const docStatus = {
    charter:      charter ? "✓" : "—",
    wbs:          wbsEntries.length > 0 ? `${wbsEntries.length} entries` : "—",
    requirements: requirements.length > 0 ? `${requirements.length} items` : "—",
    quality:      qmp ? "✓" : "—",
    minutes:      minutes.length > 0 ? `${minutes.length} records` : "—",
    handover:     handover ? "✓" : "—",
  } as Record<string,string>

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>

      {/* Left nav */}
      <div style={{ width:200, flexShrink:0, background:"#1a3a5c", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"14px 16px", borderBottom:"1px solid rgba(255,255,255,.1)" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,.4)",
            textTransform:"uppercase", letterSpacing:".08em", marginBottom:2 }}>
            PM Governance Best Practices
          </div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,.7)" }}>{project?.name}</div>
        </div>
        {DOCS.map(d => (
          <div key={d.id} onClick={() => setActiveDoc(d.id)}
            style={{ padding:"10px 16px", cursor:"pointer",
              background:activeDoc===d.id?"rgba(255,255,255,.1)":"transparent",
              borderLeft:`3px solid ${activeDoc===d.id?"#60A5FA":"transparent"}`,
              transition:"background .15s" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14 }}>{d.icon}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:500, color:"#fff" }}>{d.label}</div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,.4)" }}>{d.standardRef}</div>
              </div>
            </div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,.35)", marginTop:3, marginLeft:22 }}>
              {docStatus[d.id]}
            </div>
          </div>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex:1, overflowY:"auto", padding:24, background:"var(--surface)" }}>

        {/* Template toolbar */}
        <div style={{ background:"#fff", borderRadius:"var(--radius)", padding:"10px 14px",
          marginBottom:14, display:"flex", alignItems:"center", gap:10,
          border:"1px solid var(--border)" }}>
          <span style={{ fontSize:11, color:"var(--text-3)", flex:1 }}>
            📄 Download a pre-filled Word template · complete it offline · upload to auto-populate project data
          </span>
          {ingestMsg && (
            <span style={{ fontSize:11, color:ingestMsg.startsWith("✓")?"var(--green)":"var(--red)",
              fontWeight:600 }}>{ingestMsg}</span>
          )}
          <button onClick={downloadTemplate}
            style={{ padding:"6px 12px", background:"#EFF6FF", border:"1px solid #BFDBFE",
              borderRadius:"var(--radius)", fontSize:11, cursor:"pointer",
              fontFamily:"var(--font)", color:"var(--steel)", fontWeight:600,
              whiteSpace:"nowrap" }}>
            ⬇ Download template
          </button>
          <input type="file" accept=".txt,.docx,.pdf,.doc"
            style={{ display:"none" }}
            ref={el => { ingestRef.current = el }}
            onChange={ingestDocument} />
          <button onClick={() => ingestRef.current?.click()} disabled={ingesting}
            style={{ padding:"6px 12px", background:"var(--steel)", color:"#fff",
              border:"none", borderRadius:"var(--radius)", fontSize:11, fontWeight:600,
              cursor:ingesting?"wait":"pointer", fontFamily:"var(--font)", whiteSpace:"nowrap" }}>
            {ingesting ? "⏳ Reading…" : "🤖 Upload & AI ingest"}
          </button>
        </div>

        {/* Status bar */}
        {(success||error) && (
          <div style={{ marginBottom:14, padding:"9px 14px", borderRadius:"var(--radius)",
            background:success?"#ECFDF5":"#FEF2F2", color:success?"var(--green)":"var(--red)",
            fontSize:12, fontWeight:500, border:`1px solid ${success?"#BBF7D0":"#FECACA"}` }}>
            {success||error}
          </div>
        )}

        {/* ── TEAM CHARTER ── */}
        {activeDoc==="charter" && (
          <div style={{ background:"#fff", borderRadius:"var(--radius)", padding:24 }}>
            <SectionHeader title="Team Charter" icon="🤝"
              standardRef="PM Standard — Team Performance Domain · Defines team norms, values, and working agreements" />
            <TextArea label="Team Vision" value={charterForm.vision}
              onChange={v=>setCharterForm(f=>({...f,vision:v}))}
              placeholder="What does this team aim to achieve together?" />
            <TextArea label="Team Objectives & Success Criteria" value={charterForm.objectives}
              onChange={v=>setCharterForm(f=>({...f,objectives:v}))}
              placeholder="What does success look like for this team?" />
            <TextArea label="Team Values & Working Agreements" value={charterForm.values}
              onChange={v=>setCharterForm(f=>({...f,values:v}))}
              placeholder="e.g. Transparency, respect, accountability, quality..." />
            <TextArea label="Working Norms (hours, meetings, communication)" value={charterForm.norms}
              onChange={v=>setCharterForm(f=>({...f,norms:v}))}
              placeholder="e.g. Core hours 9-5, daily standup at 9am, no meeting Fridays..." />
            <TextArea label="Decision-Making Process" value={charterForm.decisionMaking}
              onChange={v=>setCharterForm(f=>({...f,decisionMaking:v}))}
              placeholder="How are decisions made? Who has authority for what?" />
            <TextArea label="Conflict Resolution" value={charterForm.conflictResolution}
              onChange={v=>setCharterForm(f=>({...f,conflictResolution:v}))}
              placeholder="How will the team handle disagreements?" />
            <TextArea label="Communication Plan" value={charterForm.communicationPlan}
              onChange={v=>setCharterForm(f=>({...f,communicationPlan:v}))}
              placeholder="Tools used, response time expectations, escalation..." />
            <TextArea label="Tools & Processes" value={charterForm.toolsAndProcesses}
              onChange={v=>setCharterForm(f=>({...f,toolsAndProcesses:v}))}
              placeholder="Project tools, coding standards, review processes..." />
            <button onClick={saveCharter} disabled={saving}
              style={{ padding:"10px 22px", background:"var(--steel)", color:"#fff",
                border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                cursor:"pointer", fontFamily:"var(--font)" }}>
              {saving?"Saving…":"💾 Save Team Charter"}
            </button>
          </div>
        )}

        {/* ── WBS DICTIONARY ── */}
        {activeDoc==="wbs" && (
          <div>
            <div style={{ background:"#fff", borderRadius:"var(--radius)", padding:24, marginBottom:12 }}>
              <SectionHeader title="WBS Dictionary" icon="🗂"
                standardRef="PM Standard — Planning — Planning Domain · Deliverable descriptions, acceptance criteria per WBS element" />
              <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
                <button onClick={()=>setShowWbsForm(s=>!s)}
                  style={{ padding:"8px 16px", background:showWbsForm?"#fff":"var(--steel)",
                    color:showWbsForm?"var(--text-2)":"#fff",
                    border:showWbsForm?"1px solid var(--border)":"none",
                    borderRadius:"var(--radius)", fontSize:12, cursor:"pointer", fontFamily:"var(--font)" }}>
                  {showWbsForm ? "Cancel" : "+ Add WBS entry"}
                </button>
              </div>
              {showWbsForm && (
                <div style={{ background:"var(--surface)", borderRadius:"var(--radius)",
                  padding:16, marginBottom:16, border:"1px solid var(--border)" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 3fr", gap:12, marginBottom:12 }}>
                    <div>
                      <label style={lbl}>WBS Code *</label>
                      <input style={inp} value={wbsForm.code} placeholder="1.2.3"
                        onChange={e=>setWbsForm(f=>({...f,code:e.target.value}))} />
                    </div>
                    <div>
                      <label style={lbl}>Title / Deliverable name *</label>
                      <input style={inp} value={wbsForm.title} placeholder="e.g. System Architecture Document"
                        onChange={e=>setWbsForm(f=>({...f,title:e.target.value}))} />
                    </div>
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <label style={lbl}>Description — What this deliverable is</label>
                    <textarea rows={3} style={{...inp,resize:"vertical",lineHeight:1.6}}
                      value={wbsForm.description} placeholder="Describe this WBS element..."
                      onChange={e=>setWbsForm(f=>({...f,description:e.target.value}))} />
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <label style={lbl}>Acceptance Criteria</label>
                    <textarea rows={3} style={{...inp,resize:"vertical",lineHeight:1.6}}
                      value={wbsForm.acceptanceCriteria} placeholder="What must be true for this to be accepted?"
                      onChange={e=>setWbsForm(f=>({...f,acceptanceCriteria:e.target.value}))} />
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                    <div>
                      <label style={lbl}>Responsible</label>
                      <input style={inp} value={wbsForm.responsible} placeholder="Role or person"
                        onChange={e=>setWbsForm(f=>({...f,responsible:e.target.value}))} />
                    </div>
                    <div>
                      <label style={lbl}>Link to task</label>
                      <select style={{...inp,cursor:"pointer"}} value={wbsForm.taskId}
                        onChange={e=>setWbsForm(f=>({...f,taskId:e.target.value}))}>
                        <option value="">No linked task</option>
                        {tasks.map(t=><option key={t.id} value={t.id}>{t.code}: {t.title}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={saveWbsEntry} disabled={saving}
                    style={{ padding:"8px 18px", background:"var(--steel)", color:"#fff",
                      border:"none", borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                      fontFamily:"var(--font)", opacity:(!wbsForm.code||!wbsForm.title)?0.5:1 }}>
                    {saving?"Saving…":"Add entry"}
                  </button>
                </div>
              )}
              {wbsEntries.length === 0 && !showWbsForm ? (
                <div style={{ textAlign:"center", padding:"40px", color:"var(--text-3)", fontSize:13 }}>
                  No WBS entries yet. Click "+ Add WBS entry" to document deliverables.
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {wbsEntries.map(e => (
                    <div key={e.id} style={{ background:"var(--surface)", borderRadius:"var(--radius)",
                      padding:"12px 16px", border:"1px solid var(--border)",
                      borderLeft:"3px solid var(--steel)" }}>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                        <span style={{ fontSize:11, fontFamily:"monospace", fontWeight:700,
                          color:"var(--steel)", flexShrink:0, padding:"2px 6px",
                          background:"#EFF6FF", borderRadius:4 }}>{e.code}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:3 }}>{e.title}</div>
                          {e.description && <p style={{ fontSize:12, color:"var(--text-2)", margin:"0 0 6px", lineHeight:1.5 }}>{e.description}</p>}
                          {e.acceptanceCriteria && (
                            <div style={{ fontSize:11, color:"var(--green)", marginTop:4 }}>
                              ✓ Criteria: {e.acceptanceCriteria.slice(0,120)}{e.acceptanceCriteria.length>120?"…":""}
                            </div>
                          )}
                          {e.responsible && <div style={{ fontSize:11, color:"var(--text-4)", marginTop:3 }}>👤 {e.responsible}</div>}
                        </div>
                        <button onClick={()=>deleteWbsEntry(e.id)}
                          style={{ fontSize:11, color:"var(--red)", background:"none", border:"none",
                            cursor:"pointer", flexShrink:0 }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── REQUIREMENTS ── */}
        {activeDoc==="requirements" && (
          <div style={{ background:"#fff", borderRadius:"var(--radius)", padding:24 }}>
            <SectionHeader title="Requirements Documentation" icon="📋"
              standardRef="PM Standard — Delivery — Delivery Domain · Functional, non-functional, and business requirements" />
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ fontSize:12, color:"var(--text-3)" }}>{requirements.length} requirements</div>
              <button onClick={()=>setShowReqForm(s=>!s)}
                style={{ padding:"8px 16px", background:showReqForm?"#fff":"var(--steel)",
                  color:showReqForm?"var(--text-2)":"#fff",
                  border:showReqForm?"1px solid var(--border)":"none",
                  borderRadius:"var(--radius)", fontSize:12, cursor:"pointer", fontFamily:"var(--font)" }}>
                {showReqForm?"Cancel":"+ Add requirement"}
              </button>
            </div>
            {showReqForm && (
              <div style={{ background:"var(--surface)", borderRadius:"var(--radius)",
                padding:16, marginBottom:16, border:"1px solid var(--border)" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 3fr", gap:12, marginBottom:10 }}>
                  <div>
                    <label style={lbl}>Code *</label>
                    <input style={inp} value={reqForm.code} placeholder="REQ-001"
                      onChange={e=>setReqForm(f=>({...f,code:e.target.value}))} />
                  </div>
                  <div>
                    <label style={lbl}>Title *</label>
                    <input style={inp} value={reqForm.title}
                      onChange={e=>setReqForm(f=>({...f,title:e.target.value}))} />
                  </div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={lbl}>Description</label>
                  <textarea rows={3} style={{...inp,resize:"vertical",lineHeight:1.6}}
                    value={reqForm.description}
                    onChange={e=>setReqForm(f=>({...f,description:e.target.value}))} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                  <div>
                    <label style={lbl}>Type</label>
                    <select style={{...inp,cursor:"pointer"}} value={reqForm.type}
                      onChange={e=>setReqForm(f=>({...f,type:e.target.value}))}>
                      {REQ_TYPES.map(t=><option key={t}>{t.replace("_"," ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Priority</label>
                    <select style={{...inp,cursor:"pointer"}} value={reqForm.priority}
                      onChange={e=>setReqForm(f=>({...f,priority:e.target.value}))}>
                      {["CRITICAL","HIGH","MEDIUM","LOW"].map(p=><option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Status</label>
                    <select style={{...inp,cursor:"pointer"}} value={reqForm.status}
                      onChange={e=>setReqForm(f=>({...f,status:e.target.value}))}>
                      {["DRAFT","APPROVED","IMPLEMENTED","VERIFIED","REJECTED"].map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={lbl}>Acceptance Criteria</label>
                  <textarea rows={2} style={{...inp,resize:"vertical",lineHeight:1.6}}
                    value={reqForm.acceptanceCriteria}
                    onChange={e=>setReqForm(f=>({...f,acceptanceCriteria:e.target.value}))} />
                </div>
                <button onClick={saveReq} disabled={saving}
                  style={{ padding:"8px 18px", background:"var(--steel)", color:"#fff",
                    border:"none", borderRadius:"var(--radius)", fontSize:12,
                    cursor:"pointer", fontFamily:"var(--font)" }}>
                  {saving?"Saving…":"Add requirement"}
                </button>
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {requirements.map(r => {
                const sc = (REQ_STATUS as any)[r.status]||"#64748B"
                return (
                  <div key={r.id} style={{ padding:"10px 14px", background:"var(--surface)",
                    borderRadius:"var(--radius)", border:"1px solid var(--border)",
                    display:"flex", alignItems:"flex-start", gap:10 }}>
                    <span style={{ fontFamily:"monospace", fontSize:11, color:"var(--steel)",
                      fontWeight:700, flexShrink:0 }}>{r.code}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:"var(--text)" }}>{r.title}</span>
                        <span style={{ fontSize:9, padding:"1px 6px", borderRadius:8,
                          background:sc+"15", color:sc, fontWeight:700 }}>{r.status}</span>
                        <span style={{ fontSize:9, color:"var(--text-4)" }}>{r.type.replace("_"," ")}</span>
                      </div>
                      {r.description && <p style={{ fontSize:11, color:"var(--text-3)", margin:0, lineHeight:1.5 }}>{r.description}</p>}
                    </div>
                  </div>
                )
              })}
              {requirements.length===0 && !showReqForm && (
                <div style={{ textAlign:"center", padding:40, color:"var(--text-3)", fontSize:13 }}>
                  No requirements yet. Click "+ Add requirement" to start.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── QUALITY PLAN ── */}
        {activeDoc==="quality" && (
          <div style={{ background:"#fff", borderRadius:"var(--radius)", padding:24 }}>
            <SectionHeader title="Quality Management Plan" icon="✅"
              standardRef="PM Standard — Measurement — Delivery Domain · Quality standards, objectives, processes and metrics" />
            <TextArea label="Applicable Quality Standards" value={qmpForm.qualityStandards}
              onChange={v=>setQmpForm(f=>({...f,qualityStandards:v}))}
              placeholder="e.g. ISO 9001, CMMI Level 3, organizational quality standards..." />
            <TextArea label="Quality Objectives" value={qmpForm.qualityObjectives}
              onChange={v=>setQmpForm(f=>({...f,qualityObjectives:v}))}
              placeholder="What quality targets must be met? Measurable objectives..." />
            <TextArea label="Roles & Responsibilities" value={qmpForm.roles}
              onChange={v=>setQmpForm(f=>({...f,roles:v}))}
              placeholder="Who is responsible for quality? QA lead, reviewers, approvers..." />
            <TextArea label="Quality Assurance Processes" value={qmpForm.processes}
              onChange={v=>setQmpForm(f=>({...f,processes:v}))}
              placeholder="Reviews, audits, testing procedures, inspections..." />
            <TextArea label="Quality Tools & Techniques" value={qmpForm.tools}
              onChange={v=>setQmpForm(f=>({...f,tools:v}))}
              placeholder="e.g. peer review, code review, UAT, checklists, statistical sampling..." />
            <TextArea label="Quality Metrics" value={qmpForm.metrics}
              onChange={v=>setQmpForm(f=>({...f,metrics:v}))}
              placeholder="How will quality be measured? Defect rates, test coverage, customer satisfaction..." />
            <TextArea label="Quality Audit Schedule" value={qmpForm.audits}
              onChange={v=>setQmpForm(f=>({...f,audits:v}))}
              placeholder="When and how quality audits will be conducted..." />
            <TextArea label="Non-Conformance Handling" value={qmpForm.nonConformance}
              onChange={v=>setQmpForm(f=>({...f,nonConformance:v}))}
              placeholder="What happens when quality standards are not met?" />
            <button onClick={saveQmp} disabled={saving}
              style={{ padding:"10px 22px", background:"var(--steel)", color:"#fff",
                border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                cursor:"pointer", fontFamily:"var(--font)" }}>
              {saving?"Saving…":"💾 Save Quality Plan"}
            </button>
          </div>
        )}

        {/* ── MEETING MINUTES ── */}
        {activeDoc==="minutes" && (
          <div>
            <div style={{ background:"#fff", borderRadius:"var(--radius)", padding:24, marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                <div>
                  <SectionHeader title="Meeting Minutes" icon="📝"
                    standardRef="PM Standard — Delivery — Delivery Domain · Formal meeting records, decisions, and action items" />
                </div>
                <button onClick={()=>setShowMinutesForm(s=>!s)}
                  style={{ padding:"8px 16px", background:showMinutesForm?"#fff":"var(--steel)",
                    color:showMinutesForm?"var(--text-2)":"#fff",
                    border:showMinutesForm?"1px solid var(--border)":"none",
                    borderRadius:"var(--radius)", fontSize:12, cursor:"pointer", fontFamily:"var(--font)" }}>
                  {showMinutesForm?"Cancel":"+ New minutes"}
                </button>
              </div>

              {showMinutesForm && (
                <div style={{ background:"var(--surface)", borderRadius:"var(--radius)",
                  padding:16, marginBottom:16, border:"1px solid var(--border)" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12, marginBottom:12 }}>
                    <div>
                      <label style={lbl}>Meeting title *</label>
                      <input style={inp} value={minutesForm.title}
                        onChange={e=>setMinutesForm(f=>({...f,title:e.target.value}))}
                        placeholder="e.g. Sprint 4 Planning Meeting" />
                    </div>
                    <div>
                      <label style={lbl}>Date</label>
                      <input type="date" style={inp} value={minutesForm.meetingDate}
                        onChange={e=>setMinutesForm(f=>({...f,meetingDate:e.target.value}))} />
                    </div>
                    <div>
                      <label style={lbl}>Type</label>
                      <select style={{...inp,cursor:"pointer"}} value={minutesForm.meetingType}
                        onChange={e=>setMinutesForm(f=>({...f,meetingType:e.target.value}))}>
                        {MTG_TYPES.map(t=><option key={t}>{t.replace("_"," ")}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <label style={lbl}>Attendees</label>
                    <input style={inp} value={minutesForm.attendees} placeholder="Names, roles..."
                      onChange={e=>setMinutesForm(f=>({...f,attendees:e.target.value}))} />
                  </div>
                  <TextArea label="Agenda" value={minutesForm.agenda}
                    onChange={v=>setMinutesForm(f=>({...f,agenda:v}))} rows={2}
                    placeholder="Topics discussed..." />
                  <TextArea label="Discussion / Notes" value={minutesForm.discussion}
                    onChange={v=>setMinutesForm(f=>({...f,discussion:v}))} rows={4}
                    placeholder="Key discussion points, context..." />
                  <TextArea label="Decisions Made" value={minutesForm.decisions}
                    onChange={v=>setMinutesForm(f=>({...f,decisions:v}))} rows={2}
                    placeholder="Decisions and their rationale..." />
                  <TextArea label="Action Items" value={minutesForm.actionItems}
                    onChange={v=>setMinutesForm(f=>({...f,actionItems:v}))} rows={2}
                    placeholder="Who does what by when? (e.g. Juan: complete risk assessment by Jul 15)" />
                  <div style={{ marginBottom:12 }}>
                    <label style={lbl}>Next meeting date</label>
                    <input type="date" style={{...inp,width:"auto"}} value={minutesForm.nextMeeting}
                      onChange={e=>setMinutesForm(f=>({...f,nextMeeting:e.target.value}))} />
                  </div>
                  <button onClick={saveMinutes} disabled={saving||!minutesForm.title}
                    style={{ padding:"8px 18px", background:"var(--steel)", color:"#fff",
                      border:"none", borderRadius:"var(--radius)", fontSize:12,
                      cursor:"pointer", fontFamily:"var(--font)",
                      opacity:!minutesForm.title?0.5:1 }}>
                    {saving?"Saving…":"Save minutes"}
                  </button>
                </div>
              )}

              {minutes.length===0 && !showMinutesForm ? (
                <div style={{ textAlign:"center", padding:40, color:"var(--text-3)", fontSize:13 }}>
                  No meeting minutes yet. Click "+ New minutes" to record your first meeting.
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {minutes.map(m => (
                    <div key={m.id} style={{ padding:"14px 16px", background:"var(--surface)",
                      borderRadius:"var(--radius)", border:"1px solid var(--border)" }}>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                            <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{m.title}</span>
                            <span style={{ fontSize:10, padding:"2px 7px", borderRadius:8,
                              background:"#EFF6FF", color:"var(--steel)", fontWeight:600 }}>
                              {m.meetingType?.replace("_"," ")}
                            </span>
                            <span style={{ fontSize:11, color:"var(--text-3)" }}>{fmtDate(m.meetingDate)}</span>
                          </div>
                          {(() => { const a = toText(m.attendees); return a
                            ? <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:4 }}>👥 {a}</div>
                            : null })()}
                          {(() => { const d = toText(m.decisions); return d
                            ? <div style={{ fontSize:11, color:"var(--green)", marginTop:4 }}>
                                ⚡ Decisions: {d.slice(0,100)}{d.length>100?"…":""}
                              </div>
                            : null })()}
                          {(() => { const a = toText(m.actionItems); return a
                            ? <div style={{ fontSize:11, color:"#D97706", marginTop:4 }}>
                                ✓ Actions: {a.slice(0,100)}{a.length>100?"…":""}
                              </div>
                            : null })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HANDOVER PLAN ── */}
        {activeDoc==="handover" && (
          <div style={{ background:"#fff", borderRadius:"var(--radius)", padding:24 }}>
            <SectionHeader title="Transition & Handover Plan" icon="🔄"
              standardRef="PM Best Practices — Closing Domain · Operational handover to sustaining organization" />
            <TextArea label="Handover Overview" value={handoverForm.overview}
              onChange={v=>setHandoverForm(f=>({...f,overview:v}))}
              placeholder="Summary of what is being handed over and to whom..." />
            <TextArea label="Operations Contact / Receiving Team" value={handoverForm.operationsContact}
              onChange={v=>setHandoverForm(f=>({...f,operationsContact:v}))}
              placeholder="Name, role, and contact info of the receiving team/person..." />
            <TextArea label="Systems & Deliverables Handed Over" value={handoverForm.systemsHandedOver}
              onChange={v=>setHandoverForm(f=>({...f,systemsHandedOver:v}))}
              placeholder="List all systems, products, or deliverables being handed over..." />
            <TextArea label="Documentation Provided" value={handoverForm.documentation}
              onChange={v=>setHandoverForm(f=>({...f,documentation:v}))}
              placeholder="User manuals, technical docs, training materials, runbooks..." />
            <TextArea label="Training Completed" value={handoverForm.trainingCompleted}
              onChange={v=>setHandoverForm(f=>({...f,trainingCompleted:v}))}
              placeholder="Who received training, what was covered, when completed..." />
            <TextArea label="Known Issues & Workarounds" value={handoverForm.knownIssues}
              onChange={v=>setHandoverForm(f=>({...f,knownIssues:v}))}
              placeholder="Outstanding bugs, limitations, or issues the receiving team should know about..." />
            <TextArea label="Support Arrangements" value={handoverForm.supportArrangements}
              onChange={v=>setHandoverForm(f=>({...f,supportArrangements:v}))}
              placeholder="Post-handover support: who to contact, SLAs, warranty period..." />
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Handover date</label>
              <input type="date" style={{...inp,width:"auto"}} value={handoverForm.handoverDate}
                onChange={e=>setHandoverForm(f=>({...f,handoverDate:e.target.value}))} />
            </div>
            <button onClick={saveHandover} disabled={saving}
              style={{ padding:"10px 22px", background:"var(--steel)", color:"#fff",
                border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                cursor:"pointer", fontFamily:"var(--font)" }}>
              {saving?"Saving…":"💾 Save Handover Plan"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
