"use client"
// src/components/projects/tabs/ProjectTasksTab.tsx
import { useState } from "react"
import Link from "next/link"
import { Avatar, Badge, EmptyState } from "@/components/ui"

const STATUS_OPTS = ["TODO","IN_PROGRESS","IN_REVIEW","DONE","BLOCKED","CANCELLED"]
const PRIORITY_OPTS = ["CRITICAL","HIGH","MEDIUM","LOW"]
const STATUS_COLORS: Record<string,any> = {
  TODO:"gray", IN_PROGRESS:"blue", IN_REVIEW:"purple",
  DONE:"green", BLOCKED:"red", CANCELLED:"gray"
}
const PRIORITY_COLORS: Record<string,any> = {
  CRITICAL:"red", HIGH:"amber", MEDIUM:"blue", LOW:"gray"
}

export function ProjectTasksTab({ projectId, tasks, phases, members, filters }: {
  projectId:string; tasks:any[]; phases:any[]; members:any[]; filters:any
}) {
  const [search, setSearch]       = useState("")
  const [status, setStatus]       = useState(filters.status || "")
  const [priority, setPriority]   = useState(filters.priority || "")
  const [phaseFilter, setPhase]   = useState(filters.phase || "")
  const [creating, setCreating]   = useState(false)
  const [newTask, setNewTask]     = useState({ title:"", priority:"MEDIUM", phaseId:"" })

  const filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    if (status   && t.status   !== status)   return false
    if (priority && t.priority !== priority) return false
    if (phaseFilter && t.phaseId !== phaseFilter) return false
    return true
  })

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTask.title.trim()) return
    await fetch("/api/tasks", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ...newTask, projectId })
    })
    setNewTask({ title:"", priority:"MEDIUM", phaseId:"" })
    setCreating(false)
  }

  const sel: React.CSSProperties = {
    padding:"5px 24px 5px 9px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:12, fontFamily:"var(--font)",
    color:"var(--text)", appearance:"none" as const,
    background:"url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%2394A3B8'/%3E%3C/svg%3E") right 7px center no-repeat #fff",
    cursor:"pointer"
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Toolbar */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"10px 16px", display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", flexShrink:0 }}>
        <input placeholder="Search tasks…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding:"6px 10px", border:"1px solid var(--border)", borderRadius:"var(--radius)",
            fontSize:12, fontFamily:"var(--font)", outline:"none", width:180 }} />
        <select style={sel} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
        </select>
        <select style={sel} value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITY_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select style={sel} value={phaseFilter} onChange={e => setPhase(e.target.value)}>
          <option value="">All phases</option>
          {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span style={{ fontSize:12, color:"var(--text-3)", marginLeft:4 }}>
          {filtered.length} task{filtered.length!==1?"s":""}
        </span>
        <div style={{ marginLeft:"auto" }}>
          <button onClick={() => setCreating(true)}
            style={{ padding:"7px 14px", background:"var(--steel)", color:"#fff", border:"none",
              borderRadius:"var(--radius)", fontSize:12, fontWeight:500, cursor:"pointer",
              fontFamily:"var(--font)" }}>
            + Add task
          </button>
        </div>
      </div>

      {/* New task form */}
      {creating && (
        <form onSubmit={createTask}
          style={{ background:"var(--steel-pale,#EFF6FF)", borderBottom:"1px solid var(--border)",
            padding:"10px 16px", display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
          <input autoFocus placeholder="Task title…" value={newTask.title}
            onChange={e => setNewTask(n => ({ ...n, title:e.target.value }))}
            style={{ flex:1, padding:"7px 10px", border:"1px solid var(--border)", borderRadius:"var(--radius)",
              fontSize:13, fontFamily:"var(--font)", outline:"none" }} />
          <select style={sel} value={newTask.priority}
            onChange={e => setNewTask(n => ({ ...n, priority:e.target.value }))}>
            {PRIORITY_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select style={sel} value={newTask.phaseId}
            onChange={e => setNewTask(n => ({ ...n, phaseId:e.target.value }))}>
            <option value="">No phase</option>
            {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="submit"
            style={{ padding:"7px 14px", background:"var(--steel)", color:"#fff", border:"none",
              borderRadius:"var(--radius)", fontSize:12, fontWeight:500, cursor:"pointer",
              fontFamily:"var(--font)" }}>
            Add
          </button>
          <button type="button" onClick={() => setCreating(false)}
            style={{ padding:"7px 10px", background:"none", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", fontSize:12, cursor:"pointer", fontFamily:"var(--font)",
              color:"var(--text-3)" }}>
            Cancel
          </button>
        </form>
      )}

      {/* Table */}
      <div style={{ flex:1, overflowY:"auto" }}>
        {filtered.length === 0 ? (
          <EmptyState icon="✓" title="No tasks found"
            description={tasks.length === 0 ? "Add your first task to get started." : "Try adjusting your filters."} />
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"var(--surface)", position:"sticky", top:0 }}>
                {["","Code","Task","Status","Priority","Phase","Assignee","Due",""].map((h,i) => (
                  <th key={i} style={{ padding:"8px 12px", textAlign:"left",
                    fontSize:10, fontWeight:600, color:"var(--text-3)", letterSpacing:".05em",
                    textTransform:"uppercase", borderBottom:"2px solid var(--border)",
                    whiteSpace:"nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}
                  style={{ borderBottom:"1px solid var(--surface-1,#F1F5F9)", transition:"background .1s" }}
                  onMouseOver={e => (e.currentTarget.style.background="var(--surface)")}
                  onMouseOut={e  => (e.currentTarget.style.background="transparent")}>
                  <td style={{ padding:"10px 8px 10px 12px", width:20 }}>
                    <input type="checkbox" checked={t.status==="DONE"} readOnly
                      style={{ width:14, height:14, cursor:"pointer", accentColor:"var(--green)" }} />
                  </td>
                  <td style={{ padding:"10px 8px", fontSize:11, fontFamily:"monospace",
                    color:"var(--text-3)", whiteSpace:"nowrap" }}>{t.code}</td>
                  <td style={{ padding:"10px 8px", maxWidth:280 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:"var(--text)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                      textDecoration:t.status==="DONE"?"line-through":"none",
                      opacity:t.status==="DONE"?0.6:1 }}>
                      {t.title}
                    </div>
                    {t._count?.comments > 0 && (
                      <span style={{ fontSize:10, color:"var(--text-3)" }}>
                        💬 {t._count.comments}
                      </span>
                    )}
                  </td>
                  <td style={{ padding:"10px 8px" }}>
                    <Badge variant={STATUS_COLORS[t.status] || "gray"}>
                      {t.status.replace("_"," ")}
                    </Badge>
                  </td>
                  <td style={{ padding:"10px 8px" }}>
                    <Badge variant={PRIORITY_COLORS[t.priority] || "gray"}>{t.priority}</Badge>
                  </td>
                  <td style={{ padding:"10px 8px", fontSize:12, color:"var(--text-3)",
                    whiteSpace:"nowrap" }}>
                    {t.phase?.name || "—"}
                  </td>
                  <td style={{ padding:"10px 8px" }}>
                    {t.assignees?.[0] ? (
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <Avatar name={t.assignees[0].user.name}
                          avatarUrl={t.assignees[0].user.avatarUrl} size={22} />
                        <span style={{ fontSize:11, color:"var(--text-2)" }}>
                          {t.assignees[0].user.name.split(" ")[0]}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize:11, color:"var(--text-4)" }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ padding:"10px 8px", fontSize:12, whiteSpace:"nowrap",
                    color: t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "DONE"
                      ? "var(--red)" : "var(--text-3)" }}>
                    {t.dueDate
                      ? new Date(t.dueDate).toLocaleDateString("en-US",{month:"short",day:"numeric"})
                      : "—"}
                  </td>
                  <td style={{ padding:"10px 8px" }}>
                    <button style={{ fontSize:11, color:"var(--steel)", background:"none", border:"none",
                      cursor:"pointer", fontFamily:"var(--font)" }}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
