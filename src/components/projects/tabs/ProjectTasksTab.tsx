"use client"
// src/components/projects/tabs/ProjectTasksTab.tsx
// Full redesign per PM best practices — phase headers, context menu, hierarchy,
// critical path, dependencies, phase filter, searchable assignee

import { useTranslations } from "next-intl"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { DatePickerPopover } from "@/components/shared/DatePicker"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/ui"
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal"
import { useTaskContextSafe } from "@/lib/context/TaskContext"
import { computeCriticalPath } from "@/lib/projects/critical-path"

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_OPTS   = ["BACKLOG","TODO","IN_PROGRESS","IN_REVIEW","DONE","CANCELLED"]
const PRIORITY_OPTS = ["CRITICAL","HIGH","MEDIUM","LOW"]

const STATUS_COLOR: Record<string,{bg:string;text:string;label:string}> = {
  BACKLOG:     { bg:"#F8FAFC", text:"#94A3B8", label:"Backlog"     },
  TODO:        { bg:"#F1F5F9", text:"#64748B", label:"To Do"       },
  IN_PROGRESS: { bg:"#EFF6FF", text:"#1B6CA8", label:"In Progress" },
  IN_REVIEW:   { bg:"#F5F3FF", text:"#7C3AED", label:"In Review"   },
  DONE:        { bg:"#ECFDF5", text:"#059669", label:"Done"        },
  BLOCKED:     { bg:"#FEF2F2", text:"#DC2626", label:"Blocked"     },
  CANCELLED:   { bg:"#F8FAFC", text:"#94A3B8", label:"Cancelled"   },
}
const PRIORITY_COLOR: Record<string,{color:string;label:string}> = {
  CRITICAL: { color:"#DC2626", label:"Critical" },
  HIGH:     { color:"#F59E0B", label:"High"     },
  MEDIUM:   { color:"#1B6CA8", label:"Medium"   },
  LOW:      { color:"#94A3B8", label:"Low"      },
}
const DEP_TYPES = ["FS","SS","FF","SF"] as const
const DEP_LABEL: Record<string,string> = {
  FS:"Finish → Start", SS:"Start → Start", FF:"Finish → Finish", SF:"Start → Finish"
}

function fmtDate(d?: string|null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"})
}
function isOverdue(t: any) {
  return t.dueDate && new Date(t.dueDate) < new Date() && !["DONE","CANCELLED"].includes(t.status)
}

// ── Column sorting helpers ─────────────────────────────────────────────────
const SORT_STATUS   = ["BACKLOG","TODO","IN_PROGRESS","IN_REVIEW","DONE","CANCELLED"]
const SORT_PRIORITY = ["CRITICAL","HIGH","MEDIUM","LOW"]
const SORTABLE_COLS = ["Task Name","Status","Priority","Assignee","Duration","Start","Finish","% Done","Hours"]
function assigneeName(t:any): string {
  const a = t.assignees?.[0]
  return (a?.projectMember?.user?.name || a?.user?.name || "").toLowerCase()
}
function durOf(t:any): number {
  return (t.startDate && t.dueDate)
    ? (new Date(t.dueDate).getTime() - new Date(t.startDate).getTime())
    : -1
}
function dateVal(d:any): number { return d ? new Date(d).getTime() : Number.POSITIVE_INFINITY }
function compareTasks(a:any, b:any, col:string): number {
  switch(col) {
    case "Task Name": return (a.title||"").localeCompare(b.title||"")
    case "Status":    return SORT_STATUS.indexOf(a.status)   - SORT_STATUS.indexOf(b.status)
    case "Priority":  return SORT_PRIORITY.indexOf(a.priority) - SORT_PRIORITY.indexOf(b.priority)
    case "Assignee":  return assigneeName(a).localeCompare(assigneeName(b))
    case "Duration":  return durOf(a) - durOf(b)
    case "Start":     return dateVal(a.startDate) - dateVal(b.startDate)
    case "Finish":    return dateVal(a.dueDate)   - dateVal(b.dueDate)
    case "% Done":    return (a.percentComplete||0) - (b.percentComplete||0)
    case "Hours":     return (Number(a.estimatedHours)||0) - (Number(b.estimatedHours)||0)
    default:          return (a.sortOrder||0) - (b.sortOrder||0)
  }
}

// ── Context Menu ───────────────────────────────────────────────────────────

function ContextMenu({ x, y, task, onAction, onClose }: {
  x:number; y:number; task:any;
  onAction:(action:string,task:any)=>void; onClose:()=>void
}) {
  useEffect(() => {
    // Use mousedown (not click) and bubble phase (not capture)
    // so menu item onClick fires BEFORE this closes the menu
    const h = (e: MouseEvent) => {
      const target = e.target as Element
      // Don't close if click is inside the menu
      if (target.closest?.("[data-ctx-menu]")) return
      onClose()
    }
    // Small delay so the item click registers first
    const timer = setTimeout(() => {
      window.addEventListener("mousedown", h)
    }, 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("mousedown", h)
    }
  }, [onClose])

  const items = [
    { action:"add-above",     label:"↑ Add task above",         divider:false },
    { action:"add-below",     label:"↓ Add task below",         divider:false },
    { action:"add-child",     label:"⤷ Add child task",         divider:true  },
    { action:"indent",        label:"→ Indent (make subtask)",   divider:false },
    { action:"outdent",       label:"← Outdent (promote)",      divider:false },
    { action:"move-up",       label:"▲ Move up",                divider:true  },
    { action:"move-down",     label:"▼ Move down",              divider:false },
    { action:"mark-complete", label:"✓ Mark complete",          divider:true  },
    { action:"to-milestone",  label:"◇ Convert to milestone",   divider:false },
    { action:"edit",          label:"✏ Edit task",              divider:true  },
    { action:"delete",        label:"🗑 Delete",                 divider:false, danger:true },
  ]

  const menuStyle: React.CSSProperties = {
    position:"fixed", left:x, top:y, zIndex:500,
    background:"#fff", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", boxShadow:"0 8px 24px rgba(0,0,0,.15)",
    minWidth:200, overflow:"hidden",
  }

  return (
    <div style={menuStyle} data-ctx-menu="true" onClick={e => e.stopPropagation()}>
      {items.map(item => (
        <div key={item.action}>
          {item.divider && <div style={{ height:1, background:"var(--border)", margin:"2px 0" }} />}
          <div onClick={() => { onAction(item.action, task); onClose() }}
            style={{ padding:"8px 14px", fontSize:12, cursor:"pointer",
              color:(item as any).danger ? "var(--red)" : "var(--text-2)",
              fontFamily:"var(--font)" }}
            onMouseOver={e => (e.currentTarget.style.background = (item as any).danger ? "#FEF2F2" : "var(--surface)")}
            onMouseOut={e  => (e.currentTarget.style.background = "transparent")}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Phase filter multi-select ──────────────────────────────────────────────

function PhaseFilterDropdown({ phases, selected, onChange }: {
  phases:any[]; selected:Set<string>; onChange:(s:Set<string>)=>void
}) {
  const [open, setOpen] = useState(false)
  const allSelected = selected.size === 0

  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(o=>!o)}
        style={{ padding:"5px 10px", border:"1px solid var(--border)",
          borderRadius:"var(--radius)", fontSize:12, fontFamily:"var(--font)",
          background:"#fff", cursor:"pointer", color:"var(--text-2)",
          display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
        📋 {allSelected ? "All phases" : `${selected.size} phase${selected.size!==1?"s":""}`}
        <span style={{ fontSize:9 }}>{open?"▲":"▼"}</span>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"100%", left:0, zIndex:100, marginTop:4,
          background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)",
          boxShadow:"0 8px 24px rgba(0,0,0,.12)", minWidth:200, overflow:"hidden" }}
          onClick={e => e.stopPropagation()}>
          <div style={{ padding:"6px 12px", borderBottom:"1px solid var(--border)",
            display:"flex", gap:10 }}>
            <button onClick={() => onChange(new Set())}
              style={{ fontSize:11, color:"var(--steel)", background:"none", border:"none",
                cursor:"pointer", fontFamily:"var(--font)" }}>All</button>
            <button onClick={() => onChange(new Set(phases.map(p=>p.id)))}
              style={{ fontSize:11, color:"var(--text-3)", background:"none", border:"none",
                cursor:"pointer", fontFamily:"var(--font)" }}>None</button>
          </div>
          {phases.map(p => {
            // Visible-phase model: empty set = all shown; otherwise show only phases in the set.
            // This matches the task filter (phaseFilter.has(p.id) => visible).
            const checked = selected.size === 0 || selected.has(p.id)
            return (
              <div key={p.id} onClick={() => {
                const next = new Set(selected)
                if (selected.size === 0) {
                  // currently "all shown" — unchecking one means: show every OTHER phase
                  phases.forEach(ph => { if (ph.id !== p.id) next.add(ph.id) })
                } else if (next.has(p.id)) {
                  next.delete(p.id)   // uncheck → hide this phase
                } else {
                  next.add(p.id)      // check → show this phase
                }
                if (next.size === phases.length) next.clear() // all shown → clear filter (back to "All")
                onChange(next)
              }}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px",
                  cursor:"pointer", fontSize:12, color:"var(--text-2)" }}
                onMouseOver={e=>(e.currentTarget.style.background="var(--surface)")}
                onMouseOut={e =>(e.currentTarget.style.background="transparent")}>
                <input type="checkbox" checked={checked} readOnly
                  style={{ accentColor:"var(--steel)", width:13, height:13 }} />
                {p.name}
              </div>
            )
          })}
          <div style={{ padding:"6px 12px", borderTop:"1px solid var(--border)" }}>
            <button onClick={() => setOpen(false)}
              style={{ fontSize:11, color:"var(--text-3)", background:"none", border:"none",
                cursor:"pointer", fontFamily:"var(--font)" }}>Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export function ProjectTasksTab({ projectId, tasks, phases, members, workspaceId, filters }: {
  projectId:string; tasks:any[]; phases:any[]; members:any[];
  workspaceId:string; filters:any
}) {
  const router = useRouter()
  const taskCtx = useTaskContextSafe()
  const [localTasks, setLocalTasks] = useState(tasks)
  const [openTaskId, setOpenTaskId] = useState<string|null>(null)
  const [moving, setMoving]         = useState(false)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set())
  const [ctxMenu, setCtxMenu]       = useState<{x:number;y:number;task:any}|null>(null)
  const [phaseFilter, setPhaseFilter] = useState<Set<string>>(new Set())
  const tt = useTranslations("tasksTab")
  const [search, setSearch]         = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [creating, setCreating]     = useState<{phaseId?:string;parentId?:string;insertAfter?:string}|null>(null)
  const [newTitle, setNewTitle]     = useState("")
  const [newPriority, setNewPriority] = useState("MEDIUM")
  const [newPhaseId, setNewPhaseId] = useState("")
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState("")
  const [excelOpen, setExcelOpen]   = useState(false)
  const [sortBy, setSortBy]         = useState<{col:string;dir:1|-1}|null>(null)
  const [groupBy, setGroupBy]       = useState<"phase"|"status"|"priority"|"assignee">("phase")
  const dragTaskId = useRef<string|null>(null)
  const [focusedCell, setFocusedCell] = useState<{taskId:string; col:string}|null>(null)
  const [editNonce, setEditNonce]     = useState(0)
  const KB_COLS = ["status","priority","assignee","startDate","finishDate","percentComplete"]
  const refreshTimer = useRef<any>(null)
  // One re-sync after activity settles, instead of a full refetch per action
  function debouncedRefresh() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => router.refresh(), 1200)
  }
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting]   = useState(false)
  const [importMsg, setImportMsg]   = useState("")

  useEffect(() => { setLocalTasks(taskCtx ? taskCtx.applyUpdates(tasks) : tasks) }, [tasks, taskCtx])

  // Critical path — computed via the shared helper so the Tasks grid and the Gantt
  // always mark the same tasks (also honors the manual "Mark critical path" flag).
  const criticalSet = useMemo(() => computeCriticalPath(localTasks), [localTasks])

  // ── API helpers ─────────────────────────────────────────────────────────

  async function persistReorder(updated: any[]) {
    // Renumber sortOrder to match the new order so the grid reorders immediately
    // (buildRows sorts by sortOrder, not array position)
    const renumbered = updated.map((t, i) => ({ ...t, sortOrder: i }))
    setLocalTasks(renumbered)
    // Keep the optimistic overlay in sync so a background refresh can't snap
    // rows back to their pre-move position while the reorder is persisting.
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    renumbered.forEach((t, i) =>
      taskCtx?.updateTask(t.id, { sortOrder: i, parentId: t.parentId ?? null, phaseId: t.phaseId ?? null }))
    setMoving(true)
    try {
      await fetch(`/api/projects/${projectId}/tasks/reorder`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          updates: renumbered.map((t,i) => ({
            id:t.id, sortOrder:i, parentId:t.parentId??null, phaseId:t.phaseId??null,
          })),
        }),
      })
      // No router.refresh() here — the optimistic renumber above already reflects
      // the new order and it's now persisted; a refresh only caused a visible re-settle.
    } finally { setMoving(false) }
  }

  async function patchTask(taskId: string, data: any) {
    taskCtx?.updateTask(taskId, data)   // optimistic — show change immediately
    await fetch(`/api/tasks/${taskId}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(data),
    })
    debouncedRefresh()
  }

  async function deleteTask(taskId: string) {
    if (!confirm("Delete this task?")) return
    setLocalTasks(prev => prev.filter(t => t.id !== taskId))   // optimistic removal
    await fetch(`/api/tasks/${taskId}`, { method:"DELETE" })
    debouncedRefresh()
  }

  async function convertToMilestone(task: any) {
    // Option 2: a milestone is a zero-duration task that stays in the grid.
    if (task.isMilestone) {
      await patchTask(task.id, { isMilestone: false })   // toggle back to a normal task
      return
    }
    const ms = task.dueDate || task.startDate
    if (!ms) { alert("Task needs a start or due date to make it a milestone."); return }
    const iso = new Date(ms).toISOString()
    await patchTask(task.id, { isMilestone: true, startDate: iso, dueDate: iso })
  }

  async function toggleCritical(task: any) {
    await patchTask(task.id, { isCriticalPath: !task.isCriticalPath })
  }
  async function bulkToggleCritical() {
    const list = localTasks.filter(t => selected.has(t.id))
    list.forEach(t => taskCtx?.updateTask(t.id, { isCriticalPath: !t.isCriticalPath }))  // all at once
    clearSelection()
    await Promise.all(list.map(t => fetch(`/api/tasks/${t.id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ isCriticalPath: !t.isCriticalPath }),
    })))
    debouncedRefresh()
  }

  function moveTask(taskId: string, dir: "up"|"down") {
    const list = [...localTasks]
    const task = list.find(t => t.id === taskId)
    if (!task) return
    const sibs = list.filter(t => t.phaseId===task.phaseId && t.parentId===task.parentId)
      .sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0))
    const si = sibs.findIndex(t => t.id === taskId)
    if (dir==="up" && si===0) return
    if (dir==="down" && si===sibs.length-1) return
    const swap = sibs[dir==="up" ? si-1 : si+1]
    const ai = list.findIndex(t => t.id===taskId)
    const bi = list.findIndex(t => t.id===swap.id)
    ;[list[ai],list[bi]] = [list[bi],list[ai]]
    setLocalTasks(list)
    persistReorder(list)
  }

  function indentTask(taskId: string) {
    const list = [...localTasks]
    const task = list.find(t => t.id===taskId)
    if (!task) return
    const sibs = list.filter(t => t.phaseId===task.phaseId && t.parentId===task.parentId)
      .sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0))
    const si = sibs.findIndex(t => t.id===taskId)
    if (si===0) return
    const newParent = sibs[si-1]
    const updated = list.map(t => t.id===taskId ? {...t,parentId:newParent.id} : t)
    setLocalTasks(updated)
    persistReorder(updated)
  }

  function outdentTask(taskId: string) {
    const list = [...localTasks]
    const task = list.find(t => t.id===taskId)
    if (!task?.parentId) return
    const parent = list.find(t => t.id===task.parentId)
    const updated = list.map(t => t.id===taskId ? {...t,parentId:parent?.parentId??null} : t)
    setLocalTasks(updated)
    persistReorder(updated)
  }

  // Selected task ids in visual (sortOrder) order — for deterministic bulk ops
  function orderedSelected(): string[] {
    return localTasks
      .filter(t => selected.has(t.id))
      .sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0))
      .map(t => t.id)
  }

  function bulkIndent() {
    let list = [...localTasks]
    for (const id of orderedSelected()) {
      const task = list.find(t => t.id===id); if (!task) continue
      const sibs = list.filter(t => t.phaseId===task.phaseId && t.parentId===task.parentId)
        .sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0))
      const si = sibs.findIndex(t => t.id===id)
      if (si <= 0) continue                       // first among siblings can't indent
      const newParent = sibs[si-1]
      list = list.map(t => t.id===id ? {...t, parentId:newParent.id} : t)
    }
    setLocalTasks(list)
    persistReorder(list)
  }

  function bulkOutdent() {
    let list = [...localTasks]
    for (const id of orderedSelected()) {
      const task = list.find(t => t.id===id); if (!task?.parentId) continue
      const parent = list.find(t => t.id===task.parentId)
      list = list.map(t => t.id===id ? {...t, parentId: parent?.parentId ?? null} : t)
    }
    setLocalTasks(list)
    persistReorder(list)
  }

  // Drag a row onto another to reorder (adopts target's phase → also moves across phases)
  function handleRowDrop(targetId: string) {
    const srcId = dragTaskId.current
    dragTaskId.current = null
    if (!srcId || srcId === targetId) return
    const list = [...localTasks]
    const target = list.find(t => t.id === targetId)
    const fromIdx = list.findIndex(t => t.id === srcId)
    if (!target || fromIdx < 0) return
    const [moved] = list.splice(fromIdx, 1)
    moved.phaseId  = target.phaseId ?? null
    moved.parentId = target.parentId ?? null
    const insertAt = list.findIndex(t => t.id === targetId)
    list.splice(insertAt, 0, moved)
    setLocalTasks(list)
    persistReorder(list)
  }

  // Move all selected tasks up/down one position as a cohesive block
  function bulkMove(dir: "up"|"down") {
    const list = [...localTasks]
    const ids = dir==="up" ? orderedSelected() : [...orderedSelected()].reverse()
    for (const id of ids) {
      const task = list.find(t => t.id===id); if (!task) continue
      const sibs = list
        .filter(t => t.phaseId===task.phaseId && t.parentId===task.parentId)
        .sort((a,b) => list.indexOf(a) - list.indexOf(b))
      const si = sibs.findIndex(t => t.id===id)
      const swap = dir==="up" ? sibs[si-1] : sibs[si+1]
      if (!swap || selected.has(swap.id)) continue   // keep the block together
      const ai = list.findIndex(t => t.id===task.id)
      const bi = list.findIndex(t => t.id===swap.id)
      ;[list[ai], list[bi]] = [list[bi], list[ai]]
    }
    setLocalTasks(list)
    persistReorder(list)
  }

  async function createTask() {
    if (!newTitle.trim()) return
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/tasks", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          title:    newTitle,
          priority: newPriority,
          projectId,
          phaseId:  creating?.phaseId || newPhaseId || null,
          parentId: creating?.parentId || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        setError(d.error || "Failed to create task"); return
      }
      const created = (await res.json().catch(()=>({}))).data
      const c = creating
      setNewTitle(""); setCreating(null)
      // Position relative to a reference row (Add above / Add below)
      if (created?.id && c?.insertAfter) {
        const above = c.insertAfter.startsWith("above-")
        const refId = above ? c.insertAfter.slice(6) : c.insertAfter
        const list = [...localTasks]
        const refIdx = list.findIndex(t => t.id===refId)
        if (refIdx >= 0) {
          list.splice(above ? refIdx : refIdx+1, 0, created)
          setLocalTasks(list)
          await persistReorder(list)
          return
        }
      }
      router.refresh()
    } catch { setError("Network error") }
    finally { setSaving(false) }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true); setImportMsg("")
    const fd = new FormData(); fd.append("file", file)
    try {
      const res = await fetch(`/api/projects/${projectId}/import`, { method:"POST", body:fd })
      const d = await res.json()
      setImportMsg(res.ok
        ? `✓ ${d.summary.created||0} created, ${d.summary.updated||0} updated`
        : `✗ ${d.error||"Import failed"}`)
      if (res.ok) router.refresh()
    } catch { setImportMsg("✗ Upload failed") }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value="" }
  }

  // ── Context menu actions ─────────────────────────────────────────────────

  function handleContextAction(action: string, task: any) {
    switch(action) {
      case "add-above":    setCreating({ phaseId:task.phaseId, insertAfter:"above-"+task.id }); setNewTitle(""); setNewPhaseId(task.phaseId||""); break
      case "add-below":    setCreating({ phaseId:task.phaseId, insertAfter:task.id }); setNewTitle(""); setNewPhaseId(task.phaseId||""); break
      case "add-child":    setCreating({ phaseId:task.phaseId, parentId:task.id }); setNewTitle(""); setNewPhaseId(task.phaseId||""); break
      case "indent":       indentTask(task.id); break
      case "outdent":      outdentTask(task.id); break
      case "move-up":      moveTask(task.id, "up"); break
      case "move-down":    moveTask(task.id, "down"); break
      case "mark-complete":patchTask(task.id, { status:"DONE", percentComplete:100 }); break
      case "to-milestone": convertToMilestone(task); break
      case "toggle-critical": toggleCritical(task); break
      case "edit":         setOpenTaskId(task.id); break
      case "delete":       deleteTask(task.id); break
    }
  }

  // ── Selection ────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  function selectAll() {
    setSelected(new Set(filteredRows.map(r => r.task.id)))
  }
  function clearSelection() { setSelected(new Set()) }

  async function bulkMarkComplete() {
    const ids = [...selected]
    ids.forEach(id => taskCtx?.updateTask(id, { status:"DONE", percentComplete:100 }))  // all at once
    clearSelection()
    await Promise.all(ids.map(id => fetch(`/api/tasks/${id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ status:"DONE", percentComplete:100 }),
    })))
    debouncedRefresh()
  }
  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} tasks?`)) return
    const ids = new Set(selected)
    setLocalTasks(prev => prev.filter(t => !ids.has(t.id)))   // optimistic removal
    await Promise.all([...ids].map(id => fetch(`/api/tasks/${id}`, { method:"DELETE" })))
    clearSelection(); debouncedRefresh()
  }

  // ── Filtering + grouping ─────────────────────────────────────────────────

  const phaseMap = new Map(phases.map(p => [p.id, p]))

  // Build flat row list: {task, depth, phaseId}
  type Row = { task:any; depth:number }

  function buildRows(parentId: string|null, phaseId: string|null, depth: number): Row[] {
    const rows: Row[] = []
    const children = localTasks
      .filter(t => (t.parentId??null) === parentId && (t.phaseId??null) === phaseId)
      .sort((a,b) => sortBy
        ? sortBy.dir * compareTasks(a, b, sortBy.col)
        : (a.sortOrder||0)-(b.sortOrder||0))
    for (const t of children) {
      rows.push({ task:t, depth })
      if (!collapsed.has(t.id)) {
        rows.push(...buildRows(t.id, phaseId, depth+1))
      }
    }
    return rows
  }

  function toggleSort(col: string) {
    if (!SORTABLE_COLS.includes(col)) return
    setSortBy(prev => {
      if (!prev || prev.col !== col) return { col, dir: 1 }
      if (prev.dir === 1) return { col, dir: -1 }
      return null
    })
  }

  // Apply filters
  function matchesFilter(t: any): boolean {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter   && t.status   !== statusFilter)   return false
    if (priorityFilter && t.priority !== priorityFilter) return false
    return true
  }

  // Build phase groups
  const allPhaseIds = [...new Set(localTasks.map(t => t.phaseId??null))]

  // Phase list: seeded phases + any tasks without a phase
  const displayPhases = [
    ...phases.filter(p => {
      if (phaseFilter.size > 0 && !phaseFilter.has(p.id)) return false
      return true
    }),
  ]
  const hasUnphased = localTasks.some(t => !t.phaseId)

  // Rows visible in the main table
  const filteredRows: Row[] = []
  for (const phase of displayPhases) {
    if (collapsed.has("phase-"+phase.id)) continue
    const rows = buildRows(null, phase.id, 0).filter(r => matchesFilter(r.task))
    filteredRows.push(...rows)
  }
  if (hasUnphased && phaseFilter.size === 0) {
    const rows = buildRows(null, null, 0).filter(r => matchesFilter(r.task))
    filteredRows.push(...rows)
  }

  const totalVisible = filteredRows.length
  // Tasks matching the active filters, independent of group collapse — so
  // collapsing all groups doesn't read as "0 tasks / No tasks match".
  const matchingCount = localTasks.filter(t => matchesFilter(t)).length

  // Shared row renderer (used by both phase and group views)
  const renderRow = ({ task: t, depth }: Row) => (
    <TaskRow key={t.id} task={t} depth={depth}
      selected={selected.has(t.id)}
      isCritical={criticalSet.has(t.id) && !["DONE","CANCELLED"].includes(t.status)}
      members={members} projectId={projectId}
      onSelect={() => toggleSelect(t.id)}
      onEdit={() => setOpenTaskId(t.id)}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x:e.clientX, y:e.clientY, task:t }) }}
      onAction={(action) => handleContextAction(action, t)}
      onCellSaved={() => debouncedRefresh()}
                      onDragStartRow={() => { dragTaskId.current = t.id }}
                      onDropRow={() => handleRowDrop(t.id)}
                      onTouchDrop={(targetId) => handleRowDrop(targetId)}
                      focusedCol={focusedCell && focusedCell.taskId === t.id ? focusedCell.col : null}
                      editNonce={focusedCell?.taskId === t.id ? editNonce : 0}
                      onFocusCell={(col) => setFocusedCell({ taskId: t.id, col })}
    />
  )

  // Grouped view (status / priority / assignee) — flat groups
  const groupedBlocks = (() => {
    if (groupBy === "phase") return [] as { key:string; label:string; rows:Row[]; pct:number }[]
    const flat = localTasks.filter(t => matchesFilter(t))
      .sort((a,b) => sortBy ? sortBy.dir*compareTasks(a,b,sortBy.col) : (a.sortOrder||0)-(b.sortOrder||0))
    const keyOf = (t:any) => groupBy==="status" ? (t.status||"—")
      : groupBy==="priority" ? (t.priority||"—")
      : ((t.assignees?.[0]?.projectMember?.user?.name || t.assignees?.[0]?.user?.name) || "Unassigned")
    const map = new Map<string, any[]>()
    for (const t of flat) { const k = keyOf(t); if(!map.has(k)) map.set(k,[]); map.get(k)!.push(t) }
    return [...map.entries()].map(([key, tasks]) => ({
      key,
      label: key.replace(/_/g," "),
      rows: tasks.map(t => ({ task:t, depth:0 })) as Row[],
      pct: tasks.length ? Math.round(tasks.reduce((s,t)=>s+(t.percentComplete||0),0)/tasks.length) : 0,
    }))
  })()

  // Ordered list of visible task ids (mirrors render order) — for keyboard nav
  const flatVisibleIds: string[] = (() => {
    const ids: string[] = []
    if (groupBy !== "phase") {
      for (const g of groupedBlocks) {
        if (!collapsed.has("grp-"+g.key)) for (const r of g.rows) ids.push(r.task.id)
      }
    } else {
      for (const phase of displayPhases) {
        if (collapsed.has("phase-"+phase.id)) continue
        for (const r of buildRows(null, phase.id, 0).filter(r => matchesFilter(r.task))) ids.push(r.task.id)
      }
      if (hasUnphased && phaseFilter.size === 0 && !collapsed.has("phase-unphased")) {
        for (const r of buildRows(null, null, 0).filter(r => matchesFilter(r.task))) ids.push(r.task.id)
      }
    }
    return ids
  })()

  function moveFocus(dRow:number, dCol:number) {
    setFocusedCell(fc => {
      if (!fc) { const first = flatVisibleIds[0]; return first ? { taskId:first, col:KB_COLS[0] } : null }
      const ri = flatVisibleIds.indexOf(fc.taskId)
      const ci = KB_COLS.indexOf(fc.col)
      const nRi = Math.max(0, Math.min(flatVisibleIds.length-1, ri + dRow))
      const nCi = Math.max(0, Math.min(KB_COLS.length-1, ci + dCol))
      return { taskId: flatVisibleIds[nRi] || fc.taskId, col: KB_COLS[nCi] }
    })
  }

  function fillDown() {
    if (!focusedCell) return
    const src = localTasks.find(t => t.id === focusedCell.taskId)
    if (!src) return
    const col = focusedCell.col
    if (col === "assignee") return   // multi-assignee handled via its checklist
    const field = col === "finishDate" ? "dueDate" : col
    const value = (src as any)[field]
    const targets = [...selected].filter(id => id !== focusedCell.taskId)
    if (!targets.length) return
    for (const id of targets) {
      taskCtx?.updateTask(id, { [field]: value })
      fetch(`/api/tasks/${id}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ [field]: value }),
      })
    }
    debouncedRefresh()
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return   // don't hijack typing
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); fillDown(); return }
    switch (e.key) {
      case "ArrowDown":  e.preventDefault(); moveFocus(1, 0);  break
      case "ArrowUp":    e.preventDefault(); moveFocus(-1, 0); break
      case "ArrowRight": e.preventDefault(); moveFocus(0, 1);  break
      case "ArrowLeft":  e.preventDefault(); moveFocus(0, -1); break
      case "Tab":        e.preventDefault(); moveFocus(0, e.shiftKey ? -1 : 1); break
      case "Enter":      if (focusedCell) { e.preventDefault(); setEditNonce(n => n+1) } break
      case "Escape":     setFocusedCell(null); break
    }
  }
  const sel = {
    padding:"5px 10px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:12, fontFamily:"var(--font)",
    color:"var(--text-2)", background:"#fff", cursor:"pointer",
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}
      onClick={() => { setCtxMenu(null); setExcelOpen(false) }}>

      {/* ── Toolbar ── */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"8px 14px", display:"flex", gap:8, flexWrap:"wrap",
        alignItems:"center", flexShrink:0 }}>

        <input placeholder={tt("Search tasks…")} value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding:"6px 10px", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", fontSize:12, fontFamily:"var(--font)",
            outline:"none", width:170 }} />

        <select style={sel} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
        </select>

        <select style={sel} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITY_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <PhaseFilterDropdown
          phases={phases}
          selected={phaseFilter}
          onChange={setPhaseFilter}
        />

        <div style={{ display:"flex", gap:4 }}>
          <button onClick={() => setCollapsed(new Set())}
            style={{ padding:"5px 10px", border:"1px solid var(--border)", borderRadius:"var(--radius)",
              fontSize:12, background:"#fff", cursor:"pointer", color:"var(--text-2)", fontFamily:"var(--font)" }}>
            Expand all
          </button>
          <button onClick={() => setCollapsed(groupBy === "phase"
              ? new Set([...phases.map((p:any)=>"phase-"+p.id), "phase-unphased"])
              : new Set(groupedBlocks.map(g => "grp-"+g.key)))}
            style={{ padding:"5px 10px", border:"1px solid var(--border)", borderRadius:"var(--radius)",
              fontSize:12, background:"#fff", cursor:"pointer", color:"var(--text-2)", fontFamily:"var(--font)" }}>
            Collapse all
          </button>
        </div>

        <select style={sel} value={groupBy} onChange={e=>setGroupBy(e.target.value as any)}
          title="Group tasks by">
          <option value="phase">Group: Phase</option>
          <option value="status">Group: Status</option>
          <option value="priority">Group: Priority</option>
          <option value="assignee">Group: Assignee</option>
        </select>

        <span style={{ fontSize:12, color:"var(--text-3)" }}>
          {matchingCount} task{matchingCount!==1?"s":""}
        </span>

        {selected.size > 0 && (
          <div style={{ display:"flex", gap:6, padding:"4px 10px",
            background:"#EFF6FF", borderRadius:"var(--radius)", alignItems:"center" }}>
            <span style={{ fontSize:11, fontWeight:600, color:"var(--steel)" }}>
              {selected.size} selected
            </span>
            <button onClick={clearSelection}
              style={{ fontSize:11, color:"var(--text-3)", background:"none", border:"none",
                cursor:"pointer", fontFamily:"var(--font)" }}>✕</button>
          </div>
        )}

        {importMsg && (
          <span style={{ fontSize:11, color:importMsg.startsWith("✓")?"var(--green)":"var(--red)" }}>
            {importMsg}
          </span>
        )}

        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display:"none" }}
            onChange={handleImport} />

          {/* Excel menu */}
          <div style={{ position:"relative" }}>
            <button onClick={e => { e.stopPropagation(); setExcelOpen(o=>!o) }}
              style={{ ...sel, display:"flex", alignItems:"center", gap:4 }}>
              {importing ? "Importing…" : "📊 Excel"} <span style={{ fontSize:9 }}>▾</span>
            </button>
            {excelOpen && (
              <div style={{ position:"absolute", top:"100%", right:0, marginTop:4, zIndex:100,
                background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)",
                boxShadow:"0 8px 24px rgba(0,0,0,.12)", minWidth:200, overflow:"hidden" }}
                onClick={e => e.stopPropagation()}>
                <a href={`/api/projects/${projectId}/export`}
                  onClick={() => setExcelOpen(false)}
                  style={{ display:"block", padding:"9px 14px", fontSize:12, color:"var(--text)",
                    textDecoration:"none", borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}
                  onMouseOver={e=>(e.currentTarget.style.background="var(--surface)")}
                  onMouseOut={e =>(e.currentTarget.style.background="transparent")}>
                  📤 Export to Excel
                </a>
                <button onClick={() => { setExcelOpen(false); fileRef.current?.click() }}
                  style={{ display:"block", width:"100%", textAlign:"left", padding:"9px 14px",
                    fontSize:12, color:"var(--text)", background:"none", border:"none",
                    cursor:"pointer", fontFamily:"var(--font)",
                    borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}
                  onMouseOver={e=>(e.currentTarget.style.background="var(--surface)")}
                  onMouseOut={e =>(e.currentTarget.style.background="transparent")}>
                  📥 Import from Excel
                </button>
                <a href={`/api/projects/${projectId}/import/template`}
                  onClick={() => setExcelOpen(false)}
                  style={{ display:"block", padding:"9px 14px", fontSize:12,
                    color:"var(--steel)", textDecoration:"none" }}
                  onMouseOver={e=>(e.currentTarget.style.background="var(--surface)")}
                  onMouseOut={e =>(e.currentTarget.style.background="transparent")}>
                  📋 Download template
                </a>
              </div>
            )}
          </div>

          <button onClick={() => { setCreating({}); setNewTitle(""); setNewPhaseId(phases[0]?.id||"") }}
            style={{ padding:"7px 14px", background:"var(--steel)", color:"#fff", border:"none",
              borderRadius:"var(--radius)", fontSize:12, fontWeight:500, cursor:"pointer",
              fontFamily:"var(--font)" }}>
            {tt("+ Add task")}
          </button>
        </div>
      </div>

      {/* ── Contextual action toolbar — shows only when tasks are selected ── */}
      {selected.size > 0 && (
      <div style={{ background:"#1B6CA8", borderBottom:"1px solid #1558a0",
        padding:"4px 10px", display:"flex", gap:0, alignItems:"center",
        flexShrink:0, overflowX:"auto" }}>
        {[
          { label:"Add Task Above",       action:"add-above",     always:false, single:true },
          { label:"Add Task Below",       action:"add-below",     always:false, single:true },
          { label:"Add Child",            action:"add-child",     always:false, single:true },
          { label:"Indent",               action:"indent",        always:false },
          { label:"Outdent",              action:"outdent",       always:false },
          { label:"Move Up",              action:"move-up",       always:false },
          { label:"Move Down",            action:"move-down",     always:false },
          { label:"Mark Complete",        action:"mark-complete", always:false },
          { label:"Convert to Milestone", action:"to-milestone",  always:false },
          { label:"Critical Path",        action:"toggle-critical", always:false },
          { label:"Edit",                 action:"edit",          always:false, single:true },
          { label:"Delete",               action:"delete",        always:false },
        ].map((btn, i) => {
          const hasSelection = selected.size > 0
          const needsSingle = (btn as any).single === true
          const enabled = btn.always || (needsSingle ? selected.size === 1 : hasSelection)
          const isDelete = btn.action==="delete"
          const blockedMulti = needsSingle && selected.size > 1
          return (
            <button key={i} type="button"
              disabled={!enabled}
              title={blockedMulti ? "Select a single task for this action" : undefined}
              onClick={() => {
                if (!enabled) return
                if (btn.action==="toggle-critical") { bulkToggleCritical(); return }
                // Multi-target actions operate on ALL selected tasks
                if (btn.action==="delete")        { bulkDelete(); return }
                if (btn.action==="mark-complete") { bulkMarkComplete(); return }
                if (btn.action==="indent")        { bulkIndent(); return }
                if (btn.action==="outdent")       { bulkOutdent(); return }
                if (btn.action==="move-up")       { bulkMove("up"); return }
                if (btn.action==="move-down")     { bulkMove("down"); return }
                const firstId = [...selected][0]
                const firstTask = localTasks.find(t=>t.id===firstId)
                if (needsSingle && selected.size !== 1) return   // single-target guard
                if (btn.action==="edit" && firstTask) { setOpenTaskId(firstId); return }
                // Single-target actions (add above/below/child, move, milestone)
                if (firstTask) handleContextAction(btn.action, firstTask)
              }}
              style={{
                padding:"4px 10px", fontSize:11, fontWeight:500, cursor:enabled?"pointer":"not-allowed",
                border:"none", borderRight:"1px solid rgba(255,255,255,.15)",
                background: !enabled ? "rgba(0,0,0,.15)"
                  : isDelete ? "#DC2626"
                  : needsSingle ? "rgba(129,199,245,.32)"
                  : "rgba(255,255,255,.12)",
                color: !enabled ? "rgba(255,255,255,.35)" : "#fff",
                fontFamily:"var(--font)", whiteSpace:"nowrap",
                transition:"background .1s",
              }}
              onMouseOver={e => { if (enabled && !isDelete) e.currentTarget.style.background = needsSingle ? "rgba(129,199,245,.5)" : "rgba(255,255,255,.22)" }}
              onMouseOut={e => { if (enabled && !isDelete) e.currentTarget.style.background = needsSingle ? "rgba(129,199,245,.32)" : "rgba(255,255,255,.12)" }}>
              {btn.label}
            </button>
          )
        })}
      </div>
      )}
      {creating !== null && (
        <div style={{ background:"#EFF6FF", borderBottom:"1px solid var(--border)",
          padding:"8px 14px", display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
          {error && <span style={{ fontSize:11, color:"var(--red)" }}>✗ {error}</span>}
          <input autoFocus placeholder={
            creating.parentId ? "Child task title…" :
            creating.insertAfter?.startsWith("above-") ? "Task title (above)…" :
            "Task title…"}
            value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key==="Enter") createTask(); if (e.key==="Escape") setCreating(null) }}
            style={{ flex:1, padding:"7px 10px", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)", outline:"none" }} />
          <select style={sel} value={newPriority} onChange={e => setNewPriority(e.target.value)}>
            {PRIORITY_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {!creating.phaseId && (
            <select style={sel} value={newPhaseId} onChange={e => setNewPhaseId(e.target.value)}>
              <option value="">No phase</option>
              {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button onClick={createTask} disabled={saving||!newTitle.trim()}
            style={{ padding:"7px 14px", background:"var(--steel)", color:"#fff",
              border:"none", borderRadius:"var(--radius)", fontSize:12,
              cursor:saving?"wait":"pointer", fontFamily:"var(--font)",
              opacity:!newTitle.trim()?0.5:1 }}>
            {saving ? "Adding…" : "Add"}
          </button>
          <button onClick={() => setCreating(null)}
            style={{ padding:"7px 10px", background:"none", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
              fontFamily:"var(--font)", color:"var(--text-3)" }}>
            Cancel
          </button>
        </div>
      )}

      {/* ── Task table ── */}
      <div style={{ flex:1, overflowY:"auto", outline:"none" }} tabIndex={0} onKeyDown={onGridKeyDown}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#1a3a5c", position:"sticky", top:0, zIndex:10 }}>
              <th style={{ width:32, padding:"8px 8px 8px 14px" }}>
                <input type="checkbox"
                  checked={selected.size > 0 && selected.size === totalVisible}
                  onChange={e => e.target.checked ? selectAll() : clearSelection()}
                  style={{ width:13, height:13, accentColor:"#fff", cursor:"pointer" }} />
              </th>
              {["#","Task Name","Status","Priority","Assignee","Duration","Start","Finish","% Done","Hours"].map((h,i) => {
                const sortable = SORTABLE_COLS.includes(h)
                const active = sortBy?.col === h
                return (
                <th key={i} onClick={() => sortable && toggleSort(h)}
                  title={sortable ? "Click to sort" : undefined}
                  style={{ padding:"9px 10px", textAlign:"left", fontSize:10,
                  fontWeight:700, color: active ? "#fff" : "rgba(255,255,255,.65)",
                  textTransform:"uppercase", letterSpacing:".06em",
                  borderBottom:"2px solid rgba(255,255,255,.1)",
                  whiteSpace:"nowrap", cursor: sortable ? "pointer" : "default",
                  userSelect:"none" }}>
                  {h}{active && <span style={{ marginLeft:4 }}>{sortBy?.dir===1?"▲":"▼"}</span>}
                </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {groupBy !== "phase" && groupedBlocks.map(g => (
              <Phase key={g.key} phase={{ id:g.key, name:g.label }}
                isCollapsed={collapsed.has("grp-"+g.key)} rowCount={g.rows.length} pct={g.pct}
                onToggle={() => setCollapsed(s => { const n=new Set(s); n.has("grp-"+g.key)?n.delete("grp-"+g.key):n.add("grp-"+g.key); return n })}
                onAddTask={() => {}}>
                {!collapsed.has("grp-"+g.key) && g.rows.map(renderRow)}
              </Phase>
            ))}

            {groupBy === "phase" && displayPhases.map(phase => {
              const phaseRows = buildRows(null, phase.id, 0).filter(r => matchesFilter(r.task))
              if (phaseRows.length === 0 && !matchesFilter({title:"",status:"",priority:""})) return null
              const isCollapsed = collapsed.has("phase-"+phase.id)
              const phaseTasks = localTasks.filter(t => (t.phaseId??null) === phase.id)
              const phasePct = phaseTasks.length
                ? Math.round(phaseTasks.reduce((s,t)=>s+(t.percentComplete||0),0)/phaseTasks.length)
                : 0

              return (
                <Phase key={phase.id} phase={phase} isCollapsed={isCollapsed}
                  rowCount={phaseRows.length} pct={phasePct}
                  onToggle={() => setCollapsed(s => {
                    const n = new Set(s)
                    n.has("phase-"+phase.id) ? n.delete("phase-"+phase.id) : n.add("phase-"+phase.id)
                    return n
                  })}
                  onAddTask={() => { setCreating({ phaseId:phase.id }); setNewTitle(""); setNewPhaseId(phase.id) }}>
                  {!isCollapsed && phaseRows.map(({ task:t, depth }) => (
                    <TaskRow key={t.id} task={t} depth={depth}
                      selected={selected.has(t.id)}
                      isCritical={criticalSet.has(t.id) && !["DONE","CANCELLED"].includes(t.status)}
                      members={members}
                      projectId={projectId}
                      onSelect={() => toggleSelect(t.id)}
                      onEdit={() => setOpenTaskId(t.id)}
                      onContextMenu={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        setCtxMenu({ x:e.clientX, y:e.clientY, task:t })
                      }}
                      onAction={(action) => handleContextAction(action, t)}
                      onCellSaved={() => debouncedRefresh()}
                      onDragStartRow={() => { dragTaskId.current = t.id }}
                      onDropRow={() => handleRowDrop(t.id)}
                      onTouchDrop={(targetId) => handleRowDrop(targetId)}
                      focusedCol={focusedCell && focusedCell.taskId === t.id ? focusedCell.col : null}
                      editNonce={focusedCell?.taskId === t.id ? editNonce : 0}
                      onFocusCell={(col) => setFocusedCell({ taskId: t.id, col })}
                    />
                  ))}
                </Phase>
              )
            })}

            {/* Unphased tasks */}
            {groupBy === "phase" && hasUnphased && phaseFilter.size === 0 && (() => {
              const rows = buildRows(null, null, 0).filter(r => matchesFilter(r.task))
              if (!rows.length) return null
              const unphasedTasks = localTasks.filter(t => !t.phaseId)
              const unphasedPct = unphasedTasks.length
                ? Math.round(unphasedTasks.reduce((s,t)=>s+(t.percentComplete||0),0)/unphasedTasks.length)
                : 0
              return (
                <Phase key="unphased" phase={{ id:"unphased", name:"No Phase" }}
                  isCollapsed={collapsed.has("phase-unphased")} rowCount={rows.length} pct={unphasedPct}
                  onToggle={() => setCollapsed(s => {
                    const n = new Set(s)
                    n.has("phase-unphased") ? n.delete("phase-unphased") : n.add("phase-unphased")
                    return n
                  })}
                  onAddTask={() => { setCreating({}); setNewTitle(""); setNewPhaseId("") }}>
                  {!collapsed.has("phase-unphased") && rows.map(({ task:t, depth }) => (
                    <TaskRow key={t.id} task={t} depth={depth}
                      selected={selected.has(t.id)}
                      isCritical={criticalSet.has(t.id) && !["DONE","CANCELLED"].includes(t.status)}
                      members={members}
                      projectId={projectId}
                      onSelect={() => toggleSelect(t.id)}
                      onEdit={() => setOpenTaskId(t.id)}
                      onContextMenu={e => {
                        e.preventDefault(); e.stopPropagation()
                        setCtxMenu({ x:e.clientX, y:e.clientY, task:t })
                      }}
                      onAction={(action) => handleContextAction(action, t)}
                      onCellSaved={() => debouncedRefresh()}
                      onDragStartRow={() => { dragTaskId.current = t.id }}
                      onDropRow={() => handleRowDrop(t.id)}
                      onTouchDrop={(targetId) => handleRowDrop(targetId)}
                      focusedCol={focusedCell && focusedCell.taskId === t.id ? focusedCell.col : null}
                      editNonce={focusedCell?.taskId === t.id ? editNonce : 0}
                      onFocusCell={(col) => setFocusedCell({ taskId: t.id, col })}
                    />
                  ))}
                </Phase>
              )
            })()}

            {matchingCount === 0 && (
              <tr>
                <td colSpan={11} style={{ padding:"60px 20px", textAlign:"center",
                  fontSize:13, color:"var(--text-3)" }}>
                  {localTasks.length === 0
                    ? "No tasks yet — click \"+ Add task\" to get started."
                    : "No tasks match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Context menu ── */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} task={ctxMenu.task}
          onAction={handleContextAction}
          onClose={() => setCtxMenu(null)} />
      )}

      {/* ── Task edit modal ── */}
      {openTaskId && (
        <TaskDetailModal
          taskId={openTaskId}
          projectId={projectId}
          allTasks={localTasks}
          members={members}
          phases={phases}
          onClose={() => { setOpenTaskId(null); router.refresh() }}
                  onCommentsRead={(id: string) => setLocalTasks(prev => prev.map((t: any) => t.id === id ? { ...t, unreadComments: 0 } : t))}
        />
      )}
    </div>
  )
}

// ── Phase header row ───────────────────────────────────────────────────────

function Phase({ phase, isCollapsed, rowCount, pct = 0, onToggle, onAddTask, children }: {
  phase:any; isCollapsed:boolean; rowCount:number; pct?:number;
  onToggle:()=>void; onAddTask:()=>void; children?:React.ReactNode
}) {
  const pctColor = pct === 100 ? "#059669" : pct >= 50 ? "#1B6CA8" : "#60A5FA"
  return (
    <>
      <tr style={{ background:"#EFF6FF", cursor:"pointer" }} onClick={onToggle}>
        <td colSpan={11} style={{ padding:"0" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10,
            padding:"8px 14px", borderBottom:"1px solid #BFDBFE",
            borderLeft:"4px solid #1B6CA8" }}>
            {/* Collapse arrow */}
            <span style={{ fontSize:10, color:"#1B6CA8", fontWeight:700,
              flexShrink:0, lineHeight:1, userSelect:"none",
              transform:isCollapsed?"rotate(-90deg)":"rotate(0deg)",
              display:"inline-block", transition:"transform .15s" }}>
              ▼
            </span>
            {/* Phase color pill */}
            <div style={{ width:3, height:16, borderRadius:2, background:"#1B6CA8", flexShrink:0 }} />
            <span style={{ fontSize:11, fontWeight:700, color:"#1E3A8A",
              textTransform:"uppercase", letterSpacing:".07em" }}>
              {phase.name}
            </span>
            <span style={{ fontSize:10, color:"#93C5FD", background:"#DBEAFE",
              padding:"1px 7px", borderRadius:10, fontWeight:600 }}>
              {rowCount} task{rowCount!==1?"s":""}
            </span>
            {/* Phase completion */}
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:70, height:6, background:"#DBEAFE", borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:pctColor,
                  borderRadius:3, transition:"width .3s" }} />
              </div>
              <span style={{ fontSize:10, fontWeight:700, color:pctColor }}>{pct}%</span>
            </div>
            <div style={{ flex:1 }} />
            {!isCollapsed && (
              <button onClick={e => { e.stopPropagation(); onAddTask() }}
                style={{ fontSize:11, color:"#1B6CA8", fontWeight:600,
                  background:"#fff", border:"1px solid #BFDBFE",
                  borderRadius:4, cursor:"pointer",
                  fontFamily:"var(--font)", padding:"3px 12px" }}>
                + Add Task
              </button>
            )}
          </div>
        </td>
      </tr>
      {children}
    </>
  )
}

// ── Task action ⋯ dropdown ─────────────────────────────────────────────────

function TaskActionMenu({ task, onAction, onEdit, onContextMenu }: {
  task:any; onAction:(a:string)=>void; onEdit:()=>void;
  onContextMenu:(e:React.MouseEvent)=>void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    setTimeout(() => window.addEventListener("mousedown", h), 0)
    return () => window.removeEventListener("mousedown", h)
  }, [open])

  const items = [
    { action:"edit",          label:"Edit",             icon:"✏️", divider:false },
    { action:"add-above",     label:"Add task above",   icon:"⬆",  divider:true  },
    { action:"add-below",     label:"Add task below",   icon:"⬇",  divider:false },
    { action:"add-child",     label:"Add subtask",      icon:"↳",  divider:true  },
    { action:"indent",        label:"Indent",           icon:"→",  divider:false },
    { action:"outdent",       label:"Outdent",          icon:"←",  divider:false },
    { action:"move-up",       label:"Move up",          icon:"▲",  divider:true  },
    { action:"move-down",     label:"Move down",        icon:"▼",  divider:false },
    { action:"mark-complete", label:"Mark complete",    icon:"✓",  divider:true  },
    { action:"to-milestone",  label:"Make milestone",   icon:"◆",  divider:false },
    { action:"toggle-critical", label:"Mark critical path", icon:"⚡", divider:true  },
    { action:"delete",        label:"Delete",           icon:"🗑",  divider:true, danger:true },
  ]

  return (
    <div ref={ref} style={{ position:"relative", display:"inline-block" }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o=>!o) }}
        title="Task actions"
        style={{ padding:"4px 8px", fontSize:16, fontWeight:700,
          cursor:"pointer", borderRadius:4,
          border:`1px solid ${open?"#BFDBFE":"#E2E8F0"}`,
          background: open ? "#EFF6FF" : "#fff",
          color: open ? "#1B6CA8" : "#94A3B8",
          fontFamily:"var(--font)", lineHeight:1,
          transition:"all .1s" }}>
        ···
      </button>
      {open && (
        <div style={{ position:"absolute", right:0, top:"calc(100% + 4px)",
          zIndex:400, background:"#fff", border:"1px solid #E2E8F0",
          borderRadius:8, boxShadow:"0 8px 32px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06)",
          minWidth:180, overflow:"hidden", padding:"4px 0" }}>
          {items.map(item => (
            <div key={item.action}>
              {item.divider && <div style={{ height:1, background:"#F1F5F9", margin:"4px 0" }} />}
              <div
                onClick={e => {
                  e.stopPropagation()
                  setOpen(false)
                  if (item.action === "edit") { onEdit(); return }
                  onAction(item.action)
                }}
                style={{ padding:"7px 14px", fontSize:12, cursor:"pointer",
                  color:(item as any).danger ? "#DC2626" : "#374151",
                  fontFamily:"var(--font)", display:"flex", alignItems:"center", gap:10 }}
                onMouseOver={e=>(e.currentTarget.style.background=(item as any).danger?"#FEF2F2":"#F8FAFC")}
                onMouseOut={e =>(e.currentTarget.style.background="transparent")}>
                <span style={{ width:14, textAlign:"center", fontSize:11, opacity:.7 }}>{(item as any).icon}</span>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Task row ──────────────────────────────────────────────────────────────

function TaskRow({ task:t, depth, selected, isCritical, members, projectId,
  onSelect, onEdit, onContextMenu, onAction, onCellSaved, onDragStartRow, onDropRow, onTouchDrop,
  focusedCol, editNonce, onFocusCell }: {
  task:any; depth:number; selected:boolean; isCritical:boolean; members:any[];
  projectId:string;
  onSelect:()=>void; onEdit:()=>void;
  onContextMenu:(e:React.MouseEvent)=>void;
  onAction:(action:string)=>void;
  onCellSaved:()=>void;
  onDragStartRow?:()=>void;
  onDropRow?:()=>void;
  onTouchDrop?:(targetId:string)=>void;
  focusedCol?:string|null;
  editNonce?:number;
  onFocusCell?:(col:string)=>void;
}) {
  const taskCtx     = useTaskContextSafe()
  const [hover,       setHover]       = useState(false)
  const [editingCell, setEditingCell] = useState<string|null>(null)
  const [menuUp, setMenuUp] = useState(false)
  const [cellValue,   setCellValue]   = useState<any>(null)
  const tt = useTranslations("tasksTab")
  const dateCommitTimer = useRef<any>(null)
  const [saving,      setSaving]      = useState(false)

  const isDone       = t.status === "DONE"
  const overdue      = isOverdue(t)
  const sc           = STATUS_COLOR[t.status]  || STATUS_COLOR.TODO
  const pc           = PRIORITY_COLOR[t.priority] || PRIORITY_COLOR.MEDIUM
  const assignee     = t.assignees?.[0]
  const assigneeUser = assignee?.projectMember?.user || assignee?.user
  const depCount     = (t.dependencies||[]).length
  const depLabel     = depCount > 0
    ? `Blocked by ${(t.dependencies||[]).map((d:any) => (d.precedingTask?.code||"?") + (Number(d.lagDays) ? ` ${Number(d.lagDays)>0?"+":""}${d.lagDays}d` : "")).join(", ")}`
    : null

  // ── Inline cell save ─────────────────────────────────────────────
  async function saveCell(field: string, value: any) {
    setSaving(true)
    // Optimistic update — reflect change immediately in both tabs
    const patch: any = {}
    if (field === "status")          patch.status = value
    if (field === "priority")        patch.priority = value
    if (field === "percentComplete") patch.percentComplete = Number(value)
    if (field === "estimatedHours") patch.estimatedHours = (value===""||value==null) ? null : Number(value)
    if (field === "startDate")       patch.startDate = value ? new Date(value+"T00:00:00Z").toISOString() : null
    if (field === "dueDate")         patch.dueDate   = value ? new Date(value+"T00:00:00Z").toISOString() : null
    if (field === "assignee") {
      const ids = Array.isArray(value) ? value : (value ? [value] : [])
      patch.assignees = ids.map((id:string) => {
        const m = members.find((mm:any)=>(mm.userId||mm.user?.id)===id)
        return { projectMember: { user: m?.user } }
      })
    }
    if (taskCtx) taskCtx.updateTask(t.id, patch)
    try {
      const body: any = field === "assignee"
        ? { assigneeIds: Array.isArray(value) ? value : (value ? [value] : []) }
        : { ...patch }
      const res = await fetch(`/api/tasks/${t.id}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(body),
      })
      if (!res.ok && taskCtx) taskCtx.clearUpdate(t.id)   // revert optimistic if server rejected
      setEditingCell(null)
      onCellSaved()
    } catch {
      if (taskCtx) taskCtx.clearUpdate(t.id)
    } finally { setSaving(false) }
  }

  function startEdit(cell: string, initialValue: any) {
    setEditingCell(cell)
    setCellValue(initialValue)
  }

  function cancelEdit() { setEditingCell(null); setCellValue(null) }

  // Keyboard: start editing the focused column when Enter is pressed (editNonce bumps)
  function startEditCol(col: string) {
    if (editingCell) return
    if (col==="status")               startEdit("status", t.status)
    else if (col==="priority")        startEdit("priority", t.priority)
    else if (col==="assignee")        startEdit("assignee", (t.assignees||[]).map((a:any)=>a.projectMember?.user?.id||a.user?.id).filter(Boolean))
    else if (col==="startDate")       startEdit("startDate", toDateInput(t.startDate))
    else if (col==="finishDate")      startEdit("finishDate", toDateInput(t.dueDate))
    else if (col==="percentComplete") startEdit("percentComplete", t.percentComplete||0)
  }
  useEffect(() => {
    if (editNonce && focusedCol) startEditCol(focusedCol)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editNonce])

  const ring = (c:string): React.CSSProperties =>
    focusedCol===c ? { outline:"2px solid #1B6CA8", outlineOffset:"-2px", background:"#EFF6FF" } : {}

  // ── Cell styles ──────────────────────────────────────────────────
  const cellInp: React.CSSProperties = {
    padding:"3px 6px", fontSize:12, border:"2px solid var(--steel)",
    borderRadius:4, fontFamily:"var(--font)", color:"var(--text)",
    background:"#fff", outline:"none", width:"100%",
  }
  const cellSel: React.CSSProperties = {
    ...cellInp, cursor:"pointer", appearance:"none" as const,
  }

  const toDateInput = (iso: string|null|undefined) => {
    if (!iso) return ""
    try { return new Date(iso).toISOString().split("T")[0] } catch { return "" }
  }

  return (
    <tr
      data-taskid={t.id}
      style={{ background: selected ? "#EFF6FF" : isCritical ? "#FFF9F9" : hover ? "#F8FAFC" : "#fff",
        borderBottom:"1px solid #F1F5F9",
        transition:"background .1s" }}
      onMouseEnter={() => { setHover(true); taskCtx?.selectTask(t.id) }}
      onMouseLeave={() => setHover(false)}
      onDragOver={onDropRow ? (e)=>e.preventDefault() : undefined}
      onDrop={onDropRow ? ()=>onDropRow() : undefined}
      onContextMenu={onContextMenu}>

      {/* Checkbox */}
      <td style={{ padding:"6px 8px 6px 14px", width:32 }}>
        <input type="checkbox" checked={selected} onChange={onSelect}
          style={{ width:13, height:13, accentColor:"var(--steel)", cursor:"pointer" }} />
      </td>

      {/* Row number / code */}
      <td style={{ padding:"8px 10px", whiteSpace:"nowrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <span draggable={!!onDragStartRow} onDragStart={()=>onDragStartRow?.()}
            onTouchStart={() => onDragStartRow?.()}
            onTouchMove={(e) => { if (e.cancelable) e.preventDefault() }}
            onTouchEnd={(e) => {
              const t0 = e.changedTouches[0]; if (!t0) return
              const el = document.elementFromPoint(t0.clientX, t0.clientY) as HTMLElement | null
              const row = el?.closest("[data-taskid]")
              const targetId = row?.getAttribute("data-taskid")
              if (targetId) onTouchDrop?.(targetId)
            }}
            title="Drag to reorder"
            style={{ cursor:"grab", color:"#CBD5E1", fontSize:12, lineHeight:1, userSelect:"none", touchAction:"none" }}>⠿</span>
          <span style={{ fontFamily:"monospace", fontSize:10, color:"#94A3B8",
            background:"#F8FAFC", padding:"2px 5px", borderRadius:3,
            border:"1px solid #E2E8F0" }}>
            {t.code}
          </span>
          {isCritical && (
            <span title="Critical path" style={{ color:"#DC2626", fontSize:9, fontWeight:700 }}>⚡</span>
          )}
          {t.isMilestone && (
            <span title="Milestone" style={{ color:"#7C3AED", fontSize:11, fontWeight:700, lineHeight:1 }}>◆</span>
          )}
        </div>
      </td>

      {/* Task name with indent */}
      <td style={{ padding:"8px 10px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6,
          paddingLeft: depth * 18 }}>
          {/* Hierarchy connector */}
          {depth > 0 && (
            <div style={{ width:14, height:16, borderLeft:"2px solid #CBD5E1",
              borderBottom:"2px solid #CBD5E1", marginRight:2, flexShrink:0,
              borderBottomLeftRadius:2, marginTop:-6 }} />
          )}
          {/* Status color dot */}
          <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0,
            background:sc.text, opacity:.85 }} />
          <div style={{ minWidth:0, flex:1 }}>
            <div onClick={onEdit}
              style={{ fontSize:13, fontWeight: depth===0 ? 500 : 400,
                color: isDone ? "#94A3B8" : "#1E293B",
                textDecoration: isDone ? "line-through" : "none",
                cursor:"pointer", overflow:"hidden", textOverflow:"ellipsis",
                whiteSpace:"nowrap", maxWidth:260 }}>
              {t.title}
            </div>
            {depLabel && (
              <div style={{ fontSize:9, color:"#94A3B8", marginTop:1 }}>
                🔗 {depLabel}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Status */}
      {/* Status — click to edit */}
      <td style={{ padding:"4px 8px", ...ring("status") }} onClick={() => { onFocusCell?.("status"); !editingCell && startEdit("status", t.status) }}>
        {editingCell==="status" ? (
          <select autoFocus style={cellSel} value={cellValue}
            ref={el => { try { (el as any)?.showPicker?.() } catch {} }}
            onChange={e=>saveCell("status", e.target.value)}
            onBlur={cancelEdit}
            onKeyDown={e=>e.key==="Escape"&&cancelEdit()}>
            {["BACKLOG","TODO","IN_PROGRESS","IN_REVIEW","DONE","CANCELLED"].map(s=>(
              <option key={s} value={s}>{s.replace(/_/g," ")}</option>
            ))}
          </select>
        ) : (
          <span title="Click to edit" style={{ padding:"3px 8px", borderRadius:10,
            fontSize:10, fontWeight:600, cursor:"pointer",
            color:sc.text, background:sc.bg }}>
            {tt(sc.label as any)}
          </span>
        )}
      </td>

      {/* Priority — click to edit */}
      <td style={{ padding:"4px 8px", ...ring("priority") }} onClick={() => { onFocusCell?.("priority"); !editingCell && startEdit("priority", t.priority) }}>
        {editingCell==="priority" ? (
          <select autoFocus style={cellSel} value={cellValue}
            ref={el => { try { (el as any)?.showPicker?.() } catch {} }}
            onChange={e=>saveCell("priority", e.target.value)}
            onBlur={cancelEdit}
            onKeyDown={e=>e.key==="Escape"&&cancelEdit()}>
            {["CRITICAL","HIGH","MEDIUM","LOW"].map(p=>(
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        ) : (
          <span title="Click to edit" style={{ fontSize:11, fontWeight:700,
            cursor:"pointer", color:pc.color }}>
            {tt(pc.label as any)}
          </span>
        )}
      </td>

      {/* Assignee — click to edit */}
      <td style={{ padding:"4px 8px", ...ring("assignee") }} onClick={() => !editingCell && startEdit("assignee",
        (t.assignees||[]).map((a:any)=>a.projectMember?.user?.id||a.user?.id).filter(Boolean))}>
        {editingCell==="assignee" ? (
          <div style={{ position:"relative" }} onClick={e=>e.stopPropagation()}
            ref={el => {
              if (!el) return
              const r = el.getBoundingClientRect()
              const shouldFlip = r.top + 280 > window.innerHeight
              if (shouldFlip !== menuUp) setMenuUp(shouldFlip)
            }}>
            <div style={{ position:"absolute", ...(menuUp ? { bottom:"calc(100% + 4px)" } : { top:-4 }), left:0, zIndex:200, background:"#fff",
              border:"1px solid var(--border)", borderRadius:"var(--radius)",
              boxShadow:"0 8px 24px rgba(0,0,0,.14)", minWidth:180, padding:"4px 0" }}>
              {members.map(m=>{
                const id = m.userId||m.user?.id
                const on = Array.isArray(cellValue) && cellValue.includes(id)
                return (
                  <div key={id}
                    onClick={()=>setCellValue((prev:any)=>{
                      const arr = Array.isArray(prev)?[...prev]:[]
                      const i = arr.indexOf(id)
                      i>=0 ? arr.splice(i,1) : arr.push(id)
                      return arr
                    })}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 12px",
                      cursor:"pointer", fontSize:12, color:"var(--text-2)" }}
                    onMouseOver={e=>(e.currentTarget.style.background="var(--surface)")}
                    onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
                    <input type="checkbox" checked={on} readOnly
                      style={{ pointerEvents:"none", accentColor:"var(--steel)" }} />
                    {m.user?.name}
                  </div>
                )
              })}
              <div style={{ borderTop:"1px solid var(--border)", padding:"6px 12px", display:"flex", gap:12 }}>
                <button onClick={()=>saveCell("assignee",cellValue)}
                  style={{ fontSize:11, fontWeight:600, color:"var(--steel)", background:"none",
                    border:"none", cursor:"pointer", fontFamily:"var(--font)" }}>Done</button>
                <button onClick={cancelEdit}
                  style={{ fontSize:11, color:"var(--text-3)", background:"none",
                    border:"none", cursor:"pointer", fontFamily:"var(--font)" }}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <div title="Click to edit"
            style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer" }}>
            {assigneeUser ? (
              <>
                <Avatar name={assigneeUser.name} avatarUrl={assigneeUser.avatarUrl} size={22} />
                <span style={{ fontSize:11, color:"var(--text-2)" }}>
                  {assigneeUser.name?.split(" ")[0]}
                </span>
                {(t.assignees||[]).length > 1 && (
                  <span style={{ fontSize:10, color:"var(--text-4)" }}>
                    +{t.assignees.length-1}
                  </span>
                )}
              </>
            ) : (
              <span style={{ fontSize:11, color:"var(--text-4)", fontStyle:"italic" }}>Unassigned</span>
            )}
            {t._count?.comments > 0 && (
              (t.unreadComments || 0) > 0 ? (
                <span title={`${t.unreadComments} new — ${t._count.comments} total`}
                  style={{ fontSize:10, fontWeight:700, marginLeft:2, padding:"1px 6px",
                    borderRadius:8, background:"#FEF3C7", color:"#B45309" }}>
                  💬 {t.unreadComments} new
                </span>
              ) : (
                <span title={`${t._count.comments} contribution(s) — all read`}
                  style={{ fontSize:10, color:"#64748B", marginLeft:2 }}>
                  💬 {t._count.comments}
                </span>
              )
            )}
          </div>
        )}
      </td>

      {/* Duration Days — calculated */}
      <td style={{ padding:"4px 8px", fontSize:12, color:"var(--text-3)",
        textAlign:"right", whiteSpace:"nowrap" }}>
        {t.startDate && t.dueDate
          ? Math.max(1, Math.ceil((new Date(t.dueDate).getTime()-new Date(t.startDate).getTime())/86400000) + 1)
          : "—"}
      </td>

      {/* Current Start Date — click to edit */}
      <td style={{ padding:"4px 8px", ...ring("startDate") }} onClick={() => onFocusCell?.("startDate")}>
        {editingCell==="startDate" ? (
          <div style={{ position:"relative", display:"inline-block" }}>
            <span style={{ fontSize:12, color:"var(--steel)", fontWeight:600, whiteSpace:"nowrap" }}>
              {cellValue || "Pick a date…"}
            </span>
            <DatePickerPopover
              value={cellValue}
              onSelect={(d)=>saveCell("startDate", d)}
              onClear={()=>saveCell("startDate", "")}
              onClose={cancelEdit}
            />
          </div>
        ) : (
          <span onClick={() => !editingCell && startEdit("startDate", toDateInput(t.startDate))}
            title="Click to edit"
            style={{ fontSize:12, color:"var(--text-3)", cursor:"pointer", whiteSpace:"nowrap" }}>
            {fmtDate(t.startDate)||"—"}
          </span>
        )}
      </td>

      {/* Current Finish Date — click to edit */}
      <td style={{ padding:"4px 8px", ...ring("finishDate") }} onClick={() => onFocusCell?.("finishDate")}>
        {editingCell==="finishDate" ? (
          <div style={{ position:"relative", display:"inline-block" }}>
            <span style={{ fontSize:12, color:"var(--steel)", fontWeight:600, whiteSpace:"nowrap" }}>
              {cellValue || "Pick a date…"}
            </span>
            <DatePickerPopover
              value={cellValue}
              onSelect={(d)=>saveCell("dueDate", d)}
              onClear={()=>saveCell("dueDate", "")}
              onClose={cancelEdit}
            />
          </div>
        ) : (
          <span onClick={() => !editingCell && startEdit("finishDate", toDateInput(t.dueDate))}
            title="Click to edit"
            style={{ fontSize:12, cursor:"pointer", whiteSpace:"nowrap",
              color: overdue ? "var(--red)" : "var(--text-3)",
              fontWeight: overdue ? 600 : 400 }}>
            {overdue && "⚠ "}{fmtDate(t.dueDate)||"—"}
          </span>
        )}
      </td>

      {/* % Complete — click to edit */}
      <td style={{ padding:"4px 8px", minWidth:110, ...ring("percentComplete") }} onClick={() => onFocusCell?.("percentComplete")}>
        {editingCell==="percentComplete" ? (
          <input autoFocus type="number" min={0} max={100} style={{...cellInp,width:60}}
            value={cellValue}
            onChange={e=>setCellValue(e.target.value)}
            onBlur={()=>saveCell("percentComplete",cellValue)}
            onKeyDown={e=>{ if(e.key==="Escape") cancelEdit(); if(e.key==="Enter") saveCell("percentComplete",cellValue) }} />
        ) : (
          <div onClick={() => !editingCell && startEdit("percentComplete", t.percentComplete||0)}
            title="Click to edit"
            style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
            <div style={{ flex:1, height:6, background:"#E2E8F0",
              borderRadius:3, overflow:"hidden", minWidth:50 }}>
              <div style={{ height:"100%", borderRadius:3,
                width:`${t.percentComplete||0}%`,
                background:(t.percentComplete||0)===100?"#059669":(t.percentComplete||0)>50?"#1B6CA8":"#60A5FA",
                transition:"width .3s" }} />
            </div>
            <span style={{ fontSize:10, fontWeight:600,
              color:(t.percentComplete||0)===100?"#059669":"#64748B",
              width:30, textAlign:"right", flexShrink:0 }}>
              {saving?"…":`${t.percentComplete||0}%`}
            </span>
          </div>
        )}
      </td>

      {/* Estimated hours — click to edit (feeds workload engine) */}
      <td style={{ padding:"4px 8px", minWidth:70, ...ring("estimatedHours") }} onClick={() => onFocusCell?.("estimatedHours")}>
        {editingCell==="estimatedHours" ? (
          <input autoFocus type="number" min={0} step="0.5" style={{...cellInp,width:58}}
            value={cellValue}
            onChange={e=>setCellValue(e.target.value)}
            onBlur={()=>saveCell("estimatedHours",cellValue)}
            onKeyDown={e=>{ if(e.key==="Escape") cancelEdit(); if(e.key==="Enter") saveCell("estimatedHours",cellValue) }} />
        ) : (
          <span onClick={() => !editingCell && startEdit("estimatedHours", t.estimatedHours ?? "")}
            title="Estimated effort (hours)"
            style={{ fontSize:12, cursor:"pointer", whiteSpace:"nowrap",
              color: (t.estimatedHours==null||t.estimatedHours==="") ? "var(--text-4)" : "var(--text-2)",
              fontWeight: (t.estimatedHours==null||t.estimatedHours==="") ? 400 : 600 }}>
            {(t.estimatedHours==null||t.estimatedHours==="") ? "— h" : `${Number(t.estimatedHours)}h`}
          </span>
        )}
      </td>
    </tr>
  )
}


