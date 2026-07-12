"use client"
// src/components/mytasks/MyTasksView.tsx
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type Contribution = { id:string; content:string; createdAt:string; authorId:string; authorName:string }
type Task = {
  id:string; code:string; title:string; status:string; priority:string
  percentComplete:number; startDate:string|null; dueDate:string|null; isMilestone:boolean
  phaseName:string|null; projectId:string; projectCode:string; projectName:string
  contributions: Contribution[]
}

const STATUS_COLOR: Record<string,string> = {
  DONE:"#059669", IN_PROGRESS:"#1B6CA8", IN_REVIEW:"#7C3AED",
  TODO:"#64748B", BLOCKED:"#DC2626", CANCELLED:"#94A3B8", BACKLOG:"#94A3B8",
}
const PRIORITY_COLOR: Record<string,string> = {
  CRITICAL:"#DC2626", HIGH:"#EA580C", MEDIUM:"#2563EB", LOW:"#64748B",
}
const STATUS_OPTIONS = ["TODO","IN_PROGRESS","IN_REVIEW","BLOCKED","DONE"]

function fmt(d:string|null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", timeZone:"UTC" })
}
function timeAgo(d:string) {
  const s = Math.floor((Date.now() - new Date(d).getTime())/1000)
  if (s < 60) return "just now"
  const m = Math.floor(s/60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m/60); if (h < 24) return `${h}h ago`
  const days = Math.floor(h/24); if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", timeZone:"UTC" })
}
function isOverdue(t:Task) {
  return t.dueDate && new Date(t.dueDate) < new Date() && !["DONE","CANCELLED"].includes(t.status)
}
function dueSoon(t:Task) {
  if (!t.dueDate || ["DONE","CANCELLED"].includes(t.status)) return false
  const days = (new Date(t.dueDate).getTime() - Date.now()) / 86400000
  return days >= 0 && days <= 7
}

type SharedDoc = { id:string; name:string; fileUrl:string; fileType:string; createdAt:string; projectCode:string; projectName:string }

export function MyTasksView({ tasks, userName, userId, userLevel = 30, canOpenProject = true, sharedDocs = [] }: {
  tasks:Task[]; userName:string; userId:string; userLevel?:number; canOpenProject?:boolean; sharedDocs?:SharedDoc[]
}) {
  const [filter, setFilter]     = useState<"all"|"active"|"overdue"|"done">("active")
  const router = useRouter()
  const [rows, setRows]         = useState<Task[]>(tasks)
  const [expandedId, setExpanded] = useState<string|null>(null)
  const [noteInput, setNoteInput] = useState<Record<string,string>>({})
  const [busy, setBusy]         = useState<string>("")

  async function addNote(taskId:string) {
    const content = (noteInput[taskId]||"").trim()
    if (!content) return
    setBusy(taskId+"-note")
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const { comment } = await res.json()
        setRows(rs => rs.map(t => t.id===taskId ? { ...t, contributions:[{
          id:comment.id, content:comment.content, createdAt:comment.createdAt,
          authorId:comment.authorId, authorName:comment.author?.name || userName,
        }, ...t.contributions] } : t))
        setNoteInput(n => ({ ...n, [taskId]:"" }))
        router.refresh()
      }
    } finally { setBusy("") }
  }

  async function updateProgress(taskId:string, pct:number, status:string) {
    const prev = rows.find(t => t.id===taskId)
    setBusy(taskId+"-prog")
    setRows(rs => rs.map(t => t.id===taskId ? { ...t, percentComplete:pct, status } : t))  // optimistic
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ percentComplete:pct, status }),
      })
      if (!res.ok && prev) {
        setRows(rs => rs.map(t => t.id===taskId ? { ...t, percentComplete:prev.percentComplete, status:prev.status } : t))
        alert("Couldn't save progress — you may not have permission to update this task.")
      } else {
        router.refresh()
      }
    } finally { setBusy("") }
  }

  const counts = useMemo(() => ({
    all: rows.length,
    active: rows.filter(t => !["DONE","CANCELLED"].includes(t.status)).length,
    overdue: rows.filter(isOverdue).length,
    soon: rows.filter(dueSoon).length,
    done: rows.filter(t => t.status==="DONE").length,
  }), [rows])

  const projectCount = useMemo(() => new Set(rows.map(t => t.projectId)).size, [rows])
  const [grouped, setGrouped] = useState(true)
  const groupOn = grouped && projectCount > 1

  const visible = useMemo(() => {
    let list = rows
    if (filter==="active")  list = rows.filter(t => !["DONE","CANCELLED"].includes(t.status))
    if (filter==="overdue") list = rows.filter(isOverdue)
    if (filter==="done")    list = rows.filter(t => t.status==="DONE")
    return [...list].sort((a,b) => {
      if (groupOn && a.projectName !== b.projectName) return (a.projectName||"").localeCompare(b.projectName||"")
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
      return ad - bd
    })
  }, [rows, filter, groupOn])

  const stat = (label:string, val:number, color:string) => (
    <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)",
      padding:"12px 16px", minWidth:110 }}>
      <div style={{ fontSize:22, fontWeight:700, color }}>{val}</div>
      <div style={{ fontSize:11, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".05em" }}>{label}</div>
    </div>
  )
  const tab = (key:typeof filter, label:string, n:number) => (
    <button onClick={() => setFilter(key)}
      style={{ padding:"6px 14px", borderRadius:"var(--radius)", fontSize:13, cursor:"pointer",
        fontFamily:"var(--font)", border:"1px solid " + (filter===key ? "var(--steel)" : "var(--border)"),
        background: filter===key ? "var(--steel)" : "#fff",
        color: filter===key ? "#fff" : "var(--text-2)", fontWeight: filter===key ? 600 : 400 }}>
      {label} <span style={{ opacity:.7 }}>{n}</span>
    </button>
  )

  return (
    <div style={{ flex:1, overflowY:"auto" }}>
    <div style={{ padding:"28px 32px", maxWidth:1100, margin:"0 auto", fontFamily:"var(--font)" }}>
      <h1 style={{ fontSize:24, fontWeight:700, color:"var(--text-1)", margin:"0 0 4px" }}>My Tasks</h1>
      <p style={{ fontSize:13, color:"var(--text-3)", margin:"0 0 20px" }}>
        Your assigned work across all projects — update progress and log your contributions.
      </p>

      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        {stat("Active",   counts.active,  "#1B6CA8")}
        {stat("Overdue",  counts.overdue, "#DC2626")}
        {stat("Due ≤ 7d", counts.soon,    "#EA580C")}
        {stat("Completed",counts.done,    "#059669")}
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {tab("active","Active",counts.active)}
        {tab("overdue","Overdue",counts.overdue)}
        {tab("done","Completed",counts.done)}
        {tab("all","All",counts.all)}
        {projectCount > 1 && (
          <button onClick={() => setGrouped(g => !g)}
            style={{ marginLeft:"auto", padding:"6px 12px", borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
              fontFamily:"var(--font)", border:"1px solid " + (groupOn ? "var(--steel)" : "var(--border)"),
              background: groupOn ? "var(--steel)" : "#fff", color: groupOn ? "#fff" : "var(--text-3)" }}>
            ▤ Group by project
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        rows.length === 0 ? (
          <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)",
            padding:"44px 24px", textAlign:"center" }}>
            <div style={{ fontSize:34, marginBottom:10 }}>{userLevel >= 50 ? "🗂️" : "✅"}</div>
            <div style={{ fontSize:15, fontWeight:600, color:"var(--text-1)", marginBottom:6 }}>
              {userLevel >= 50 ? "No tasks assigned to you" : "You're all caught up"}
            </div>
            <div style={{ fontSize:13, color:"var(--text-3)", maxWidth:440, margin:"0 auto 18px", lineHeight:1.5 }}>
              {userLevel >= 50
                ? "Your work lives in the projects and portfolio you oversee. Any task assigned directly to you would appear here."
                : "No tasks are assigned to you yet. Work your project manager assigns will show up here — you'll get a notification when it does."}
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
              <Link href="/projects" style={{ padding:"8px 16px", border:"1px solid var(--border)", background:"#fff",
                borderRadius:"var(--radius)", fontSize:13, color:"var(--text-2)", textDecoration:"none", fontWeight:500 }}>
                Browse projects
              </Link>
              {userLevel >= 65 && (
                <Link href="/executive" style={{ padding:"8px 16px", border:"1px solid var(--border)", background:"#fff",
                  borderRadius:"var(--radius)", fontSize:13, color:"var(--text-2)", textDecoration:"none", fontWeight:500 }}>
                  Executive view
                </Link>
              )}
              {userLevel >= 50 && (
                <Link href="/portfolio" style={{ padding:"8px 16px", background:"var(--steel)", border:"1px solid var(--steel)",
                  borderRadius:"var(--radius)", fontSize:13, color:"#fff", textDecoration:"none", fontWeight:500 }}>
                  Portfolio
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)",
            padding:"48px 20px", textAlign:"center", color:"var(--text-3)", fontSize:14 }}>
            Nothing here — try a different filter.
          </div>
        )
      ) : (
        <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" }}>
          {visible.map((t,i) => {
            const overdue  = isOverdue(t)
            const expanded = expandedId === t.id
            const showHeader = groupOn && (i === 0 || visible[i-1].projectId !== t.projectId)
            const projTasks  = groupOn ? visible.filter(x => x.projectId === t.projectId) : []
            return (
              <div key={t.id}>
              {showHeader && (
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 16px",
                  background:"#F1F5F9", borderTop: i>0 ? "1px solid var(--border)" : "none",
                  borderBottom:"1px solid var(--border)" }}>
                  <span style={{ fontFamily:"monospace", fontSize:11, color:"var(--text-3)" }}>{t.projectCode}</span>
                  <span style={{ fontSize:12.5, fontWeight:600, color:"var(--text-1)" }}>{t.projectName}</span>
                  <span style={{ fontSize:11, color:"var(--text-3)" }}>· {projTasks.length} task{projTasks.length!==1?"s":""}</span>
                </div>
              )}
              <div style={{ borderTop: (!showHeader && i>0) ? "1px solid var(--border)" : "none" }}>
                {/* ── Row header (click to expand) ── */}
                <div onClick={() => setExpanded(expanded ? null : t.id)}
                  style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 16px", cursor:"pointer",
                    background: expanded ? "#F8FAFC" : (overdue ? "#FEF2F2" : "#fff") }}>
                  <span style={{ flexShrink:0, fontSize:10, color:"var(--text-3)", width:10 }}>{expanded ? "▼" : "▶"}</span>
                  <span style={{ flexShrink:0, color: t.isMilestone ? "#7C3AED" : (STATUS_COLOR[t.status]||"#64748B"),
                    fontSize: t.isMilestone ? 12 : 18, lineHeight:1 }}>{t.isMilestone ? "◆" : "•"}</span>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:500, color:"var(--text-1)",
                      textDecoration: t.status==="DONE" ? "line-through" : "none",
                      opacity: t.status==="DONE" ? .6 : 1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>
                      <span style={{ fontFamily:"monospace" }}>{t.projectCode}</span> · {t.projectName}
                      {t.phaseName && <> · {t.phaseName}</>}
                      {t.contributions.length > 0 && <> · 💬 {t.contributions.length}</>}
                    </div>
                  </div>

                  <span style={{ flexShrink:0, fontSize:11, fontWeight:600, color:PRIORITY_COLOR[t.priority]||"#64748B" }}>{t.priority}</span>
                  <span style={{ flexShrink:0, fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:10,
                    background:(STATUS_COLOR[t.status]||"#64748B")+"1A", color:STATUS_COLOR[t.status]||"#64748B",
                    minWidth:78, textAlign:"center" }}>{t.status.replace(/_/g," ")}</span>
                  <span style={{ flexShrink:0, fontSize:12, minWidth:74, textAlign:"right",
                    color: overdue ? "#DC2626" : "var(--text-3)", fontWeight: overdue ? 600 : 400 }}>
                    {overdue && "⚠ "}{fmt(t.dueDate)}
                  </span>
                  <div style={{ flexShrink:0, width:52 }}>
                    <div style={{ height:5, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${t.percentComplete||0}%`, background:STATUS_COLOR[t.status]||"#1B6CA8" }} />
                    </div>
                  </div>
                </div>

                {/* ── Expanded contribution panel ── */}
                {expanded && (
                  <div style={{ padding:"4px 20px 20px 44px", background:"#F8FAFC", borderTop:"1px solid var(--border)" }}>
                    {/* Update progress */}
                    <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", padding:"14px 0" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".05em" }}>Update progress</span>
                      <select value={t.status}
                        onChange={e => updateProgress(t.id, t.percentComplete||0, e.target.value)}
                        style={{ padding:"5px 8px", fontSize:12, borderRadius:"var(--radius)", border:"1px solid var(--border)",
                          fontFamily:"var(--font)", background:"#fff", color:"var(--text-1)" }}>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                      </select>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <input type="range" min={0} max={100} step={5} value={t.percentComplete||0}
                          onChange={e => setRows(rs => rs.map(x => x.id===t.id ? { ...x, percentComplete:Number(e.target.value) } : x))}
                          onMouseUp={e => updateProgress(t.id, Number((e.target as HTMLInputElement).value), t.status)}
                          onTouchEnd={e => updateProgress(t.id, Number((e.target as HTMLInputElement).value), t.status)}
                          style={{ width:160, accentColor:"var(--steel)" }} />
                        <span style={{ fontSize:12, fontWeight:600, color:"var(--text-1)", minWidth:36 }}>{t.percentComplete||0}%</span>
                      </div>
                      {canOpenProject && (
                        <Link href={`/projects/${t.projectId}`}
                          style={{ marginLeft:"auto", fontSize:12, color:"var(--steel)", textDecoration:"none", fontWeight:500 }}>
                          Open project ↗
                        </Link>
                      )}
                    </div>

                    {/* Add contribution */}
                    <div style={{ marginTop:6 }}>
                      <textarea value={noteInput[t.id]||""} rows={2}
                        onChange={e => setNoteInput(n => ({ ...n, [t.id]:e.target.value }))}
                        placeholder="Log a contribution, note, or status update on this task…"
                        style={{ width:"100%", padding:"8px 10px", fontSize:12.5, borderRadius:"var(--radius)",
                          border:"1px solid var(--border)", fontFamily:"var(--font)", color:"var(--text-1)",
                          resize:"vertical", boxSizing:"border-box" }} />
                      <div style={{ display:"flex", justifyContent:"flex-end", marginTop:6 }}>
                        <button onClick={() => addNote(t.id)} disabled={busy===t.id+"-note" || !(noteInput[t.id]||"").trim()}
                          style={{ padding:"6px 14px", fontSize:12, fontWeight:600, borderRadius:"var(--radius)",
                            border:"none", cursor:"pointer", fontFamily:"var(--font)",
                            background: (noteInput[t.id]||"").trim() ? "var(--steel)" : "var(--border)",
                            color: (noteInput[t.id]||"").trim() ? "#fff" : "var(--text-3)" }}>
                          {busy===t.id+"-note" ? "Posting…" : "Post update"}
                        </button>
                      </div>
                    </div>

                    {/* Contribution timeline */}
                    <div style={{ marginTop:10 }}>
                      {t.contributions.length === 0 ? (
                        <div style={{ fontSize:12, color:"var(--text-3)", padding:"6px 0" }}>No contributions yet — add the first one above.</div>
                      ) : (
                        t.contributions.map(c => (
                          <div key={c.id} style={{ display:"flex", gap:10, padding:"8px 0", borderTop:"1px solid var(--border)" }}>
                            <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0,
                              background: c.authorId===userId ? "var(--steel)" : "#94A3B8", color:"#fff",
                              fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
                              {(c.authorName||"?").slice(0,2).toUpperCase()}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:2 }}>
                                <span style={{ fontWeight:600, color:"var(--text-2)" }}>{c.authorId===userId ? "You" : c.authorName}</span> · {timeAgo(c.createdAt)}
                              </div>
                              <div style={{ fontSize:12.5, color:"var(--text-1)", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{c.content}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              </div>
            )
          })}
        </div>
      )}

      {sharedDocs.length > 0 && (
        <div style={{ marginTop:28 }}>
          <h2 style={{ fontSize:15, fontWeight:700, color:"var(--text-1)", margin:"0 0 4px" }}>Shared with me</h2>
          <p style={{ fontSize:12, color:"var(--text-3)", margin:"0 0 12px" }}>
            Documents your team has shared with you.
          </p>
          <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" }}>
            {sharedDocs.map((d,i) => (
              <div key={d.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 16px",
                borderTop: i>0 ? "1px solid var(--border)" : "none" }}>
                <span style={{ flexShrink:0, fontSize:18 }}>📄</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:"var(--text-1)", whiteSpace:"nowrap",
                    overflow:"hidden", textOverflow:"ellipsis" }}>{d.name}</div>
                  <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>
                    <span style={{ fontFamily:"monospace" }}>{d.projectCode}</span> · {d.projectName} · {fmt(d.createdAt)}
                  </div>
                </div>
                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer"
                  style={{ flexShrink:0, padding:"6px 12px", fontSize:12, borderRadius:"var(--radius)",
                    border:"1px solid var(--border)", background:"#fff", color:"var(--text-2)",
                    textDecoration:"none", fontFamily:"var(--font)" }}>
                  👁 Preview
                </a>
                <a href={d.fileUrl} download={d.name}
                  style={{ flexShrink:0, padding:"6px 12px", fontSize:12, borderRadius:"var(--radius)",
                    border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text-2)",
                    textDecoration:"none", fontFamily:"var(--font)" }}>
                  ↓ Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
