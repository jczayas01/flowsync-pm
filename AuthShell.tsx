"use client"
// src/components/projects/tabs/ProjectGanttTab.tsx
import { useState, useMemo } from "react"
import { EmptyState } from "@/components/ui"

const METHOD_COLORS: Record<string,string> = {
  WATERFALL:"#1B6CA8", AGILE:"#059669", SCRUM:"#7C3AED"
}
const STATUS_COLORS: Record<string,string> = {
  TODO:"#94A3B8", IN_PROGRESS:"#1B6CA8", IN_REVIEW:"#7C3AED",
  DONE:"#059669", BLOCKED:"#DC2626", CANCELLED:"#E2E8F0"
}

export function ProjectGanttTab({ projectId, tasks, phases, milestones, baselines }: {
  projectId:string; tasks:any[]; phases:any[]; milestones:any[]; baselines:any[]
}) {
  const [zoom, setZoom] = useState<"week"|"month"|"quarter">("month")
  const [showBaseline, setShowBaseline] = useState(false)

  // Determine date range
  const allDates = [
    ...tasks.filter(t => t.startDate || t.dueDate).flatMap(t => [t.startDate, t.dueDate]),
    ...milestones.map(m => m.dueDate),
  ].filter(Boolean).map(d => new Date(d))

  const minDate = allDates.length > 0
    ? new Date(Math.min(...allDates.map(d => d.getTime())))
    : new Date()
  const maxDate = allDates.length > 0
    ? new Date(Math.max(...allDates.map(d => d.getTime())))
    : new Date(Date.now() + 90*86400000)

  // Extend range by 10% on each side
  const range = maxDate.getTime() - minDate.getTime()
  const startDate = new Date(minDate.getTime() - range * 0.05)
  const endDate   = new Date(maxDate.getTime() + range * 0.1)
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) || 90

  function dateToX(date: Date | string): number {
    const d = new Date(date)
    return ((d.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100
  }

  function widthForRange(start: Date | string, end: Date | string): number {
    const s = new Date(start), e = new Date(end)
    return ((e.getTime() - s.getTime()) / (endDate.getTime() - startDate.getTime())) * 100
  }

  // Generate month labels
  const monthLabels: { label:string; x:number }[] = useMemo(() => {
    const labels: { label:string; x:number }[] = []
    const d = new Date(startDate)
    d.setDate(1)
    while (d <= endDate) {
      labels.push({
        label: d.toLocaleDateString("en-US", { month:"short", year:"numeric" }),
        x:     dateToX(d),
      })
      d.setMonth(d.getMonth() + 1)
    }
    return labels
  }, [startDate, endDate])

  const todayX = dateToX(new Date())
  const tasksByPhase = phases.map(ph => ({
    phase: ph,
    tasks: tasks.filter(t => t.phaseId === ph.id)
  }))
  const unphased = tasks.filter(t => !t.phaseId)

  if (tasks.length === 0 && milestones.length === 0) {
    return <EmptyState icon="📊" title="No Gantt data"
      description="Add tasks with start and due dates to see them on the Gantt chart." />
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Toolbar */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"8px 16px", display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
        <span style={{ fontSize:12, fontWeight:500, color:"var(--text-2)" }}>Zoom:</span>
        {(["week","month","quarter"] as const).map(z => (
          <button key={z} onClick={() => setZoom(z)}
            style={{ padding:"4px 10px", border:"1px solid var(--border)",
              borderRadius:5, fontSize:11, fontWeight:500, cursor:"pointer",
              fontFamily:"var(--font)",
              background: zoom===z ? "var(--steel)" : "#fff",
              color:       zoom===z ? "#fff" : "var(--text-3)" }}>
            {z.charAt(0).toUpperCase()+z.slice(1)}
          </button>
        ))}
        {baselines.length > 0 && (
          <button onClick={() => setShowBaseline(b => !b)}
            style={{ padding:"4px 10px", border:"1px solid var(--border)",
              borderRadius:5, fontSize:11, fontWeight:500, cursor:"pointer",
              fontFamily:"var(--font)",
              background: showBaseline ? "var(--amber)" : "#fff",
              color:       showBaseline ? "#fff" : "var(--text-3)" }}>
            {showBaseline ? "Hide baseline" : "Show baseline"}
          </button>
        )}
        <div style={{ marginLeft:"auto", fontSize:11, color:"var(--text-3)", display:"flex", gap:12 }}>
          {[
            { color:"var(--green)", label:"Done" },
            { color:"var(--steel)", label:"In progress" },
            { color:"#94A3B8",      label:"To do" },
            { color:"var(--red)",   label:"Blocked" },
          ].map(l => (
            <span key={l.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ width:10, height:10, borderRadius:2, background:l.color, display:"inline-block" }}/>
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex:1, overflowY:"auto", overflowX:"auto" }}>
        <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", minWidth:800 }}>

          {/* Left: task names */}
          <div style={{ borderRight:"1px solid var(--border)", background:"#fff",
            position:"sticky", left:0, zIndex:10 }}>
            {/* Header spacer */}
            <div style={{ height:36, borderBottom:"2px solid var(--border)",
              background:"var(--surface)", padding:"0 12px",
              display:"flex", alignItems:"center", fontSize:11,
              fontWeight:600, color:"var(--text-3)", textTransform:"uppercase",
              letterSpacing:".05em" }}>
              Task / Phase
            </div>
            {/* Phase groups */}
            {tasksByPhase.map(({ phase, tasks:pTasks }) => (
              <div key={phase.id}>
                <div style={{ padding:"8px 12px", background:"var(--surface-1,#F1F5F9)",
                  fontSize:11, fontWeight:700, color:"var(--text-2)",
                  borderBottom:"1px solid var(--border)",
                  textTransform:"uppercase", letterSpacing:".05em" }}>
                  {phase.name}
                </div>
                {pTasks.map(t => (
                  <div key={t.id} style={{ padding:"7px 12px",
                    borderBottom:"1px solid var(--surface-1,#F1F5F9)",
                    fontSize:12, color:"var(--text-2)", display:"flex",
                    alignItems:"center", gap:6, height:36 }}>
                    <div style={{ width:8, height:8, borderRadius:2, flexShrink:0,
                      background:STATUS_COLORS[t.status]||"#94A3B8" }}/>
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {t.title}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {unphased.map(t => (
              <div key={t.id} style={{ padding:"7px 12px",
                borderBottom:"1px solid var(--surface-1,#F1F5F9)",
                fontSize:12, color:"var(--text-2)", display:"flex",
                alignItems:"center", gap:6, height:36 }}>
                <div style={{ width:8, height:8, borderRadius:2, flexShrink:0,
                  background:STATUS_COLORS[t.status]||"#94A3B8" }}/>
                <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {t.title}
                </span>
              </div>
            ))}
            {/* Milestones */}
            {milestones.length > 0 && (
              <div>
                <div style={{ padding:"8px 12px", background:"var(--surface-1,#F1F5F9)",
                  fontSize:11, fontWeight:700, color:"var(--text-2)",
                  borderBottom:"1px solid var(--border)", textTransform:"uppercase",
                  letterSpacing:".05em" }}>
                  Milestones
                </div>
                {milestones.map(m => (
                  <div key={m.id} style={{ padding:"7px 12px",
                    borderBottom:"1px solid var(--surface-1,#F1F5F9)",
                    fontSize:12, color:"var(--text-2)", display:"flex",
                    alignItems:"center", gap:6, height:36 }}>
                    <span style={{ color:"var(--amber)" }}>◇</span>
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {m.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Gantt bars */}
          <div style={{ position:"relative", background:"#fff" }}>
            {/* Month header */}
            <div style={{ height:36, borderBottom:"2px solid var(--border)",
              background:"var(--surface)", position:"relative" }}>
              {monthLabels.map(ml => (
                <div key={ml.label} style={{ position:"absolute", left:`${ml.x}%`,
                  height:"100%", display:"flex", alignItems:"center",
                  paddingLeft:8, fontSize:10, fontWeight:600, color:"var(--text-3)",
                  borderLeft:"1px solid var(--border)", letterSpacing:".03em" }}>
                  {ml.label}
                </div>
              ))}
              {/* Today marker in header */}
              <div style={{ position:"absolute", left:`${todayX}%`, top:0, bottom:0,
                width:2, background:"var(--amber)", opacity:.6 }}/>
            </div>

            {/* Grid lines */}
            {monthLabels.map(ml => (
              <div key={ml.label} style={{ position:"absolute", left:`${ml.x}%`,
                top:36, bottom:0, width:1, background:"var(--border)", opacity:.5 }}/>
            ))}

            {/* Today line */}
            <div style={{ position:"absolute", left:`${todayX}%`, top:36,
              bottom:0, width:1.5, background:"var(--amber)", zIndex:5 }}/>

            {/* Phase groups */}
            {tasksByPhase.map(({ phase, tasks:pTasks }) => (
              <div key={phase.id}>
                <div style={{ height:36, borderBottom:"1px solid var(--border)",
                  background:"rgba(0,0,0,.01)" }} />
                {pTasks.map(t => {
                  if (!t.startDate && !t.dueDate) {
                    return <div key={t.id} style={{ height:36,
                      borderBottom:"1px solid var(--surface-1,#F1F5F9)" }} />
                  }
                  const start  = t.startDate || t.dueDate
                  const end    = t.dueDate   || t.startDate
                  const left   = dateToX(start)
                  const width  = widthForRange(start, end)
                  const color  = STATUS_COLORS[t.status] || "#94A3B8"
                  return (
                    <div key={t.id} style={{ height:36, position:"relative",
                      borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}>
                      <div style={{
                        position:"absolute",
                        left:`${Math.max(0,left)}%`,
                        width:`${Math.max(1,width)}%`,
                        top:9, height:18, background:color, borderRadius:4,
                        display:"flex", alignItems:"center", paddingLeft:6,
                        overflow:"hidden", cursor:"pointer", opacity:.85,
                        transition:"opacity .15s",
                      }}
                        onMouseOver={e => (e.currentTarget.style.opacity="1")}
                        onMouseOut={e  => (e.currentTarget.style.opacity=".85")}>
                        <span style={{ fontSize:9, fontWeight:600, color:"rgba(255,255,255,.9)",
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {t.title}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Unphased tasks */}
            {unphased.map(t => {
              if (!t.startDate && !t.dueDate) {
                return <div key={t.id} style={{ height:36, borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}/>
              }
              const start  = t.startDate || t.dueDate
              const end    = t.dueDate   || t.startDate
              const left   = dateToX(start)
              const width  = widthForRange(start, end)
              const color  = STATUS_COLORS[t.status] || "#94A3B8"
              return (
                <div key={t.id} style={{ height:36, position:"relative",
                  borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}>
                  <div style={{ position:"absolute", left:`${Math.max(0,left)}%`,
                    width:`${Math.max(1,width)}%`, top:9, height:18,
                    background:color, borderRadius:4, display:"flex",
                    alignItems:"center", paddingLeft:6, overflow:"hidden",
                    cursor:"pointer", opacity:.85 }}>
                    <span style={{ fontSize:9, fontWeight:600, color:"rgba(255,255,255,.9)",
                      whiteSpace:"nowrap" }}>{t.title}</span>
                  </div>
                </div>
              )
            })}

            {/* Milestones */}
            {milestones.length > 0 && (
              <div>
                <div style={{ height:36, borderBottom:"1px solid var(--border)",
                  background:"rgba(0,0,0,.01)" }} />
                {milestones.map(m => {
                  const x = dateToX(m.dueDate)
                  return (
                    <div key={m.id} style={{ height:36, position:"relative",
                      borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}>
                      <div style={{ position:"absolute", left:`${x}%`,
                        transform:"translateX(-50%)", top:9 }}>
                        <div style={{ width:14, height:14, background:"var(--amber)",
                          transform:"rotate(45deg)", cursor:"pointer" }}
                          title={m.name} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
