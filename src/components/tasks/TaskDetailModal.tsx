"use client"
// src/components/tasks/TaskDetailModal.tsx
// Stable right-side drawer panel — not a floating modal
// Opens as a fixed panel on the right side of the screen, does not float or cover the full page

import { DateField } from "@/components/shared/DatePicker"
import { useLocale, useTranslations } from "next-intl"
import { enumLabel } from "@/lib/enum-labels"
import { dateLocale } from "@/lib/date-locale"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Avatar, Badge } from "@/components/ui"
import { CustomFieldsBlock, saveCustomFieldValues, type CFValues } from "@/components/shared/CustomFieldsBlock"

const STATUS_OPTS   = ["BACKLOG","TODO","IN_PROGRESS","IN_REVIEW","BLOCKED","DONE","CANCELLED"]
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
  const tk = useTranslations("taskModal")
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
              placeholder={tk("searchMemberPh")}
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
  const locale = useLocale()
  const tk = useTranslations("taskModal")
  // Control account: which budget line this work consumes. Lines with linked
  // tasks earn value from their own progress instead of the project average.
  const [budgetLines, setBudgetLines] = useState<any[]>([])
  const [blOpen, setBlOpen]   = useState(false)
  const [blQuery, setBlQuery] = useState("")
  useEffect(() => {
    fetch(`/api/projects/${projectId}/budget`)
      .then(r => r.json()).catch(() => null)
      .then(d => setBudgetLines(d?.data?.items || []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const router = useRouter()
  const phaseList = (phases && phases.length)
    ? phases
    : Array.from(new Map((allTasks||[]).filter((t:any)=>t.phaseId)
        .map((t:any)=>[t.phaseId, { id:t.phaseId, name:t.phase?.name || "Phase" }])).values())
  const [task,    setTask]    = useState<any>(null)
  const [form,    setForm]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [cfValues, setCfValues] = useState<CFValues>({})
  const [error,   setError]   = useState("")
  const [depPickerOpen, setDepPickerOpen] = useState(false)
  const [depLag, setDepLag] = useState(0)  // lag days for the next added dependency (lead = negative)
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
        if (!d.data) { setError(tk("Task not found")); setLoading(false); return }
        setTask(d.data)
        setForm({
          title:           d.data.title || "",
          description:     d.data.description || "",
          status:          d.data.status || "TODO",
          priority:        d.data.priority || "MEDIUM",
          phaseId:         d.data.phaseId || "",
          budgetItemIds:   (d.data.budgetLines?.length
                             ? d.data.budgetLines.map((l:any) => l.budgetItemId)
                             : (d.data.budgetItemId ? [d.data.budgetItemId] : [])),
          startDate:       toDateInput(d.data.startDate),
          dueDate:         toDateInput(d.data.dueDate),
          completedAt:     toDateInput(d.data.completedAt),
          estimatedHours:  d.data.estimatedHours ?? "",
          percentComplete: d.data.percentComplete ?? 0,
          assigneeIds:     (d.data.assignees||[]).map((a:any)=>a.projectMember?.user?.id||a.user?.id).filter(Boolean),
        })
        setLoading(false)
      })
      .catch(() => { setError(tk("Failed to load task")); setLoading(false) })
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
          budgetItemIds:   form.budgetItemIds || [],
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
        setError(d.error || tk("saveFailed"))
        setSaving(false); return
      }
      await saveCustomFieldValues("task", taskId, cfValues, projectId).catch(() => {})
      router.refresh()
      handleClose()
    } catch {
      setError(tk("netError"))
      setSaving(false)
    }
  }

  async function addDependency(precedingTaskId: string) {
    setSaving(true)
    try {
      await fetch(`/api/tasks/${taskId}/dependencies`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ precedingTaskId, dependencyType:"FS", lagDays: depLag || 0 }),
      })
      const r = await fetch(`/api/tasks/${taskId}`)
      const d = await r.json()
      setTask(d.data)
      setDepPickerOpen(false); setDepSearch(""); setDepLag(0); router.refresh()
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
    { id:"details",  label:tk("Details")       },
    { id:"deps",     label:tk("Dependencies")  },
    { id:"activity", label:tk("Activity")      },
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
            {saving ? tk("Saving…") : tk("Save")}
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
              {tk("Loading task…")}
            </div>
          ) : error && !form ? (
            <div style={{ textAlign:"center", padding:"40px 20px" }}>
              <div style={{ color:"var(--red)", fontSize:13, marginBottom:12 }}>✗ {error}</div>
              <button onClick={handleClose}
                style={{ padding:"8px 16px", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", cursor:"pointer", fontFamily:"var(--font)",
                  fontSize:12 }}>{tk("Close")}</button>
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
                    <label style={lbl}>{tk("Task title")}</label>
                    <input value={form.title}
                      onChange={e => setForm((f:any) => ({ ...f, title:e.target.value }))}
                      style={{ ...inp, fontSize:15, fontWeight:600 }}
                      placeholder={tk("Task title…")} />
                  </div>

                  {/* Status + Priority */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                    <div>
                      <label style={lbl}>{tk("Status")}</label>
                      <select style={sel} value={form.status}
                        onChange={e => setForm((f:any) => ({ ...f, status:e.target.value }))}>
                        {STATUS_OPTS.map(s => (
                          <option key={s} value={s}>{enumLabel(s, locale)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>{tk("Priority")}</label>
                      <select style={sel} value={form.priority}
                        onChange={e => setForm((f:any) => ({ ...f, priority:e.target.value }))}>
                        {PRIORITY_OPTS.map(p => (
                          <option key={p} value={p} style={{ color:PRIORITY_COLORS[p] }}>{enumLabel(p, locale)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Phase */}
                  <div style={fieldRow}>
                    <label style={lbl}>{tk("Phase")}</label>
                    <select style={sel} value={form.phaseId || ""}
                      onChange={e => setForm((f:any) => ({ ...f, phaseId:e.target.value }))}>
                      <option value="">{tk("No phase")}</option>
                      {phaseList.map((p:any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Budget lines (control accounts).
                      Chips worked for six lines and collapsed into a wall of text
                      at eighteen. This is a searchable list grouped by budget
                      category, with the chosen lines shown as removable tokens —
                      the shape that stays usable whether a project has three
                      lines or eighty. */}
                  {budgetLines.length > 0 && (() => {
                    const picked: string[] = form.budgetItemIds || []
                    const toggle = (id: string) => setForm((f:any) => {
                      const cur: string[] = f.budgetItemIds || []
                      return { ...f, budgetItemIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] }
                    })
                    const q = (blQuery || "").trim().toLowerCase()
                    const matches = budgetLines.filter((b:any) =>
                      !q || String(b.name).toLowerCase().includes(q) ||
                            String(b.category || "").toLowerCase().includes(q))
                    const groups: Record<string, any[]> = {}
                    for (const b of matches) {
                      const g = String(b.category || "OTHER").replace(/_/g, " ")
                      ;(groups[g] = groups[g] || []).push(b)
                    }
                    const nameOf = (id: string) =>
                      budgetLines.find((b:any) => b.id === id)?.name || tk("Budget line")

                    return (
                      <div style={fieldRow}>
                        <label style={lbl}>
                          {picked.length > 1 ? tk("budgetLinesSplit",{n:picked.length}) : tk("Budget lines")}
                        </label>

                        {/* Chosen lines, removable */}
                        {picked.length > 0 && (
                          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:7 }}>
                            {picked.map(id => (
                              <span key={id} style={{ display:"inline-flex", alignItems:"center", gap:6,
                                padding:"4px 8px 4px 11px", borderRadius:16, fontSize:12, fontWeight:600,
                                background:"#EFF6FF", border:"1px solid #BFDBFE", color:"var(--steel)" }}>
                                {nameOf(id)}
                                <button type="button" onClick={() => toggle(id)} aria-label={tk("Remove")}
                                  style={{ border:"none", background:"none", cursor:"pointer",
                                    color:"var(--steel)", fontSize:13, lineHeight:1, padding:0 }}>×</button>
                              </span>
                            ))}
                          </div>
                        )}

                        <button type="button" onClick={() => setBlOpen(o => !o)}
                          style={{ ...sel, textAlign:"left", cursor:"pointer", display:"flex",
                            alignItems:"center", justifyContent:"space-between" }}>
                          <span style={{ color: picked.length ? "var(--text)" : "var(--text-4)" }}>
                            {picked.length
                              ? `${picked.length} line${picked.length === 1 ? "" : "s"} selected`
                              : "Choose budget lines…"}
                          </span>
                          <span style={{ color:"var(--text-4)", fontSize:11 }}>{blOpen ? "▲" : "▼"}</span>
                        </button>

                        {blOpen && (
                          <div style={{ marginTop:6, border:"1px solid var(--border)", borderRadius:8,
                            background:"#fff", boxShadow:"0 10px 28px rgba(13,27,42,.12)", overflow:"hidden" }}>
                            <input autoFocus value={blQuery} placeholder={tk("Search lines…")}
                              onChange={e => setBlQuery(e.target.value)}
                              style={{ width:"100%", padding:"9px 11px", fontSize:12.5, border:"none",
                                borderBottom:"1px solid var(--border)", fontFamily:"var(--font)",
                                outline:"none", boxSizing:"border-box" }} />
                            <div style={{ maxHeight:230, overflowY:"auto" }}>
                              {Object.keys(groups).length === 0 && (
                                <div style={{ padding:"12px 12px", fontSize:12, color:"var(--text-3)" }}>
                                  No lines match "{blQuery}".
                                </div>
                              )}
                              {Object.entries(groups).map(([g, items]) => (
                                <div key={g}>
                                  <div style={{ padding:"7px 12px 4px", fontSize:10, fontWeight:800,
                                    letterSpacing:".06em", textTransform:"uppercase", color:"var(--text-4)",
                                    background:"var(--surface)" }}>{g}</div>
                                  {items.map((b:any) => {
                                    const on = picked.includes(b.id)
                                    return (
                                      <label key={b.id}
                                        style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 12px",
                                          cursor:"pointer", fontSize:12.5,
                                          background: on ? "#F5FAFF" : "transparent" }}>
                                        <input type="checkbox" checked={on} onChange={() => toggle(b.id)} />
                                        <span style={{ flex:1, color:"var(--text)" }}>{b.name}</span>
                                        <span style={{ fontSize:11, color:"var(--text-4)", fontFamily:"monospace" }}>
                                          ${Number(b.plannedCost || 0).toLocaleString()}
                                        </span>
                                      </label>
                                    )
                                  })}
                                </div>
                              ))}
                            </div>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                              padding:"7px 12px", borderTop:"1px solid var(--border)", background:"var(--surface)" }}>
                              <button type="button" onClick={() => setForm((f:any) => ({ ...f, budgetItemIds: [] }))}
                                style={{ border:"none", background:"none", cursor:"pointer", fontSize:11.5,
                                  color:"var(--text-3)", fontFamily:"var(--font)" }}>{tk("Clear")}</button>
                              <button type="button" onClick={() => { setBlOpen(false); setBlQuery("") }}
                                style={{ border:"none", background:"none", cursor:"pointer", fontSize:11.5,
                                  fontWeight:700, color:"var(--steel)", fontFamily:"var(--font)" }}>{tk("Done")}</button>
                            </div>
                          </div>
                        )}

                        {picked.length === 0 && !blOpen && (
                          <div style={{ fontSize:11, color:"var(--text-4)", marginTop:5 }}>
                            Not linked — this task's progress spreads across the whole budget instead of
                            earning value on a specific line.
                          </div>
                        )}
                      </div>
                    )
                  })()}

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
                      <label style={lbl}>{tk("Start date")}</label>
                      <DateField  style={inp} value={form.startDate}
                        onChange={e => setForm((f:any) => ({ ...f, startDate:e.target.value }))} />
                    </div>
                    <div>
                      <label style={lbl}>{tk("Due date")}</label>
                      <DateField  style={inp} value={form.dueDate}
                        onChange={e => setForm((f:any) => ({ ...f, dueDate:e.target.value }))} />
                    </div>
                  </div>

                  {/* Est hours + Completed date */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                    <div>
                      <label style={lbl}>{tk("Estimated hours")}</label>
                      <input type="number" min={0} step={0.5} style={inp}
                        value={form.estimatedHours}
                        onChange={e => setForm((f:any) => ({ ...f, estimatedHours:e.target.value }))}
                        placeholder={tk("phHours")} />
                    </div>
                    <div>
                      <label style={lbl}>{tk("Completed on")}</label>
                      <DateField  style={inp} value={form.completedAt}
                        onChange={e => setForm((f:any) => ({ ...f, completedAt:e.target.value }))} />
                    </div>
                  </div>

                  {/* Description */}
                  <div style={fieldRow}>
                    <label style={lbl}>{tk("Description")}</label>
                    <textarea rows={4} value={form.description}
                      onChange={e => setForm((f:any) => ({ ...f, description:e.target.value }))}
                      placeholder={tk("phDescription")}
                      style={{ ...inp, resize:"vertical", lineHeight:1.6 }} />
                  </div>

                  <CustomFieldsBlock entity="task" entityId={taskId}
                    values={cfValues} onChange={setCfValues} compact />

                  {/* Assignees */}
                  <div style={fieldRow}>
                    <label style={lbl}>{tk("Assignees")}</label>
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
                    {tk("blockedIntro")}
                  </div>

                  {(task?.dependencies||[]).length === 0 ? (
                    <div style={{ textAlign:"center", padding:"30px 20px",
                      color:"var(--text-4)", fontSize:12 }}>
                      {tk("No dependencies set")}
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
                      {(task?.dependencies||[]).map((dep:any) => (
                        <div key={dep.id} style={{ display:"flex", alignItems:"center", gap:8,
                          padding:"10px 12px", background:"var(--surface)", borderRadius:"var(--radius)",
                          border:"1px solid var(--border)" }}>
                          <span style={{ fontSize:10,
                            padding:"2px 6px", background:"#FEF3C7", borderRadius:3,
                            fontWeight:600, color:"#92400E" }}>{tk("blocked by")}</span>
                          <span style={{ fontSize:11, fontFamily:"monospace",
                            color:"var(--text-3)" }}>{dep.precedingTask?.code}</span>
                          {Number(dep.lagDays) !== 0 && (
                            <span title={Number(dep.lagDays) > 0 ? "Lag — mandatory wait after predecessor" : "Lead — overlap with predecessor"}
                              style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:4,
                              background:"#EFF6FF", color:"#1D4ED8", flexShrink:0 }}>
                              {Number(dep.lagDays) > 0 ? `+${dep.lagDays}d` : `${dep.lagDays}d`}
                            </span>
                          )}
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
                    {depPickerOpen ? tk("Cancel") : tk("+ Add dependency")}
                  </button>

                  {depPickerOpen && (
                    <div style={{ border:"1px solid var(--border)", borderRadius:"var(--radius)",
                      overflow:"hidden", marginTop:4 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8,
                        borderBottom:"1px solid var(--border)" }}>
                        <input placeholder={tk("Search tasks…")} value={depSearch} autoFocus
                          onChange={e => setDepSearch(e.target.value)}
                          style={{ ...inp, border:"none", borderRadius:0, flex:1 }} />
                        <label title={tk("lagTip")}
                          style={{ display:"flex", alignItems:"center", gap:4, paddingRight:10,
                          fontSize:11, color:"var(--text-3)", whiteSpace:"nowrap" }}>
                          Lag
                          <input type="number" min={-30} max={90} value={depLag}
                            onChange={e => setDepLag(parseInt(e.target.value || "0", 10) || 0)}
                            style={{ ...inp, width:56, padding:"4px 6px", fontSize:12 }} />
                          d
                        </label>
                      </div>
                      <div style={{ maxHeight:200, overflowY:"auto" }}>
                        {availableForDeps.length === 0 ? (
                          <div style={{ padding:14, fontSize:12, color:"var(--text-3)", textAlign:"center" }}>
                            {tk("No tasks found")}
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
                              {enumLabel(t.status, locale)}
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
                      placeholder={tk("phContribution")}
                      style={{ width:"100%", padding:"8px 10px", fontSize:12.5, borderRadius:"var(--radius)",
                        border:"1px solid var(--border)", fontFamily:"var(--font)", color:"var(--text)",
                        resize:"vertical", boxSizing:"border-box" }} />
                    <div style={{ display:"flex", justifyContent:"flex-end", marginTop:6 }}>
                      <button type="button" onClick={postComment} disabled={postingC || !newComment.trim()}
                        style={{ padding:"6px 14px", fontSize:12, fontWeight:600, borderRadius:"var(--radius)",
                          border:"none", cursor:"pointer", fontFamily:"var(--font)",
                          background: newComment.trim() ? "var(--steel)" : "var(--border)",
                          color: newComment.trim() ? "#fff" : "var(--text-3)" }}>
                        {postingC ? tk("Posting…") : tk("Post")}
                      </button>
                    </div>
                  </div>
                  {comments.length === 0 ? (
                    <div style={{ fontSize:12, color:"var(--text-3)", padding:"8px 0" }}>{tk("No contributions yet_")}</div>
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
                ? new Date(task.updatedAt).toLocaleDateString(dateLocale(), {month:"short",day:"numeric", timeZone:"UTC" })
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
