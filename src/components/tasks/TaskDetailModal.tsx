"use client"
// src/components/tasks/TaskDetailModal.tsx
// Stable right-side drawer panel — not a floating modal
// Opens as a fixed panel on the right side of the screen, does not float or cover the full page

import { DateField } from "@/components/shared/DatePicker"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Avatar, Badge } from "@/components/ui"

const STATUS_OPTS   = ["BACKLOG","TODO","IN_PROGRESS","IN_REVIEW","DONE","CANCELLED"]
const PRIORITY_OPTS = ["CRITICAL","HIGH","MEDIUM","LOW"]

const STATUS_COLORS: Record<string,string> = {
  BACKLOG:"#94A3B8", TODO:"#64748B", IN_PROGRESS:"#1B6CA8",
  IN_REVIEW:"#7C3AED", DONE:"#059669", CANCELLED:"#94A3B8", BLOCKED:"#DC2626"
}
const PRIORITY_COLORS: Record<string,string> = {
  CRITICAL:"#DC2626", HIGH:"#D97706", MEDIUM:"#1B6CA8", LOW:"#64748B"
}

function toDateInput(iso?: string | null) {
  if (!iso) return ""
  return new Date(iso).toISOString().split("T")[0]
}
function toISO(dateStr: string) {
  if (!dateStr) return null
  return new Date(dateStr + "T00:00:00.000Z").toISOString()
}

const inp: React.CSSProperties = {
  width:"100%", padding:"8px 10px", border:"1px solid var(--border)",
  borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
  color:"var(--text)", outline:"none", background:"#fff",
}
const sel: React.CSSProperties = {
  ...inp, appearance:"none" as const, cursor:"pointer",
  background:"#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%2394A3B8'/%3E%3C/svg%3E\") right 10px center no-repeat",
}
const lbl: React.CSSProperties = {
  display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
  textTransform:"uppercase", letterSpacing:".05em", marginBottom:5,
}
const fieldRow: React.CSSProperties = {
  marginBottom:16,
}

// ── Assignee multi-select ─────────────────────────────────────────────────

function AssigneeDropdown({ members, selectedIds, onToggle }: {
  members: any[]; selectedIds: string[]; onToggle: (uid: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    setTimeout(() => window.addEventListener("mousedown", h), 0)
    return () => window.removeEventListener("mousedown", h)
  }, [open])

  const filtered = members.filter(m => {
    const name = (m.user?.name || "").toLowerCase()
    const role = (m.projectRole || "").toLowerCase().replace(/_/g," ")
    return !search || name.includes(search.toLowerCase()) || role.includes(search.toLowerCase())
  })

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ ...inp, display:"flex", alignItems:"center", justifyContent:"space-between",
          cursor:"pointer", color:"var(--text-3)" }}>
        <span>{selectedIds.length === 0 ? "Add assignees…" : `${selectedIds.length} assigned · click to change`}</span>
        <span style={{ fontSize:10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:200,
          background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)",
          boxShadow:"0 8px 24px rgba(0,0,0,.12)", marginTop:4, overflow:"hidden" }}>
          <div style={{ padding:"8px 10px", borderBottom:"1px solid var(--border)" }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or role…"
              style={{ ...inp, fontSize:12, padding:"6px 10px" }} />
          </div>
          <div style={{ maxHeight:180, overflowY:"auto" }}>
            {filtered.map(m => {
              const uid = m.userId || m.user?.id
              const checked = selectedIds.includes(uid)
              return (
                <div key={uid} onClick={() => onToggle(uid)}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                    cursor:"pointer", background:checked?"#EFF6FF":"transparent",
                    borderBottom:"1px solid var(--surface-1,#F8FAFC)" }}
                  onMouseOver={e => { if (!checked) e.currentTarget.style.background="var(--surface)" }}
                  onMouseOut={e  => { if (!checked) e.currentTarget.style.background="transparent" }}>
                  <div style={{ width:16, height:16, borderRadius:4, flexShrink:0,
                    border:`2px solid ${checked?"var(--steel)":"var(--border)"}`,
                    background:checked?"var(--steel)":"transparent",
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {checked && <span style={{ color:"#fff", fontSize:10, lineHeight:1 }}>✓</span>}
                  </div>
                  <Avatar name={m.user?.name} avatarUrl={m.user?.avatarUrl} size={22} />
                  <div>
                    <div style={{ fontSize:12, fontWeight:500, color:"var(--text)" }}>{m.user?.name}</div>
                    <div style={{ fontSize:10, color:"var(--text-4)" }}>
                      {(m.projectRole||m.role||"").replace(/_/g," ")}
                    </div>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ padding:14, fontSize:12, color:"var(--text-3)", textAlign:"center" }}>
                No members found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export function TaskDetailModal({ taskId, projectId, allTasks, members, phases, onClose, onCommentsRead }: {
  taskId: string
  projectId: string
  allTasks: any[]
  members: any[]
  phases?: any[]
  onClose: () => void
  onCommentsRead?: (taskId: string) => void
}) {
  const router = useRouter()
  const phaseList = (phases && phases.length)
    ? phases
    : Array.from(new Map((allTasks||[]).filter((t:any)=>t.phaseId)
        .map((t:any)=>[t.phaseId, { id:t.phaseId, name:t.phase?.name || "Phase" }])).values())
  const [task,    setTask]    = useState<any>(null)
  const [form,    setForm]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState("")
  const [depPickerOpen, setDepPickerOpen] = useState(false)
  const [depSearch,     setDepSearch]     = useState("")
  const [activeTab,     setActiveTab]     = useState<"details"|"deps"|"activity">("details")
  const [visible, setVisible] = useState(false)
  const [comments,   setComments]   = useState<any[]>([])
  const [newComment, setNewComment] = useState("")
  const [postingC,   setPostingC]   = useState(false)

  // Animate in
  useEffect(() => {
    setTimeout(() => setVisible(true), 10)
  }, [])

  // Load task
  useEffect(() => {
    setLoading(true)
    fetch(`/api/tasks/${taskId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.data) { setError("Task not found"); setLoading(false); return }
        setTask(d.data)
        setForm({
          title:           d.data.title || "",
          description:     d.data.description || "",
          status:          d.data.status || "TODO",
          priority:        d.data.priority || "MEDIUM",
          phaseId:         d.data.phaseId || "",
          startDate:       toDateInput(d.data.startDate),
          dueDate:         toDateInput(d.data.dueDate),
          completedAt:     toDateInput(d.data.completedAt),
          estimatedHours:  d.data.estimatedHours ?? "",
          percentComplete: d.data.percentComplete ?? 0,
          assigneeIds:     (d.data.assignees||[]).map((a:any)=>a.projectMember?.user?.id||a.user?.id).filter(Boolean),
        })
        setLoading(false)
      })
      .catch(() => { setError("Failed to load task"); setLoading(false) })
  }, [taskId])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  async function save() {
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          title:           form.title,
          description:     form.description || null,
          status:          form.status,
          priority:        form.priority,
          phaseId:         form.phaseId || null,
          startDate:       toISO(form.startDate),
          dueDate:         toISO(form.dueDate),
          completedAt:     toISO(form.completedAt),
          estimatedHours:  form.estimatedHours === "" ? null : Number(form.estimatedHours),
          percentComplete: Number(form.percentComplete),
          assigneeIds:     form.assigneeIds,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        setError(d.error || "Save failed — check required fields")
        setSaving(false); return
      }
      router.refresh()
      handleClose()
    } catch {
      setError("Network error — please try again")
      setSaving(false)
    }
  }

  async function addDependency(precedingTaskId: string) {
    setSaving(true)
    try {
      await fetch(`/api/tasks/${taskId}/dependencies`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ precedingTaskId, dependencyType:"FS" }),
      })
      const r = await fetch(`/api/tasks/${taskId}`)
      const d = await r.json()
      setTask(d.data)
      setDepPickerOpen(false); setDepSearch(""); router.refresh()
    } finally { setSaving(false) }
  }

  async function removeDependency(depId: string) {
    setSaving(true)
    try {
      await fetch(`/api/tasks/${taskId}/dependencies/${depId}`, { method:"DELETE" })
      const r = await fetch(`/api/tasks/${taskId}`)
      const d = await r.json()
      setTask(d.data)
      router.refresh()
    } finally { setSaving(false) }
  }

  const availableForDeps = allTasks.filter(t =>
    t.id !== taskId &&
    !(task?.dependencies||[]).some((d:any) => d.precedingTaskId === t.id) &&
    (depSearch ? t.title.toLowerCase().includes(depSearch.toLowerCase()) : true)
  )

  useEffect(() => {
    if (!taskId) return
    fetch(`/api/tasks/${taskId}/comments`)
      .then(r => r.ok ? r.json() : { comments: [] })
      .then(d => setComments(d.comments || []))
    // Opening the activity log marks it as read for this user
    fetch(`/api/tasks/${taskId}/comments/read`, { method: "POST" })
      .then(() => onCommentsRead?.(taskId))
      .catch(() => {})
      .catch(() => setComments([]))
  }, [taskId])

  async function postComment() {
    const content = newComment.trim()
    if (!content) return
    setPostingC(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const { comment } = await res.json()
        setComments(cs => [comment, ...cs])
        setNewComment("")
      }
    } finally { setPostingC(false) }
  }

  const TABS = [
    { id:"details",  label:"Details"       },
    { id:"deps",     label:"Dependencies"  },
    { id:"activity", label:"Activity"      },
  ]

  return (
    <>
      {/* Dim overlay — click to close */}
      <div
        onClick={handleClose}
        style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.3)", zIndex:400,
          opacity:visible?1:0, transition:"opacity .2s" }} />

      {/* Stable right-side panel */}
      <div style={{
        position:   "fixed",
        top:        0,
        right:      0,
        bottom:     0,
        width:      "min(560px, 95vw)",
        background: "#fff",
        zIndex:     401,
        display:    "flex",
        flexDirection: "column",
        boxShadow:  "-8px 0 40px rgba(0,0,0,.15)",
        transform:  visible ? "translateX(0)" : "translateX(100%)",
        transition: "transform .2s cubic-bezier(.4,0,.2,1)",
      }}>

        {/* ── Header ── */}
        <div style={{ padding:"14px 20px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", gap:10, flexShrink:0,
          background:"#fff" }}>
          {/* Task code */}
          {task?.code && (
            <span style={{ fontSize:11, fontFamily:"monospace", color:"var(--text-4)",
              background:"var(--surface)", padding:"2px 8px", borderRadius:4 }}>
              {task.code}
            </span>
          )}
          {/* Status badge */}
          {task?.status && (
            <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:4,
              background:(STATUS_COLORS[task.status]||"#94A3B8")+"18",
              color:STATUS_COLORS[task.status]||"#94A3B8" }}>
              {task.status.replace(/_/g," ")}
            </span>
          )}
          <div style={{ flex:1 }} />
          {/* Save button in header for quick access */}
          <button type="button" onClick={save} disabled={saving||loading}
            style={{ padding:"6px 14px", background:"var(--steel)", color:"#fff",
              border:"none", borderRadius:"var(--radius)", fontSize:12, fontWeight:600,
              cursor:saving||loading?"wait":"pointer", fontFamily:"var(--font)" }}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={handleClose}
            style={{ width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center",
              background:"none", border:"none", cursor:"pointer", fontSize:18,
              color:"var(--text-3)", borderRadius:"var(--radius)" }}>
            ✕
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display:"flex", gap:0, borderBottom:"1px solid var(--border)",
          background:"#fff", flexShrink:0 }}>
          {TABS.map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as any)}
              style={{ padding:"10px 18px", fontSize:12, fontWeight:500, cursor:"pointer",
                background:"none", border:"none", borderBottom:`2px solid ${activeTab===tab.id?"var(--steel)":"transparent"}`,
                color:activeTab===tab.id?"var(--steel)":"var(--text-3)",
                fontFamily:"var(--font)", marginBottom:-1 }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ flex:1, overflowY:"auto", padding:20 }}>

          {loading ? (
            <div style={{ textAlign:"center", padding:"60px 20px", color:"var(--text-3)" }}>
              Loading task…
            </div>
          ) : error && !form ? (
            <div style={{ textAlign:"center", padding:"40px 20px" }}>
              <div style={{ color:"var(--red)", fontSize:13, marginBottom:12 }}>✗ {error}</div>
              <button onClick={handleClose}
                style={{ padding:"8px 16px", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", cursor:"pointer", fontFamily:"var(--font)",
                  fontSize:12 }}>Close</button>
            </div>
          ) : form ? (
            <>
              {error && (
                <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"var(--red)",
                  padding:"9px 12px", borderRadius:"var(--radius)", fontSize:12, marginBottom:16 }}>
                  ✗ {error}
                </div>
              )}

              {/* ── DETAILS TAB ── */}
              {activeTab === "details" && (
                <>
                  {/* Title */}
                  <div style={fieldRow}>
                    <label style={lbl}>Task title</label>
                    <input value={form.title}
                      onChange={e => setForm((f:any) => ({ ...f, title:e.target.value }))}
                      style={{ ...inp, fontSize:15, fontWeight:600 }}
                      placeholder="Task title…" />
                  </div>

                  {/* Status + Priority */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                    <div>
                      <label style={lbl}>Status</label>
                      <select style={sel} value={form.status}
                        onChange={e => setForm((f:any) => ({ ...f, status:e.target.value }))}>
                        {STATUS_OPTS.map(s => (
                          <option key={s} value={s}>{s.replace(/_/g," ")}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Priority</label>
                      <select style={sel} value={form.priority}
                        onChange={e => setForm((f:any) => ({ ...f, priority:e.target.value }))}>
                        {PRIORITY_OPTS.map(p => (
                          <option key={p} value={p} style={{ color:PRIORITY_COLORS[p] }}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Phase */}
                  <div style={fieldRow}>
                    <label style={lbl}>Phase</label>
                    <select style={sel} value={form.phaseId || ""}
                      onChange={e => setForm((f:any) => ({ ...f, phaseId:e.target.value }))}>
                      <option value="">No phase</option>
                      {phaseList.map((p:any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* % Complete */}
                  <div style={fieldRow}>
                    <label style={lbl}>Progress — {form.percentComplete}%</label>
                    <input type="range" min={0} max={100} step={5}
                      value={form.percentComplete}
                      onChange={e => setForm((f:any) => ({ ...f, percentComplete:Number(e.target.value) }))}
                      style={{ width:"100%", accentColor:"var(--steel)" }} />
                    <div style={{ display:"flex", justifyContent:"space-between",
                      fontSize:10, color:"var(--text-4)", marginTop:3 }}>
                      <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                    </div>
                  </div>

                  {/* Dates */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                    <div>
                      <label style={lbl}>Start date</label>
                      <DateField  style={inp} value={form.startDate}
                        onChange={e => setForm((f:any) => ({ ...f, startDate:e.target.value }))} />
                    </div>
                    <div>
                      <label style={lbl}>Due date</label>
                      <DateField  style={inp} value={form.dueDate}
                        onChange={e => setForm((f:any) => ({ ...f, dueDate:e.target.value }))} />
                    </div>
                  </div>

                  {/* Est hours + Completed date */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                    <div>
                      <label style={lbl}>Estimated hours</label>
                      <input type="number" min={0} step={0.5} style={inp}
                        value={form.estimatedHours}
                        onChange={e => setForm((f:any) => ({ ...f, estimatedHours:e.target.value }))}
                        placeholder="e.g. 8" />
                    </div>
                    <div>
                      <label style={lbl}>Completed on</label>
                      <DateField  style={inp} value={form.completedAt}
                        onChange={e => setForm((f:any) => ({ ...f, completedAt:e.target.value }))} />
                    </div>
                  </div>

                  {/* Description */}
                  <div style={fieldRow}>
                    <label style={lbl}>Description</label>
                    <textarea rows={4} value={form.description}
                      onChange={e => setForm((f:any) => ({ ...f, description:e.target.value }))}
                      placeholder="Add context, acceptance criteria, or notes…"
                      style={{ ...inp, resize:"vertical", lineHeight:1.6 }} />
                  </div>

                  {/* Assignees */}
                  <div style={fieldRow}>
                    <label style={lbl}>Assignees</label>
                    {/* Selected assignee tags */}
                    {form.assigneeIds.length > 0 && (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
                        {form.assigneeIds.map((uid:string) => {
                          const m = members.find(m => (m.userId||m.user?.id) === uid)
                          if (!m) return null
                          return (
                            <div key={uid} style={{ display:"flex", alignItems:"center", gap:5,
                              padding:"3px 8px", borderRadius:20, background:"#EFF6FF",
                              border:"1px solid #BFDBFE", fontSize:11, color:"var(--steel)" }}>
                              <Avatar name={m.user?.name} size={16} />
                              <span>{m.user?.name}</span>
                              <button type="button" onClick={() => {
                                setForm((f:any) => ({ ...f, assigneeIds:f.assigneeIds.filter((id:string)=>id!==uid) }))
                              }} style={{ background:"none", border:"none", cursor:"pointer",
                                color:"#93C5FD", fontSize:13, lineHeight:1, padding:0 }}>×</button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <AssigneeDropdown
                      members={members}
                      selectedIds={form.assigneeIds}
                      onToggle={uid => setForm((f:any) => ({
                        ...f,
                        assigneeIds: f.assigneeIds.includes(uid)
                          ? f.assigneeIds.filter((id:string) => id !== uid)
                          : [...f.assigneeIds, uid]
                      }))}
                    />
                  </div>
                </>
              )}

              {/* ── DEPENDENCIES TAB ── */}
              {activeTab === "deps" && (
                <div>
                  <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:14, lineHeight:1.6 }}>
                    This task is <strong>blocked by</strong> the tasks below. It cannot start until they are done.
                  </div>

                  {(task?.dependencies||[]).length === 0 ? (
                    <div style={{ textAlign:"center", padding:"30px 20px",
                      color:"var(--text-4)", fontSize:12 }}>
                      No dependencies set
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
                      {(task?.dependencies||[]).map((dep:any) => (
                        <div key={dep.id} style={{ display:"flex", alignItems:"center", gap:8,
                          padding:"10px 12px", background:"var(--surface)", borderRadius:"var(--radius)",
                          border:"1px solid var(--border)" }}>
                          <span style={{ fontSize:10,
                            padding:"2px 6px", background:"#FEF3C7", borderRadius:3,
                            fontWeight:600, color:"#92400E" }}>blocked by</span>
                          <span style={{ fontSize:11, fontFamily:"monospace",
                            color:"var(--text-3)" }}>{dep.precedingTask?.code}</span>
                          <span style={{ flex:1, fontSize:12, color:"var(--text)",
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {dep.precedingTask?.title}
                          </span>
                          <span style={{ fontSize:10, fontWeight:600, padding:"1px 6px",
                            borderRadius:4,
                            background:(STATUS_COLORS[dep.precedingTask?.status]||"#94A3B8")+"18",
                            color:STATUS_COLORS[dep.precedingTask?.status]||"#94A3B8" }}>
                            {dep.precedingTask?.status?.replace(/_/g," ")}
                          </span>
                          <button type="button" onClick={() => removeDependency(dep.id)}
                            style={{ fontSize:11, color:"var(--red)", background:"none",
                              border:"none", cursor:"pointer", fontFamily:"var(--font)", flexShrink:0 }}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="button" onClick={() => setDepPickerOpen(o=>!o)}
                    style={{ padding:"8px 16px", background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                      fontFamily:"var(--font)", color:"var(--text-2)", marginBottom:8 }}>
                    {depPickerOpen ? "Cancel" : "+ Add dependency"}
                  </button>

                  {depPickerOpen && (
                    <div style={{ border:"1px solid var(--border)", borderRadius:"var(--radius)",
                      overflow:"hidden", marginTop:4 }}>
                      <input placeholder="Search tasks…" value={depSearch} autoFocus
                        onChange={e => setDepSearch(e.target.value)}
                        style={{ ...inp, border:"none", borderBottom:"1px solid var(--border)",
                          borderRadius:0 }} />
                      <div style={{ maxHeight:200, overflowY:"auto" }}>
                        {availableForDeps.length === 0 ? (
                          <div style={{ padding:14, fontSize:12, color:"var(--text-3)", textAlign:"center" }}>
                            No tasks found
                          </div>
                        ) : availableForDeps.slice(0,20).map(t => (
                          <div key={t.id} onClick={() => addDependency(t.id)}
                            style={{ padding:"9px 12px", cursor:"pointer", display:"flex",
                              alignItems:"center", gap:8,
                              borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}
                            onMouseOver={e=>(e.currentTarget.style.background="var(--surface)")}
                            onMouseOut={e =>(e.currentTarget.style.background="transparent")}>
                            <span style={{ fontSize:10, fontFamily:"monospace",
                              color:"var(--text-3)", flexShrink:0 }}>{t.code}</span>
                            <span style={{ flex:1, fontSize:12, color:"var(--text)" }}>{t.title}</span>
                            <span style={{ fontSize:10, color:"var(--text-4)" }}>
                              {t.status?.replace(/_/g," ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "activity" && (
                <div style={{ padding:"4px 2px" }}>
                  <div style={{ marginBottom:12 }}>
                    <textarea rows={2} value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Add a note or reply to the team…"
                      style={{ width:"100%", padding:"8px 10px", fontSize:12.5, borderRadius:"var(--radius)",
                        border:"1px solid var(--border)", fontFamily:"var(--font)", color:"var(--text)",
                        resize:"vertical", boxSizing:"border-box" }} />
                    <div style={{ display:"flex", justifyContent:"flex-end", marginTop:6 }}>
                      <button type="button" onClick={postComment} disabled={postingC || !newComment.trim()}
                        style={{ padding:"6px 14px", fontSize:12, fontWeight:600, borderRadius:"var(--radius)",
                          border:"none", cursor:"pointer", fontFamily:"var(--font)",
                          background: newComment.trim() ? "var(--steel)" : "var(--border)",
                          color: newComment.trim() ? "#fff" : "var(--text-3)" }}>
                        {postingC ? "Posting…" : "Post"}
                      </button>
                    </div>
                  </div>
                  {comments.length === 0 ? (
                    <div style={{ fontSize:12, color:"var(--text-3)", padding:"8px 0" }}>No contributions yet.</div>
                  ) : comments.map(c => (
                    <div key={c.id} style={{ display:"flex", gap:10, padding:"8px 0", borderTop:"1px solid var(--border)" }}>
                      <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0, background:"var(--steel)",
                        color:"#fff", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {(c.author?.name||"?").slice(0,2).toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:2 }}>
                          <span style={{ fontWeight:600, color:"var(--text-2)" }}>{c.author?.name||"Someone"}</span>
                          {" · "}{new Date(c.createdAt).toLocaleString("en-US",{ month:"short", day:"numeric", hour:"numeric", minute:"2-digit" })}
                        </div>
                        <div style={{ fontSize:12.5, color:"var(--text)", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{c.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* ── Footer ── */}
        {form && !loading && (
          <div style={{ padding:"14px 20px", borderTop:"1px solid var(--border)",
            display:"flex", justifyContent:"space-between", alignItems:"center",
            flexShrink:0, background:"#fff" }}>
            <div style={{ fontSize:11, color:"var(--text-4)" }}>
              {task?.code} · Last updated {task?.updatedAt
                ? new Date(task.updatedAt).toLocaleDateString("en-US", {month:"short",day:"numeric", timeZone:"UTC" })
                : "—"}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button type="button" onClick={handleClose}
                style={{ padding:"8px 18px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>
                Cancel
              </button>
              <button type="button" onClick={save} disabled={saving}
                style={{ padding:"8px 22px", background:"var(--steel)", color:"#fff",
                  border:"none", borderRadius:"var(--radius)", fontSize:12, fontWeight:600,
                  cursor:saving?"wait":"pointer", fontFamily:"var(--font)",
                  opacity:saving?0.7:1 }}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
