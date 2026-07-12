"use client"
// src/components/projects/ProjectShell.tsx — Phase 3: includes docs tab
import Link from "next/link"
import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { HealthBadge } from "@/components/ui"
import { mapDbRoleToRbac, ROLE_LEVEL } from "@/lib/rbac/roles"

const TABS = [
  { slug:"",          label:"Dashboard",  icon:"⊞"  },
  { slug:"gantt",     label:"Gantt",      icon:"📊" },
  { slug:"board",     label:"Board",      icon:"🗂"  },
  { slug:"tasks",     label:"Tasks",      icon:"✓"   },
  { slug:"baselines", label:"Baselines",  icon:"📌" },
  { slug:"team",      label:"Team",       icon:"👥" },
  { slug:"budget",    label:"Budget",     icon:"💰" },
  { slug:"risks",     label:"Risks",      icon:"⚠"   },
  { slug:"issues",      label:"Issues",      icon:"🚩" },
  { slug:"changes",     label:"Changes",     icon:"🔄" },
  { slug:"decisions",   label:"Decisions",   icon:"⚡" },
  { slug:"benefits",    label:"Benefits",    icon:"💹" },
  { slug:"lessons",     label:"Lessons",     icon:"📚" },
  { slug:"comms",       label:"Comms",       icon:"📣" },
  { slug:"procurement", label:"Procurement", icon:"🤝" },
  { slug:"quality",     label:"Quality",     icon:"✅" },
  { slug:"requirements",label:"Requirements",icon:"📋" },
  { slug:"meetings",    label:"Meetings",    icon:"📝" },
  { slug:"governance",  label:"Governance",  icon:"📐" },
  { slug:"docs",        label:"Docs",        icon:"📁" },
  { slug:"reports",     label:"Reports",     icon:"📈" },
  { slug:"closure",     label:"Closure",     icon:"🏁" },
]

// Tabs that only apply to certain methodologies. Any tab not listed shows for all.
const TAB_METHODOLOGY: Record<string, string[]> = {
  gantt:     ["WATERFALL"],          // predictive schedule
  baselines: ["WATERFALL", "HYBRID"],       // formal baselines
  changes:   ["WATERFALL", "HYBRID"],       // formal change control
  board:     ["AGILE", "SCRUM", "HYBRID"],  // kanban / sprint board
}

const METHOD_COLORS: Record<string,string> = {
  WATERFALL:"var(--steel,#1B6CA8)", AGILE:"var(--green,#059669)", SCRUM:"#7C3AED", HYBRID:"#0891B2"
}

const STATUS_META: Record<string,{label:string;bg:string;fg:string}> = {
  DRAFT:     { label:"Draft",     bg:"#F1F5F9", fg:"#64748B" },
  ACTIVE:    { label:"Active",    bg:"#ECFDF5", fg:"#059669" },
  ON_HOLD:   { label:"On hold",   bg:"#FFFBEB", fg:"#B45309" },
  COMPLETED: { label:"Completed", bg:"#EFF6FF", fg:"#1B6CA8" },
  CANCELLED: { label:"Cancelled", bg:"#FEF2F2", fg:"#B91C1C" },
  ARCHIVED:  { label:"Archived",  bg:"#F1F5F9", fg:"#94A3B8" },
}

export function ProjectShell({ project, userRole, children }:{
  project:any; userRole:string; children:React.ReactNode
}) {
  const pathname = usePathname()
  const router   = useRouter()
  const base     = `/projects/${project.id}`
  const myLevel  = ROLE_LEVEL[mapDbRoleToRbac(userRole)] ?? 0

  // ── Project status (lifecycle) ──
  const [status, setStatus]       = useState<string>(project.status || "DRAFT")
  const [statusBusy, setStatusBusy] = useState(false)
  const canChangeStatus = myLevel >= 50 // PM and above

  async function changeStatus(next: string) {
    if (next === status || statusBusy) return
    const prev = status
    setStatus(next); setStatusBusy(true)   // optimistic
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) { setStatus(prev); return }
      router.refresh()
    } catch { setStatus(prev) }
    finally { setStatusBusy(false) }
  }
  const tabs     = TABS.filter(t => {
    if (TAB_METHODOLOGY[t.slug] && !TAB_METHODOLOGY[t.slug].includes(project.methodology)) return false
    // Clients (external) are limited to Tasks + Docs within a project
    if (myLevel <= 5 && !["tasks","docs"].includes(t.slug)) return false
    return true
  })

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{background:"#fff",borderBottom:"1px solid var(--border)",
        padding:"11px 20px 0",flexShrink:0}}>
        <div style={{fontSize:11,color:"var(--text-3)",marginBottom:5,display:"flex",
          alignItems:"center",gap:5}}>
          <Link href="/projects" style={{color:"var(--text-3)",textDecoration:"none"}}>Projects</Link>
          <span>›</span>
          <span style={{color:"var(--text-2)",fontFamily:"monospace"}}>{project.code}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:9}}>
          <h1 style={{fontSize:16,fontWeight:600,color:"var(--text)",lineHeight:1.2,flex:1,minWidth:0,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {project.name}
          </h1>
          {canChangeStatus ? (
            <select value={status} onChange={e => changeStatus(e.target.value)} disabled={statusBusy}
              title="Project status — Active projects count on the dashboard"
              style={{ fontSize:10, fontWeight:700, padding:"3px 6px", borderRadius:4,
                border:"1px solid "+(STATUS_META[status]?.fg||"#64748B")+"33",
                background:STATUS_META[status]?.bg||"#F1F5F9",
                color:STATUS_META[status]?.fg||"#64748B",
                cursor: statusBusy ? "wait" : "pointer", fontFamily:"var(--font)",
                textTransform:"uppercase", letterSpacing:".03em" }}>
              {Object.entries(STATUS_META).map(([v,m]) => (
                <option key={v} value={v}>{m.label}</option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:4,
              background:STATUS_META[status]?.bg||"#F1F5F9", color:STATUS_META[status]?.fg||"#64748B",
              textTransform:"uppercase", letterSpacing:".03em" }}>
              {STATUS_META[status]?.label||status}
            </span>
          )}
          <HealthBadge health={project.health}/>
          <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:4,
            background:METHOD_COLORS[project.methodology]+"18",
            color:METHOD_COLORS[project.methodology]}}>
            {project.methodology}
          </span>
          <div style={{fontSize:11,color:"var(--text-3)"}}>{project.percentComplete}%</div>
        </div>
        <div style={{display:"flex",gap:0,flexWrap:"wrap",borderBottom:"1px solid var(--border)"}}>
          {tabs.map(tab=>{
            const href   = tab.slug ? `${base}/${tab.slug}` : base
            const active = tab.slug===""
              ? pathname===base
              : pathname.startsWith(`${base}/${tab.slug}`)
            return (
              <Link key={tab.slug} href={href}
                style={{display:"flex",alignItems:"center",gap:4,padding:"7px 11px",
                  fontSize:11,fontWeight:500,textDecoration:"none",whiteSpace:"nowrap",
                  borderBottom:active?"2px solid var(--steel)":"2px solid transparent",
                  color:active?"var(--steel)":"var(--text-3)",
                  background:active?"rgba(27,108,168,.06)":"transparent",
                  marginBottom:-1,transition:"color .15s"}}>
                <span style={{fontSize:12}}>{tab.icon}</span>{tab.label}
              </Link>
            )
          })}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>{children}</div>
    </div>
  )
}
