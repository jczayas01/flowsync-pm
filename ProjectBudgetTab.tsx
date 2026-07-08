"use client"
// src/components/projects/ProjectShell.tsx — Phase 3: includes docs tab
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HealthBadge } from "@/components/ui"

const TABS = [
  { slug:"",        label:"Dashboard",  icon:"⊞"  },
  { slug:"gantt",   label:"Gantt",      icon:"📊" },
  { slug:"board",   label:"Board",      icon:"🗂"  },
  { slug:"tasks",   label:"Tasks",      icon:"✓"   },
  { slug:"budget",  label:"Budget",     icon:"💰" },
  { slug:"risks",   label:"Risks",      icon:"⚠"   },
  { slug:"docs",    label:"Docs",       icon:"📝" },
  { slug:"reports", label:"Reports",    icon:"📈" },
]

const METHOD_COLORS: Record<string,string> = {
  WATERFALL:"var(--steel,#1B6CA8)", AGILE:"var(--green,#059669)", SCRUM:"#7C3AED"
}

export function ProjectShell({ project, userRole, children }:{
  project:any; userRole:string; children:React.ReactNode
}) {
  const pathname = usePathname()
  const base     = `/projects/${project.id}`

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
          <HealthBadge health={project.health}/>
          <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:4,
            background:METHOD_COLORS[project.methodology]+"18",
            color:METHOD_COLORS[project.methodology]}}>
            {project.methodology}
          </span>
          <div style={{fontSize:11,color:"var(--text-3)"}}>{project.percentComplete}%</div>
        </div>
        <div style={{display:"flex",gap:0,overflowX:"auto"}}>
          {TABS.map(tab=>{
            const href   = tab.slug ? `${base}/${tab.slug}` : base
            const active = tab.slug===""
              ? pathname===base
              : pathname.startsWith(`${base}/${tab.slug}`)
            return (
              <Link key={tab.slug} href={href}
                style={{display:"flex",alignItems:"center",gap:4,padding:"8px 12px",
                  fontSize:11,fontWeight:500,textDecoration:"none",whiteSpace:"nowrap",
                  borderBottom:active?"2px solid var(--steel)":"2px solid transparent",
                  color:active?"var(--steel)":"var(--text-3)",
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
