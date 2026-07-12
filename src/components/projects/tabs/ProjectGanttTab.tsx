"use client"
// src/components/projects/tabs/ProjectGanttTab.tsx
// Industry-standard Gantt chart — MS Project / Asana / Monday.com quality
// Features: phase collapse, drag reschedule, baselines, dependencies, critical path,
//           milestone diamonds, weekend shading, % complete fill, status color bars,
//           multi-column left panel, today line, zoom/pan

import { useState, useRef, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTaskContextSafe } from "@/lib/context/TaskContext"
import { computeCriticalPath } from "@/lib/projects/critical-path"
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal"

// ── Constants ─────────────────────────────────────────────────────────────────
const ROW_H  = 40          // row height — industry standard 40px
const LEFT_W = 340         // wider left panel for name + dates
const HDR_H  = 56          // double header: month + day/week
const MIN_BAR = 6
const COL_W  = { name:180, start:62, end:62, dur:36 }  // left panel columns

const STATUS_COLOR: Record<string,string> = {
  DONE:        "#059669",
  IN_PROGRESS: "#1B6CA8",
  IN_REVIEW:   "#7C3AED",
  TODO:        "#64748B",
  BLOCKED:     "#DC2626",
  CANCELLED:   "#94A3B8",
  BACKLOG:     "#94A3B8",
}
const STATUS_LIGHT: Record<string,string> = {
  DONE:        "#DCFCE7",
  IN_PROGRESS: "#DBEAFE",
  IN_REVIEW:   "#EDE9FE",
  TODO:        "#F1F5F9",
  BLOCKED:     "#FEE2E2",
  CANCELLED:   "#F1F5F9",
  BACKLOG:     "#F1F5F9",
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function workdaysBetween(a: Date, b: Date) {
  // Count of non-weekend days in [a, b) — negative if b < a
  if (b < a) return -workdaysBetween(b, a)
  let n = 0; const cur = new Date(a)
  while (cur < b) { const dow = cur.getDay(); if (dow !== 0 && dow !== 6) n++; cur.setDate(cur.getDate()+1) }
  return n
}
function addWorkdays(d: Date, n: number) {
  const cur = new Date(d); const step = n >= 0 ? 1 : -1; let left = Math.abs(n)
  while (left > 0) { cur.setDate(cur.getDate()+step); const dow = cur.getDay(); if (dow !== 0 && dow !== 6) left-- }
  return cur
}
function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
function fmtShort(d: Date) {
  return d.toLocaleDateString("en-US", { month:"short", day:"numeric", timeZone:"UTC" })
}
function fmtMon(d: Date) {
  return d.toLocaleDateString("en-US", { month:"short", year:"2-digit", timeZone:"UTC" })
}
function isWeekend(d: Date) {
  return d.getDay() === 0 || d.getDay() === 6
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function TaskTooltip({ task, x, y, svgWidth }: { task:any; x:number; y:number; svgWidth:number }) {
  const pct = task.percentComplete || 0
  const tx = x + 230 > svgWidth ? x - 230 : x
  return (
    <foreignObject x={Math.max(LEFT_W + 4, tx)} y={Math.max(HDR_H, y - 10)} width={220} height={130}>
      <div style={{ background:"#1E293B", color:"#fff", borderRadius:8, padding:"10px 12px",
        fontSize:11, boxShadow:"0 8px 24px rgba(0,0,0,.35)", lineHeight:1.6, pointerEvents:"none" }}>
        <div style={{ fontWeight:700, fontSize:12, marginBottom:4, color:"#fff" }}>{task.title}</div>
        <div style={{ color:"#94A3B8", fontSize:10 }}>
          {task.startDate ? fmtShort(new Date(task.startDate)) : "No start"} →{" "}
          {task.dueDate   ? fmtShort(new Date(task.dueDate))   : "No end"}
        </div>
        <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ flex:1, height:4, background:"rgba(255,255,255,.15)", borderRadius:2 }}>
            <div style={{ width:`${pct}%`, height:"100%", background:"#60A5FA", borderRadius:2 }} />
          </div>
          <span style={{ fontSize:10, color:"#60A5FA", flexShrink:0 }}>{pct}%</span>
        </div>
        <div style={{ marginTop:5, fontSize:10, display:"flex", gap:8 }}>
          <span style={{ padding:"1px 6px", borderRadius:4,
            background:STATUS_COLOR[task.status]||"#64748B", color:"#fff" }}>
            {task.status?.replace(/_/g," ")}
          </span>
          {task.priority && (
            <span style={{ color:"#94A3B8" }}>{task.priority}</span>
          )}
        </div>
      </div>
    </foreignObject>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function ProjectGanttTab({ project, projectId, tasks, phases, members, baselines, milestones=[] }: {
  project?:any; projectId:string; tasks:any[]; phases:any[]; members:any[]; baselines?:any[]; milestones?:any[]
}) {
  const router  = useRouter()
  const taskCtx = useTaskContextSafe()
  const svgRef  = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const leftG   = useRef<SVGGElement>(null)   // sticky task panel
  const headerG = useRef<SVGGElement>(null)   // sticky date header
  const cornerG = useRef<SVGGElement>(null)   // sticky corner (both axes)
  const syncSticky = () => {
    const t = wrapRef.current; if (!t) return
    const x = t.scrollLeft, y = t.scrollTop
    leftG.current?.setAttribute("transform", `translate(${x},0)`)
    headerG.current?.setAttribute("transform", `translate(0,${y})`)
    cornerG.current?.setAttribute("transform", `translate(${x},${y})`)
  }
  useEffect(() => { syncSticky() })   // re-sync after every render (zoom, data, drag)
  const [openTaskId, setOpenTaskId] = useState<string|null>(null)
  const [svgWidth,       setSvgWidth]       = useState(1100)
  const [zoom,           setZoom]           = useState<"day"|"week"|"month">("month")
  const [zoomFactor,     setZoomFactor]     = useState(1)
  const [collapsedPhases,setCollapsedPhases]= useState<Set<string>>(new Set())
  const [showDeps,       setShowDeps]       = useState(true)
  const [showBaseline,   setShowBaseline]   = useState(false)
  const [showCritical,   setShowCritical]   = useState(true)
  const [weekendMode,    setWeekendMode]    = useState<"highlight"|"hide">("highlight")
  const showWeekends = weekendMode === "highlight"
  const hideWeekends = weekendMode === "hide"
  const [hoveredTask,    setHoveredTask]    = useState<any>(null)
  const [hoverXY,        setHoverXY]        = useState({ x:0, y:0 })
  const [dragging,       setDragging]       = useState<{taskId:string;startX:number;origStart:Date;origEnd:Date;mode:"move"|"resize-start"|"resize-end"}|null>(null)
  const [dragDays,       setDragDays]       = useState(0)
  const [saving,         setSaving]         = useState(false)
  const today = new Date(); today.setHours(0,0,0,0)

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w && w > 400) setSvgWidth(w)
    })
    if (wrapRef.current) obs.observe(wrapRef.current)
    return () => obs.disconnect()
  }, [])

  // Apply optimistic updates from TaskContext (syncs with Tasks tab)
  const liveTasks = useMemo(() =>
    taskCtx ? taskCtx.applyUpdates(tasks) : tasks,
    [tasks, taskCtx?.localUpdates]
  )

  // ── Schedule computation (forward pass CPM) ───────────────────────────────
  const criticalPath = useMemo(() => computeCriticalPath(liveTasks), [liveTasks])

  // ── Baseline map ─────────────────────────────────────────────────────────
  const baselineMap = useMemo(() => {
    const map = new Map<string,any>()
    if (!baselines?.length) return map
    const latest = [...baselines].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    const bts = latest?.snapshotData?.tasks || latest?.tasks || []
    for (const bt of bts) map.set(bt.taskId || bt.id, bt)
    return map
  }, [baselines])

  // ── View window ───────────────────────────────────────────────────────────
  const allDates = liveTasks.flatMap(t =>
    [t.startDate, t.dueDate].filter(Boolean).map((d:string) => new Date(d))
  )
  const earliest = allDates.length > 0
    ? new Date(Math.min(...allDates.map(d => d.getTime())))
    : addDays(today, -14)

  const [viewStart, setViewStart] = useState(() => addDays(earliest, -7))

  const baseWindowDays = zoom==="day" ? 14 : zoom==="week" ? 56 : 120
  const windowDays = Math.max(7, Math.round(baseWindowDays * zoomFactor))
  const visibleDays = hideWeekends
    ? Math.max(5, workdaysBetween(viewStart, addDays(viewStart, windowDays)))
    : windowDays
  const dayW = (svgWidth - LEFT_W) / visibleDays

  function dayX(d: Date) {
    const n = hideWeekends ? workdaysBetween(viewStart, d) : daysBetween(viewStart, d)
    return LEFT_W + n * dayW
  }

  // ── Headers ───────────────────────────────────────────────────────────────
  const months: { label:string; x:number; w:number }[] = []
  const weeks:  { label:string; x:number }[] = []
  const dayMarks: { d:Date; x:number; isWeekend:boolean }[] = []

  let cur = new Date(viewStart)
  while (cur <= addDays(viewStart, windowDays + 1)) {
    const x = dayX(cur)
    if (x >= LEFT_W - dayW && x <= svgWidth + dayW) {
      if (!(hideWeekends && isWeekend(cur)))
        dayMarks.push({ d:new Date(cur), x, isWeekend:isWeekend(cur) })
    }
    // Month break
    if (cur.getDate() === 1 || cur.getTime() === viewStart.getTime()) {
      const startX = Math.max(LEFT_W, x)
      const endOfMonth = new Date(cur.getFullYear(), cur.getMonth()+1, 0)
      const endX = Math.min(svgWidth, dayX(addDays(endOfMonth, 1)))
      if (endX > startX) months.push({ label:fmtMon(cur), x:startX, w:endX - startX })
    }
    // Week break
    if (cur.getDay() === 1) {
      weeks.push({ label:fmtShort(cur), x })
    }
    cur = addDays(cur, 1)
  }

  // ── Row builder ───────────────────────────────────────────────────────────
  function buildRows(parentId:string|null, phaseId:string|null, depth:number): any[] {
    const rows: any[] = []
    const phaseTasks = liveTasks.filter(t =>
      (phaseId === null ? (!t.phaseId || t.phaseId==="") : t.phaseId === phaseId) &&
      (t.parentId||null) === parentId
    )
    for (const t of phaseTasks.sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0))) {
      rows.push({ type:"task", data:t, depth })
      const children = buildRows(t.id, phaseId, depth+1)
      rows.push(...children)
    }
    return rows
  }

  const displayPhases = phases.length > 0 ? phases : [{ id:"", name:"Tasks", status:"IN_PROGRESS" }]
  const rows: any[] = []
  for (const phase of displayPhases) {
    rows.push({ type:"phase", data:phase })
    if (!collapsedPhases.has(phase.id)) {
      rows.push(...buildRows(null, phase.id||null, 0))
    }
  }
  const hasUnphased = liveTasks.some(t => !t.phaseId)
  if (hasUnphased && phases.length > 0) {
    rows.push({ type:"phase", data:{ id:"__unphased__", name:"Unphased", status:"PENDING" } })
    if (!collapsedPhases.has("__unphased__")) {
      rows.push(...buildRows(null, null, 0))
    }
  }

  const totalH = HDR_H + rows.length * ROW_H + 20

  // ── Drag reschedule ───────────────────────────────────────────────────────
  function startDrag(clientX:number, task:any, mode:"move"|"resize-start"|"resize-end") {
    if (!task.startDate || !task.dueDate) return
    setDragging({
      taskId: task.id,
      startX: clientX,
      origStart: new Date(task.startDate),
      origEnd:   new Date(task.dueDate),
      mode,
    })
  }
  function onBarMouseDown(e: React.MouseEvent, task:any, mode:"move"|"resize-start"|"resize-end"="move") {
    e.preventDefault(); e.stopPropagation()
    startDrag(e.clientX, task, mode)
  }
  function onBarTouchStart(e: React.TouchEvent, task:any, mode:"move"|"resize-start"|"resize-end"="move") {
    e.stopPropagation()
    if (e.touches[0]) startDrag(e.touches[0].clientX, task, mode)
  }

  useEffect(() => {
    if (!dragging) return
    const getX = (e: any) => (e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? e.clientX)
    function onMove(e: any) {
      if (e.cancelable) e.preventDefault()
      const nd = Math.round((getX(e) - dragging!.startX) / dayW)
      setDragDays(prev => prev === nd ? prev : nd)
    }
    function onEnd(e: any) {
      const dx   = getX(e) - dragging!.startX
      const days = Math.round(dx / dayW)
      if (Math.abs(days) >= 1) {
        let newStart = dragging!.origStart
        let newEnd   = dragging!.origEnd
        const shift = hideWeekends ? addWorkdays : addDays
        if (dragging!.mode === "move") {
          newStart = shift(dragging!.origStart, days)
          newEnd   = shift(dragging!.origEnd,   days)
        } else if (dragging!.mode === "resize-end") {
          newEnd = shift(dragging!.origEnd, days)
          if (newEnd <= newStart) newEnd = addDays(newStart, 1)
        } else if (dragging!.mode === "resize-start") {
          newStart = shift(dragging!.origStart, days)
          if (newStart >= newEnd) newStart = addDays(newEnd, -1)
        }
        setSaving(true)
        fetch(`/api/tasks/${dragging!.taskId}`, {
          method:"PATCH", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            startDate: newStart.toISOString(),
            dueDate:   newEnd.toISOString(),
          }),
        }).then(() => { router.refresh() }).finally(() => setSaving(false))
      }
      setDragging(null); setDragDays(0)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup",   onEnd)
    window.addEventListener("touchmove", onMove, { passive:false })
    window.addEventListener("touchend",  onEnd)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup",   onEnd)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend",  onEnd)
    }
  }, [dragging, dayW, router])

  function togglePhase(id: string) {
    setCollapsedPhases(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  // ── Toolbar styles ────────────────────────────────────────────────────────
  const TB: React.CSSProperties = {
    padding:"5px 10px", fontSize:11, cursor:"pointer", border:"1px solid #E2E8F0",
    borderRadius:4, background:"#fff", color:"#374151", fontFamily:"var(--font)",
    whiteSpace:"nowrap",
  }
  const TBA = (a:boolean): React.CSSProperties => ({
    ...TB, background:a?"#EFF6FF":"#fff", color:a?"#1B6CA8":"#374151",
    borderColor:a?"#BFDBFE":"#E2E8F0", fontWeight:a?600:400,
  })
  const ZB = (a:boolean): React.CSSProperties => ({
    padding:"5px 12px", fontSize:11, cursor:"pointer", border:"none",
    background:a?"#1B6CA8":"transparent", color:a?"#fff":"#374151",
    fontFamily:"var(--font)", fontWeight:a?600:400,
  })
  const SEP = <div style={{ width:1, height:24, background:"#E2E8F0", margin:"0 4px" }} />

  // ── Today x position ─────────────────────────────────────────────────────
  const todayX = dayX(today)

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"#F8FAFC" }}>

      {/* ── Toolbar ── */}
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px",
        background:"#fff", borderBottom:"1px solid #E2E8F0", flexShrink:0, flexWrap:"wrap" }}>

        {/* Zoom toggle */}
        <div style={{ display:"flex", border:"1px solid #E2E8F0", borderRadius:6, overflow:"hidden" }}>
          {(["day","week","month"] as const).map(z => (
            <button key={z} style={ZB(zoom===z)}
              onClick={() => { setZoom(z); setZoomFactor(1) }}>
              {z.charAt(0).toUpperCase()+z.slice(1)}
            </button>
          ))}
        </div>

        <button style={TB} onClick={() => setZoomFactor(f => Math.max(0.2, f*0.7))}>+ Zoom</button>
        <button style={TB} onClick={() => setZoomFactor(f => Math.min(5, f*1.4))}>− Zoom</button>
        <button style={TB} onClick={() => { setZoomFactor(1); setViewStart(addDays(earliest,-7)) }}>Fit</button>

        {SEP}

        <button style={TB} onClick={() => setViewStart(v => addDays(v,-Math.round(windowDays*0.4)))}>‹ Prev</button>
        <button style={{ ...TB, fontWeight:600, color:"#1B6CA8", borderColor:"#BFDBFE" }}
          onClick={() => setViewStart(addDays(today,-7))}>Today</button>
        <button style={TB} onClick={() => setViewStart(v => addDays(v,Math.round(windowDays*0.4)))}>Next ›</button>

        {SEP}

        <button style={TB} onClick={() => setCollapsedPhases(new Set())}>Expand all</button>
        <button style={TB} onClick={() => setCollapsedPhases(new Set(phases.map(p=>p.id)))}>Collapse all</button>

        {SEP}

        <button style={TBA(showDeps)}     onClick={() => setShowDeps(d=>!d)}>Dependencies</button>
        <button style={TBA(showBaseline)} onClick={() => setShowBaseline(b=>!b)}>Baseline</button>
        <button style={{ ...TBA(showCritical),
          background:showCritical?"#FEF2F2":"#fff",
          color:showCritical?"#DC2626":"#374151",
          borderColor:showCritical?"#FECACA":"#E2E8F0" }}
          onClick={() => setShowCritical(c=>!c)}>⚡ Critical path</button>
        <div style={{ display:"inline-flex", border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" }}>
          <button style={{ ...TBA(weekendMode==="highlight"), border:"none", borderRadius:0 }}
            title="Shade Saturdays and Sundays"
            onClick={() => setWeekendMode("highlight")}>Weekends</button>
          <button style={{ ...TBA(weekendMode==="hide"), border:"none", borderRadius:0, borderLeft:"1px solid var(--border)" }}
            title="Working days only — weekend columns removed"
            onClick={() => setWeekendMode("hide")}>Hide wknd</button>
        </div>

        {saving && (
          <span style={{ fontSize:11, color:"#1B6CA8", marginLeft:8 }}>Saving…</span>
        )}
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:14, padding:"5px 14px",
        background:"#fff", borderBottom:"1px solid #E2E8F0",
        fontSize:10, color:"#64748B", alignItems:"center", flexShrink:0 }}>
        {[
          { color:"#1B6CA8", label:"In Progress" },
          { color:"#059669", label:"Done" },
          { color:"#7C3AED", label:"In Review" },
          { color:"#DC2626", label:"Blocked" },
          { color:"#94A3B8", label:"Pending" },
        ].map(l => (
          <div key={l.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:12, height:8, borderRadius:3, background:l.color }} />
            <span>{l.label}</span>
          </div>
        ))}
        {showBaseline && (
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:12, height:8, borderRadius:3, background:"#7C3AED",
              opacity:.4, backgroundImage:"repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(255,255,255,.4) 2px,rgba(255,255,255,.4) 4px)" }} />
            <span>Baseline</span>
          </div>
        )}
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <div style={{ width:12, height:8, borderRadius:3, background:"#EF4444",
            backgroundImage:"repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(255,255,255,.55) 2px,rgba(255,255,255,.55) 4px)" }} />
          <span>Critical path</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <svg width={12} height={12}><polygon points="6,1 11,6 6,11 1,6" fill="#1B6CA8" /></svg>
          <span>Milestone</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <svg width={17} height={10}><line x1={1} y1={5} x2={12} y2={5} stroke="#94A3B8" strokeWidth={1.5} /><polygon points="12,2 17,5 12,8" fill="#94A3B8" /></svg>
          <span>Dependency</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <div style={{ width:14, height:4, borderRadius:2, background:"#1B6CA8", opacity:.7 }} />
          <span>Phase rollup</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <div style={{ width:2, height:10, background:"#EF4444" }} />
          <span>Today</span>
        </div>
      </div>

      {/* ── SVG Chart ── */}
      <div ref={wrapRef} style={{ flex:1, overflow:"auto", position:"relative" }}
        onScroll={syncSticky}>
        <svg ref={svgRef} width={svgWidth} height={totalH}
          style={{ display:"block", userSelect:"none", fontFamily:"var(--font)" }}>

          <defs>
            {/* Baseline stripe pattern */}
            <pattern id="baseline-stripe" patternUnits="userSpaceOnUse" width={6} height={6}>
              <path d="M-1,1l2,-2M0,6l6,-6M5,7l2,-2" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
            </pattern>
            {/* Critical path pattern */}
            <pattern id="critical-stripe" patternUnits="userSpaceOnUse" width={6} height={6}>
              <path d="M-1,1l2,-2M0,6l6,-6M5,7l2,-2" stroke="rgba(255,200,200,0.6)" strokeWidth={1.5} />
            </pattern>
          </defs>

          {/* ══ CHART BODY (clipped to right panel) ══ */}
          <clipPath id="chart-clip">
            <rect x={LEFT_W} y={HDR_H} width={svgWidth - LEFT_W} height={totalH - HDR_H} />
          </clipPath>

          <g clipPath="url(#chart-clip)">
            {/* Weekend shading */}
            {showWeekends && dayMarks.filter(d=>d.isWeekend).map((d,i) => (
              <rect key={i} x={d.x} y={HDR_H} width={Math.max(dayW,1)} height={totalH - HDR_H}
                fill="#F8FAFC" opacity={0.7} />
            ))}

            {/* Day/week vertical grid lines */}
            {(zoom==="day" ? dayMarks : weeks.map(w=>({x:w.x}))).map((m,i) => (
              <line key={i} x1={m.x} y1={HDR_H} x2={m.x} y2={totalH}
                stroke="#E2E8F0" strokeWidth={0.5} />
            ))}

            {/* Month dividers */}
            {months.map((m,i) => (
              <line key={i} x1={m.x} y1={HDR_H} x2={m.x} y2={totalH}
                stroke="#CBD5E1" strokeWidth={1} />
            ))}

            {/* Row backgrounds */}
            {rows.map((row, ri) => {
              const y = HDR_H + ri * ROW_H
              const isSelected = row.type==="task" && taskCtx?.selectedTaskId === row.data.id
              if (row.type==="phase") {
                return <rect key={ri} x={LEFT_W} y={y} width={svgWidth-LEFT_W} height={ROW_H}
                  fill="#EFF6FF" />
              }
              return <rect key={ri} x={LEFT_W} y={y} width={svgWidth-LEFT_W} height={ROW_H}
                fill={isSelected?"#DBEAFE":ri%2===0?"#fff":"#FAFBFC"} />
            })}

            {/* Phase summary bars — span full phase duration */}
            {rows.map((row, ri) => {
              if (row.type !== "phase") return null
              const phase = row.data
              if (phase.id === "__unphased__") return null
              const phaseTasks = liveTasks.filter(t => t.phaseId === phase.id && (t.startDate || t.dueDate))
              if (phaseTasks.length === 0) return null
              // Span every task in the phase, using whatever date(s) each has, so no task
              // (incl. milestones or ones with a single date) is dropped from the rollup.
              const times = phaseTasks.flatMap(t => [
                t.startDate ? new Date(t.startDate).getTime() : null,
                t.dueDate   ? new Date(t.dueDate).getTime()   : null,
              ]).filter((v): v is number => v != null)
              const phaseStart = new Date(Math.min(...times))
              const phaseEnd   = new Date(Math.max(...times))
              const px  = dayX(phaseStart)
              const pw  = Math.max(8, dayX(phaseEnd) - px)
              const py  = HDR_H + ri * ROW_H
              if (px + pw < LEFT_W || px > svgWidth) return null
              // Completion % across all tasks in the phase (matches Tasks tab)
              const allPhaseTasks = liveTasks.filter(t => t.phaseId === phase.id)
              const phasePct = allPhaseTasks.length
                ? Math.round(allPhaseTasks.reduce((s,t)=>s+(t.percentComplete||0),0)/allPhaseTasks.length)
                : 0
              const pctColor = phasePct === 100 ? "#059669" : phasePct >= 50 ? "#1B6CA8" : "#60A5FA"
              // Classic summary bracket — solid bar centered in the phase row,
              // with downward end caps (reads as "summarizes the rows below").
              const by = py + ROW_H/2 - 4   // bracket top (8px tall, centered)
              const cap = 7                  // end-cap drop below the bracket
              const fmtD = (d: Date) => d.toLocaleDateString("en-US",{ month:"short", day:"numeric", timeZone:"UTC" })
              return (
                <g key={`ps-${phase.id}`}>
                  <title>{`${phase.name} — ${fmtD(phaseStart)} → ${fmtD(phaseEnd)} · ${phasePct}% complete`}</title>
                  {/* Bracket body */}
                  <rect x={px} y={by} width={pw} height={8} rx={2}
                    fill="#1B6CA8" opacity={0.85} />
                  {/* Completion fill */}
                  {phasePct > 0 && (
                    <rect x={px} y={by} width={Math.max(0, pw * phasePct/100)} height={8} rx={2}
                      fill={pctColor} />
                  )}
                  {/* Downward end caps */}
                  <polygon points={`${px},${by} ${px+6},${by} ${px},${by+8+cap}`} fill="#1B6CA8" opacity={0.85} />
                  <polygon points={`${px+pw},${by} ${px+pw-6},${by} ${px+pw},${by+8+cap}`} fill="#1B6CA8" opacity={0.85} />
                  {/* Completion % label */}
                  <text x={px+pw+10} y={by+8} fontSize={9} fontWeight={700} fill={pctColor}>{phasePct}%</text>
                </g>
              )
            })}

            {/* Dependency arrows */}
            {showDeps && rows.filter(r=>r.type==="task").map((row,_) => {
              const task = row.data
              if (!task.dependencies?.length) return null
              return (task.dependencies||[]).map((dep:any) => {
                const predTask = liveTasks.find(t => t.id === dep.precedingTaskId)
                if (!predTask?.dueDate || !task.startDate) return null
                const predRow = rows.findIndex(r => r.type==="task" && r.data.id === predTask.id)
                const succRow = rows.findIndex(r => r.type==="task" && r.data.id === task.id)
                if (predRow === -1 || succRow === -1) return null
                const x1 = dayX(new Date(predTask.dueDate))
                const y1 = HDR_H + predRow * ROW_H + ROW_H/2
                const x2 = dayX(new Date(task.startDate))
                const y2 = HDR_H + succRow * ROW_H + ROW_H/2
                return (
                  <g key={`${dep.id}`} opacity={0.6}>
                    <path d={`M${x1},${y1} C${x1+20},${y1} ${x2-20},${y2} ${x2},${y2}`}
                      fill="none" stroke="#94A3B8" strokeWidth={1.5} markerEnd="url(#arr)" />
                  </g>
                )
              })
            })}

            <defs>
              <marker id="arr" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#94A3B8" />
              </marker>
            </defs>

            {/* Task bars */}
            {rows.map((row, ri) => {
              if (row.type !== "task") return null
              const task = row.data
              const y    = HDR_H + ri * ROW_H
              const pct  = task.percentComplete || 0
              const isCrit = showCritical && criticalPath.has(task.id) && !["DONE","CANCELLED"].includes(task.status)
              const barColor = isCrit ? "#DC2626" : (STATUS_COLOR[task.status] || "#64748B")
              const barLight = isCrit ? "#FEE2E2" : (STATUS_LIGHT[task.status] || "#F1F5F9")

              const start = task.startDate ? new Date(task.startDate) : null
              const due   = task.dueDate   ? new Date(task.dueDate)   : null

              let barX = -999, barW = 0
              if (start && due) {
                barX = dayX(start)
                barW = Math.max(MIN_BAR, dayX(due) - barX + dayW)   // finish date inclusive
              } else if (start) {
                barX = dayX(start); barW = dayW * 3
              } else { return null }

              if (barX + barW < LEFT_W || barX > svgWidth) return null

              // Live drag feedback — move shifts the bar, resize changes one end
              if (dragging && dragging.taskId === task.id && dragDays !== 0) {
                const d = dragDays * dayW
                if (dragging.mode === "move") barX += d
                else if (dragging.mode === "resize-end") barW = Math.max(MIN_BAR, barW + d)
                else if (dragging.mode === "resize-start") { barX += d; barW = Math.max(MIN_BAR, barW - d) }
              }

              const barY   = y + 10
              const barH   = ROW_H - 20
              const radius = 4

              // Milestone task → diamond marker at its date (zero duration)
              if (task.isMilestone) {
                const mx = barX
                const my = barY + barH/2
                const s  = Math.max(7, barH/2)
                return (
                  <g key={`b-${task.id}`}>
                    <polygon points={`${mx},${my-s} ${mx+s},${my} ${mx},${my+s} ${mx-s},${my}`}
                      fill="#7C3AED" stroke="#5B21B6" strokeWidth={1.5}
                      style={{ cursor:"pointer" }}
                      onDoubleClick={() => setOpenTaskId(task.id)}
                      onMouseEnter={e => { setHoveredTask(task); setHoverXY({ x:e.clientX, y:barY }) }}
                      onMouseLeave={() => setHoveredTask(null)} />
                  </g>
                )
              }

              // Baseline bar
              const bl = baselineMap.get(task.id)
              let blX = -999, blW = 0
              if (showBaseline && bl?.startDate && bl?.dueDate) {
                blX = dayX(new Date(bl.startDate))
                blW = Math.max(MIN_BAR, dayX(new Date(bl.dueDate)) - blX)
              }

              return (
                <g key={`b-${task.id}`}>
                  {/* Baseline ghost bar */}
                  {showBaseline && blW > 0 && (
                    <rect x={blX} y={barY+barH+2} width={blW} height={4} rx={2}
                      fill="#7C3AED" opacity={0.35} />
                  )}

                  {/* Main bar background */}
                  <rect x={barX} y={barY} width={barW} height={barH} rx={radius}
                    fill={barLight} stroke={barColor} strokeWidth={1.5}
                    style={{ cursor:"grab", touchAction:"none" }}
                    onMouseDown={e => onBarMouseDown(e, task, "move")}
                    onTouchStart={e => onBarTouchStart(e, task, "move")}
                    onDoubleClick={() => setOpenTaskId(task.id)}
                    onMouseEnter={e => {
                      setHoveredTask(task)
                      setHoverXY({ x:e.clientX, y:barY })
                    }}
                    onMouseLeave={() => setHoveredTask(null)}
                  />

                  {/* % complete fill */}
                  {pct > 0 && (
                    <rect x={barX} y={barY} width={barW * pct/100} height={barH} rx={radius}
                      fill={barColor} opacity={0.85} style={{ pointerEvents:"none" }} />
                  )}

                  {/* Critical path stripe overlay */}
                  {isCrit && (
                    <rect x={barX} y={barY} width={barW} height={barH} rx={radius}
                      fill="url(#critical-stripe)" style={{ pointerEvents:"none" }} />
                  )}

                  {/* % text inside bar if wide enough */}
                  {barW > 40 && (
                    <text x={barX + barW/2} y={barY + barH/2 + 4} fontSize={9} fontWeight={600}
                      fill={pct > 50 ? "#fff" : barColor} textAnchor="middle"
                      style={{ pointerEvents:"none" }}>
                      {pct}%
                    </text>
                  )}

                  {/* Critical path ⚡ badge */}
                  {isCrit && (
                    <text x={barX + barW + 4} y={barY + barH/2 + 4} fontSize={10} fill="#DC2626">⚡</text>
                  )}

                  {/* Live drag delta chip */}
                  {dragging && dragging.taskId === task.id && dragDays !== 0 && (
                    <g style={{ pointerEvents:"none" }}>
                      <rect x={barX + barW/2 - 16} y={barY - 16} width={32} height={14} rx={7}
                        fill="#0D1B2A" opacity={0.9} />
                      <text x={barX + barW/2} y={barY - 6} fontSize={9} fontWeight={700}
                        fill="#fff" textAnchor="middle">
                        {dragDays > 0 ? `+${dragDays}d` : `${dragDays}d`}
                      </text>
                    </g>
                  )}

                  {/* Resize handles — drag an edge to change Start / Finish */}
                  {barW > 16 && (
                    <>
                      <rect x={barX-3} y={barY} width={9} height={barH} fill="transparent"
                        style={{ cursor:"ew-resize", touchAction:"none" }}
                        onMouseDown={e => onBarMouseDown(e, task, "resize-start")}
                        onTouchStart={e => onBarTouchStart(e, task, "resize-start")} />
                      <rect x={barX+barW-6} y={barY} width={9} height={barH} fill="transparent"
                        style={{ cursor:"ew-resize", touchAction:"none" }}
                        onMouseDown={e => onBarMouseDown(e, task, "resize-end")}
                        onTouchStart={e => onBarTouchStart(e, task, "resize-end")} />
                      <rect x={barX+1.5} y={barY+barH/2-4} width={2} height={8} rx={1}
                        fill={barColor} opacity={0.55} style={{ pointerEvents:"none" }} />
                      <rect x={barX+barW-3.5} y={barY+barH/2-4} width={2} height={8} rx={1}
                        fill={barColor} opacity={0.55} style={{ pointerEvents:"none" }} />
                    </>
                  )}
                </g>
              )
            })}

            {/* Today vertical line — rendered AFTER bars so it sits on top */}
            {todayX >= LEFT_W && todayX <= svgWidth && (
              <line x1={todayX} y1={HDR_H} x2={todayX} y2={totalH}
                stroke="#EF4444" strokeWidth={2} strokeDasharray="4 3" opacity={0.9} />
            )}

            {/* Today label */}
            {todayX >= LEFT_W && todayX <= svgWidth && (
              <>
                <rect x={todayX-14} y={HDR_H+2} width={28} height={14} rx={3} fill="#EF4444" />
                <text x={todayX} y={HDR_H+12} fontSize={8} fontWeight={700}
                  fill="#fff" textAnchor="middle">TODAY</text>
              </>
            )}

            {/* Project milestone date-guides (faint drop-lines); the flags render in the header */}
            {milestones.map((m:any) => {
              if (!m.dueDate) return null
              const mx = dayX(new Date(m.dueDate))
              if (mx < LEFT_W || mx > svgWidth) return null
              const col = m.status==="ACHIEVED" ? "#059669"
                        : m.status==="AT_RISK"  ? "#F59E0B"
                        : m.status==="MISSED"   ? "#DC2626" : "#1B6CA8"
              return (
                <line key={`msl-${m.id}`} x1={mx} y1={HDR_H} x2={mx} y2={totalH}
                  stroke={col} strokeWidth={1.5} strokeDasharray="2 3" opacity={0.4} />
              )
            })}

            {/* Tooltip */}
            {hoveredTask && (
              <TaskTooltip task={hoveredTask} x={hoverXY.x} y={hoverXY.y} svgWidth={svgWidth} />
            )}
          </g>

          {/* ══ LEFT PANEL (sticks horizontally) ══ */}
          <g ref={leftG}>

          {/* Left panel background */}
          <rect x={0} y={0} width={LEFT_W} height={totalH} fill="#fff" />
          <line x1={LEFT_W} y1={0} x2={LEFT_W} y2={totalH} stroke="#E2E8F0" strokeWidth={1.5} />

          {/* Left panel header */}
          <rect x={0} y={0} width={LEFT_W} height={HDR_H} fill="#1a3a5c" />
          {/* Column headers */}
          <text x={10}  y={HDR_H/2+5} fontSize={10} fontWeight={700} fill="rgba(255,255,255,.7)">TASK NAME</text>
          <line x1={COL_W.name+10} y1={0} x2={COL_W.name+10} y2={HDR_H} stroke="rgba(255,255,255,.1)" />
          <text x={COL_W.name+18} y={HDR_H/2+5} fontSize={9} fill="rgba(255,255,255,.5)">START</text>
          <line x1={COL_W.name+10+COL_W.start} y1={0} x2={COL_W.name+10+COL_W.start} y2={HDR_H} stroke="rgba(255,255,255,.1)" />
          <text x={COL_W.name+COL_W.start+18} y={HDR_H/2+5} fontSize={9} fill="rgba(255,255,255,.5)">END</text>
          <line x1={LEFT_W-COL_W.dur-4} y1={0} x2={LEFT_W-COL_W.dur-4} y2={HDR_H} stroke="rgba(255,255,255,.1)" />
          <text x={LEFT_W-COL_W.dur+4} y={HDR_H/2+5} fontSize={9} fill="rgba(255,255,255,.5)">DAYS</text>

          {/* Left panel rows */}
          {rows.map((row, ri) => {
            const y = HDR_H + ri * ROW_H

            if (row.type === "phase") {
              const phase = row.data
              const isCollapsed = collapsedPhases.has(phase.id)
              const phaseAll = liveTasks.filter(t => t.phaseId === phase.id)
              const phasePct = phaseAll.length
                ? Math.round(phaseAll.reduce((s,t)=>s+(t.percentComplete||0),0)/phaseAll.length)
                : 0
              const pctColor = phasePct===100 ? "#059669" : phasePct>=50 ? "#1B6CA8" : "#60A5FA"
              return (
                <g key={`lph-${phase.id}`} onClick={() => togglePhase(phase.id)} style={{ cursor:"pointer" }}>
                  <rect x={0} y={y} width={LEFT_W} height={ROW_H} fill="#EFF6FF" />
                  <line x1={0} y1={y+ROW_H} x2={LEFT_W} y2={y+ROW_H} stroke="#DBEAFE" />
                  {/* Collapse arrow */}
                  <text x={6} y={y+ROW_H/2+4} fontSize={8} fill="#1B6CA8" fontWeight={700}>
                    {isCollapsed ? "▶" : "▼"}
                  </text>
                  {/* Phase color bar */}
                  <rect x={20} y={y+12} width={3} height={ROW_H-24} rx={1.5} fill="#1B6CA8" />
                  <text x={28} y={y+ROW_H/2+4} fontSize={11} fontWeight={700}
                    fill="#1E3A8A" letterSpacing="0.04em">
                    {phase.name?.toUpperCase().slice(0,22)}{phase.name?.length>22?"…":""}
                  </text>
                  {/* Phase completion % — always visible */}
                  {phaseAll.length > 0 && (
                    <>
                      <rect x={LEFT_W-92} y={y+ROW_H/2-3} width={50} height={6} rx={3} fill="#DBEAFE" />
                      <rect x={LEFT_W-92} y={y+ROW_H/2-3} width={Math.max(0,50*phasePct/100)} height={6} rx={3} fill={pctColor} />
                      <text x={LEFT_W-36} y={y+ROW_H/2+4} fontSize={9} fontWeight={700} fill={pctColor}>{phasePct}%</text>
                    </>
                  )}
                </g>
              )
            }

            const task = row.data
            const indent = 10 + row.depth * 14
            const start  = task.startDate ? new Date(task.startDate) : null
            const due    = task.dueDate   ? new Date(task.dueDate)   : null
            const dur    = start && due ? Math.max(1, Math.ceil(daysBetween(start, due)) + 1) : null   // inclusive
            const isCrit = showCritical && criticalPath.has(task.id)
            const barColor = STATUS_COLOR[task.status] || "#64748B"

            return (
              <g key={`lt-${task.id}`}>
                <rect x={0} y={y} width={LEFT_W} height={ROW_H}
                  fill={ri%2===0?"#fff":"#FAFBFC"} />
                <line x1={0} y1={y+ROW_H} x2={LEFT_W} y2={y+ROW_H}
                  stroke="#F1F5F9" strokeWidth={0.5} />

                {/* Status dot */}
                <circle cx={indent+4} cy={y+ROW_H/2} r={3.5} fill={barColor} />

                {/* Task name */}
                <text x={indent+14} y={y+ROW_H/2+4} fontSize={11}
                  fontWeight={row.depth===0?500:400}
                  fill={task.status==="DONE"?"#94A3B8":"#1E293B"}>
                  {task.title?.slice(0,22)}{task.title?.length>22?"…":""}
                </text>

                {/* ⚡ Critical indicator */}
                {isCrit && (
                  <text x={COL_W.name} y={y+ROW_H/2+4} fontSize={9} fill="#DC2626">⚡</text>
                )}
                {/* Assignee avatar circle */}
                {(() => {
                  const assignee = task.assignees?.[0]
                  const user = assignee?.projectMember?.user || assignee?.user
                  if (!user) return null
                  const initials = (user.name||"?").charAt(0).toUpperCase()
                  const ax = COL_W.name - 18
                  const ay = y + ROW_H/2
                  return (
                    <g>
                      <circle cx={ax} cy={ay} r={9} fill="#1B6CA8" />
                      <text x={ax} y={ay+4} fontSize={8} fontWeight={700}
                        fill="#fff" textAnchor="middle">{initials}</text>
                    </g>
                  )
                })()}

                {/* Column dividers */}
                <line x1={COL_W.name+10} y1={y} x2={COL_W.name+10} y2={y+ROW_H} stroke="#F1F5F9" />
                <line x1={COL_W.name+10+COL_W.start} y1={y} x2={COL_W.name+10+COL_W.start} y2={y+ROW_H} stroke="#F1F5F9" />
                <line x1={LEFT_W-COL_W.dur-4} y1={y} x2={LEFT_W-COL_W.dur-4} y2={y+ROW_H} stroke="#F1F5F9" />

                {/* Start date */}
                <text x={COL_W.name+14} y={y+ROW_H/2+4} fontSize={9} fill="#64748B">
                  {start ? fmtShort(start) : "—"}
                </text>

                {/* End date */}
                <text x={COL_W.name+COL_W.start+14} y={y+ROW_H/2+4} fontSize={9} fill="#64748B">
                  {due ? fmtShort(due) : "—"}
                </text>

                {/* Duration */}
                <text x={LEFT_W-COL_W.dur} y={y+ROW_H/2+4} fontSize={9}
                  fill="#94A3B8" textAnchor="start">
                  {dur !== null ? `${dur}d` : "—"}
                </text>
              </g>
            )
          })}

          </g>{/* end left panel */}

          {/* ══ HEADER (sticks vertically) ══ */}
          <g ref={headerG}>
          <clipPath id="header-clip">
            <rect x={LEFT_W} y={0} width={svgWidth-LEFT_W} height={HDR_H} />
          </clipPath>
          <rect x={LEFT_W} y={0} width={svgWidth-LEFT_W} height={26} fill="#1B6CA8" />
          <g clipPath="url(#header-clip)">
            {months.map((m,i) => (
              <g key={i}>
                <line x1={m.x} y1={0} x2={m.x} y2={26} stroke="rgba(255,255,255,.15)" />
                <text x={m.x + m.w/2} y={17} fontSize={10} fontWeight={600}
                  fill="#fff" textAnchor="middle">{m.label}</text>
              </g>
            ))}
          </g>

          {/* Week row */}
          <rect x={LEFT_W} y={26} width={svgWidth-LEFT_W} height={30} fill="#F8FAFC" />
          <line x1={LEFT_W} y1={26} x2={svgWidth} y2={26} stroke="#E2E8F0" />
          <g clipPath="url(#header-clip)">
            {zoom === "day"
              ? dayMarks.map((d: any, i: number) => (
                  <g key={i}>
                    <line x1={d.x} y1={26} x2={d.x} y2={HDR_H} stroke="#E2E8F0" />
                    <text x={d.x + dayW/2} y={44} fontSize={9} fill={d.isWeekend ? "#CBD5E1" : "#94A3B8"}
                      textAnchor="middle">{d.d.getDate()}</text>
                  </g>
                ))
              : weeks.map((w,i) => (
              <g key={i}>
                <line x1={w.x} y1={26} x2={w.x} y2={HDR_H} stroke="#E2E8F0" />
                <text x={w.x+4} y={44} fontSize={9} fill="#94A3B8">{w.label}</text>
              </g>
            ))}
          </g>

          <line x1={LEFT_W} y1={HDR_H} x2={svgWidth} y2={HDR_H} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Project milestone flags — pinned in the timeline header (above the grid) */}
          <g clipPath="url(#header-clip)">
            {milestones.map((m:any) => {
              if (!m.dueDate) return null
              const mx = dayX(new Date(m.dueDate))
              if (mx < LEFT_W || mx > svgWidth) return null
              const col = m.status==="ACHIEVED" ? "#059669"
                        : m.status==="AT_RISK"  ? "#F59E0B"
                        : m.status==="MISSED"   ? "#DC2626" : "#1B6CA8"
              const my = 33, s = 4.5
              return (
                <polygon key={`msf-${m.id}`}
                  points={`${mx},${my-s} ${mx+s},${my} ${mx},${my+s} ${mx-s},${my}`}
                  fill={col} stroke="#fff" strokeWidth={1} style={{ cursor:"default" }}>
                  <title>{`◆ ${m.name}${m.dueDate ? " — due " + new Date(m.dueDate).toLocaleDateString("en-US", { timeZone:"UTC" }) : ""}${m.status ? " · " + String(m.status).replace(/_/g," ").toLowerCase() : ""}`}</title>
                </polygon>
              )
            })}
          </g>
          </g>{/* end sticky header */}

          {/* ══ CORNER: left column headers (stick both ways, topmost) ══ */}
          <g ref={cornerG}>
            <rect x={0} y={0} width={LEFT_W} height={HDR_H} fill="#1a3a5c" />
            <line x1={LEFT_W} y1={0} x2={LEFT_W} y2={HDR_H} stroke="#E2E8F0" strokeWidth={1.5} />
            <text x={10}  y={HDR_H/2+5} fontSize={10} fontWeight={700} fill="rgba(255,255,255,.7)">TASK NAME</text>
            <line x1={COL_W.name+10} y1={0} x2={COL_W.name+10} y2={HDR_H} stroke="rgba(255,255,255,.1)" />
            <text x={COL_W.name+18} y={HDR_H/2+5} fontSize={9} fill="rgba(255,255,255,.5)">START</text>
            <line x1={COL_W.name+10+COL_W.start} y1={0} x2={COL_W.name+10+COL_W.start} y2={HDR_H} stroke="rgba(255,255,255,.1)" />
            <text x={COL_W.name+COL_W.start+18} y={HDR_H/2+5} fontSize={9} fill="rgba(255,255,255,.5)">END</text>
            <line x1={LEFT_W-COL_W.dur-4} y1={0} x2={LEFT_W-COL_W.dur-4} y2={HDR_H} stroke="rgba(255,255,255,.1)" />
            <text x={LEFT_W-COL_W.dur+4} y={HDR_H/2+5} fontSize={9} fill="rgba(255,255,255,.5)">DAYS</text>
          </g>

        </svg>

      {/* TaskDetailModal — opens when bar is double-clicked */}
      {openTaskId && (
        <TaskDetailModal
          taskId={openTaskId}
          projectId={projectId}
          allTasks={liveTasks}
          members={members}
          phases={phases}
          onClose={() => { setOpenTaskId(null); router.refresh() }}
        />
      )}
      </div>
    </div>
  )
}
