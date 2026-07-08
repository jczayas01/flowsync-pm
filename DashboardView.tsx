"use client"
// src/components/portfolio/PortfolioView.tsx
import { useState } from "react"
import Link from "next/link"
import { Badge, Avatar, StatCard } from "@/components/ui"

function healthColor(h:string) {
  return h==="GREEN"?"var(--green)":h==="AMBER"?"var(--amber)":"var(--red)"
}
function healthLabel(h:string) {
  return h==="GREEN"?"On track":h==="AMBER"?"At risk":"Off track"
}
function healthBadgeVariant(h:string): any {
  return h==="GREEN"?"green":h==="AMBER"?"amber":"red"
}
function fmt(n:number) {
  if(n>=1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if(n>=1_000)     return `$${(n/1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}
function rollup(projects:any[]) {
  const budget  = projects.reduce((s,p)=>s+Number(p.budgetTotal||0),0)
  const spent   = projects.reduce((s,p)=>s+Number(p.budgetSpent||0),0)
  const avgPct  = projects.length ? Math.round(projects.reduce((s,p)=>s+Number(p.percentComplete||0),0)/projects.length) : 0
  const counts  = {GREEN:0,AMBER:0,RED:0} as Record<string,number>
  projects.forEach(p=>{ if(p.health in counts) counts[p.health]++ })
  const health  = counts.RED>0?"RED":counts.AMBER>0?"AMBER":"GREEN"
  return { budget,spent,pct:budget>0?Math.round(spent/budget*100):0,avgPct,counts,health }
}

export function PortfolioView({ portfolios, unassigned, workspaceId, userRole }:{
  portfolios:any[]; unassigned:any[]; workspaceId:string; userRole:string
}) {
  const [openPorts, setOpenPorts] = useState<Record<string,boolean>>(
    Object.fromEntries(portfolios.map(p=>[p.id,true]))
  )
  const [openProgs, setOpenProgs] = useState<Record<string,boolean>>({})
  const [creating,  setCreating]  = useState(false)
  const canCreate = !["READ_ONLY","CLIENT","TEAM_MEMBER"].includes(userRole)

  // Global stats
  const allProjects = portfolios.flatMap(p=>p.programs.flatMap((pr:any)=>pr.projects)).concat(unassigned)
  const global = rollup(allProjects)

  function togglePort(id:string) { setOpenPorts(s=>({...s,[id]:!s[id]})) }
  function toggleProg(id:string) { setOpenProgs(s=>({...s,[id]:!s[id]})) }

  const card: React.CSSProperties = {
    background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)"
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Header */}
      <div style={{background:"#fff",borderBottom:"1px solid var(--border)",padding:"14px 20px",
        display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:17,fontWeight:600,color:"var(--text)",marginBottom:2}}>Portfolio</h1>
          <p style={{fontSize:12,color:"var(--text-3)"}}>
            {portfolios.length} portfolio{portfolios.length!==1?"s":""} · {allProjects.length} projects total
          </p>
        </div>
        {canCreate && (
          <button onClick={()=>setCreating(true)}
            style={{padding:"8px 16px",background:"var(--steel)",color:"#fff",border:"none",
              borderRadius:"var(--radius)",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)"}}>
            + New portfolio
          </button>
        )}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:20}}>
        {/* Global KPI strip */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:20}}>
          {[
            {label:"Total projects", value:allProjects.length, icon:"📁"},
            {label:"On track",  value:global.counts.GREEN, icon:"🟢", color:"var(--green)"},
            {label:"At risk",   value:global.counts.AMBER, icon:"🟡", color:"var(--amber)"},
            {label:"Off track", value:global.counts.RED,   icon:"🔴", color:"var(--red)"},
            {label:"Avg complete", value:`${global.avgPct}%`, icon:"📊"},
          ].map(k=>(
            <div key={k.label} style={{...card,padding:"12px 14px"}}>
              <div style={{fontSize:18,marginBottom:4}}>{k.icon}</div>
              <div style={{fontSize:22,fontWeight:700,color:(k as any).color||"var(--text)",lineHeight:1}}>{k.value}</div>
              <div style={{fontSize:11,color:"var(--text-3)",marginTop:3}}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Budget bar */}
        {global.budget>0 && (
          <div style={{...card,padding:"12px 16px",marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:8}}>
              <span style={{fontWeight:500,color:"var(--text)"}}>Total portfolio budget</span>
              <span style={{color:"var(--text-3)"}}>{fmt(global.spent)} of {fmt(global.budget)} ({global.pct}%)</span>
            </div>
            <div style={{height:8,background:"var(--border)",borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.min(global.pct,100)}%`,borderRadius:4,
                background:global.pct>90?"var(--red)":global.pct>75?"var(--amber)":"var(--steel)",
                transition:"width .5s"}}/>
            </div>
          </div>
        )}

        {/* Portfolio tree */}
        {portfolios.length===0 && unassigned.length===0 ? (
          <div style={{textAlign:"center",padding:"48px 24px"}}>
            <div style={{fontSize:40,marginBottom:12}}>📊</div>
            <div style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:6}}>No portfolios yet</div>
            <p style={{fontSize:13,color:"var(--text-3)",marginBottom:20}}>
              Create a portfolio to organize your programs and projects.
            </p>
            {canCreate && (
              <button onClick={()=>setCreating(true)}
                style={{padding:"9px 20px",background:"var(--steel)",color:"#fff",border:"none",
                  borderRadius:"var(--radius)",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)"}}>
                + Create portfolio
              </button>
            )}
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {portfolios.map(port=>{
              const portProjects = port.programs.flatMap((pr:any)=>pr.projects)
              const pr = rollup(portProjects)
              const isOpen = openPorts[port.id]!==false
              return (
                <div key={port.id} style={{...card,overflow:"hidden"}}>
                  {/* Portfolio header */}
                  <div onClick={()=>togglePort(port.id)}
                    style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",
                      borderLeft:`4px solid ${port.color||"var(--steel)"}`,
                      background:isOpen?"#fff":"var(--surface)",transition:"background .15s"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:3}}>
                        <span style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>{port.name}</span>
                        <Badge variant={healthBadgeVariant(pr.health)}>{healthLabel(pr.health)}</Badge>
                        <span style={{fontSize:11,color:"var(--text-3)"}}>
                          {port.programs.length} program{port.programs.length!==1?"s":""} · {portProjects.length} projects
                        </span>
                      </div>
                      <div style={{display:"flex",gap:16,fontSize:12,color:"var(--text-3)"}}>
                        {pr.budget>0 && <span>{fmt(pr.spent)} / {fmt(pr.budget)} ({pr.pct}%)</span>}
                        <span>{pr.avgPct}% avg complete</span>
                        <span style={{display:"flex",gap:8}}>
                          {["GREEN","AMBER","RED"].map(h=>pr.counts[h]>0&&(
                            <span key={h} style={{color:healthColor(h),fontWeight:600}}>
                              {pr.counts[h]}{h[0]}
                            </span>
                          ))}
                        </span>
                      </div>
                    </div>
                    {port.owner && <Avatar name={port.owner.name} avatarUrl={port.owner.avatarUrl} size={28}/>}
                    <span style={{fontSize:12,color:"var(--text-4)",transition:"transform .2s",
                      transform:isOpen?"rotate(180deg)":"none"}}>▾</span>
                  </div>

                  {/* Programs */}
                  {isOpen && (
                    <div style={{borderTop:"1px solid var(--border)",background:"var(--surface)"}}>
                      {port.programs.map((prog:any)=>{
                        const progR = rollup(prog.projects)
                        const progOpen = openProgs[prog.id]!==false
                        return (
                          <div key={prog.id} style={{borderBottom:"1px solid var(--border)"}}>
                            {/* Program header */}
                            <div onClick={()=>toggleProg(prog.id)}
                              style={{padding:"10px 18px 10px 32px",display:"flex",
                                alignItems:"center",gap:10,cursor:"pointer",
                                background:progOpen?"var(--surface)":"var(--surface-1,#F1F5F9)",
                                borderLeft:`3px solid ${prog.color||"var(--green)"}`}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                                  <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{prog.name}</span>
                                  <span style={{fontSize:11,color:"var(--text-3)"}}>
                                    {prog.projects.length} project{prog.projects.length!==1?"s":""}
                                  </span>
                                </div>
                                <div style={{display:"flex",gap:12,fontSize:11,color:"var(--text-3)"}}>
                                  {prog.manager&&<span>{prog.manager.name}</span>}
                                  {progR.budget>0&&<span>{fmt(progR.spent)}/{fmt(progR.budget)}</span>}
                                  <span>{progR.avgPct}% done</span>
                                </div>
                              </div>
                              <Badge variant={healthBadgeVariant(progR.health)}>{healthLabel(progR.health)}</Badge>
                              <span style={{fontSize:11,color:"var(--text-4)",
                                transform:progOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
                            </div>
                            {/* Projects */}
                            {progOpen && prog.projects.map((p:any)=>(
                              <ProjectRow key={p.id} project={p}/>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Unassigned */}
            {unassigned.length>0 && (
              <div style={card}>
                <div style={{padding:"12px 18px",fontSize:13,fontWeight:600,
                  color:"var(--text-2)",borderBottom:"1px solid var(--border)",
                  background:"var(--surface)"}}>
                  Unassigned projects ({unassigned.length})
                </div>
                {unassigned.map(p=><ProjectRow key={p.id} project={p}/>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectRow({project:p}:{project:any}) {
  const pm = p.members?.[0]?.user
  const budgetPct = Number(p.budgetTotal)>0
    ? Math.round(Number(p.budgetSpent||0)/Number(p.budgetTotal)*100) : 0
  const hColor = p.health==="GREEN"?"var(--green)":p.health==="AMBER"?"var(--amber)":"var(--red)"
  return (
    <Link href={`/projects/${p.id}`}
      style={{display:"grid",gridTemplateColumns:"auto 1fr 100px 80px 70px 80px",
        gap:10,padding:"9px 18px 9px 44px",alignItems:"center",textDecoration:"none",
        borderBottom:"1px solid var(--surface-1,#F1F5F9)",transition:"background .1s"}}
      onMouseOver={e=>(e.currentTarget.style.background="var(--steel-pale,#EFF6FF)")}
      onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
      <div style={{width:8,height:8,borderRadius:"50%",background:hColor,flexShrink:0}}/>
      <div style={{minWidth:0}}>
        <div style={{fontSize:12,fontWeight:500,color:"var(--text)",
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {p.name}
          <span style={{fontSize:10,fontFamily:"monospace",color:"var(--text-4)",marginLeft:6}}>{p.code}</span>
        </div>
        {pm&&<div style={{fontSize:10,color:"var(--text-3)"}}>{pm.name.split(" ")[0]}</div>}
      </div>
      <div>
        <div style={{fontSize:11,color:"var(--text-3)",marginBottom:2,textAlign:"right"}}>{p.percentComplete}%</div>
        <div style={{height:4,background:"var(--border)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${p.percentComplete}%`,background:hColor,borderRadius:2}}/>
        </div>
      </div>
      <div style={{fontSize:11,color:budgetPct>90?"var(--red)":budgetPct>75?"var(--amber)":"var(--text-3)",
        textAlign:"right",fontWeight:budgetPct>90?600:400}}>{budgetPct}%</div>
      <div style={{textAlign:"right"}}>
        <Badge variant={p.health==="GREEN"?"green":p.health==="AMBER"?"amber":"red"} >
          {p.health==="GREEN"?"On track":p.health==="AMBER"?"At risk":"Off track"}
        </Badge>
      </div>
      <div style={{fontSize:10,color:"var(--text-3)",textAlign:"right"}}>
        {p.endDate?new Date(p.endDate).toLocaleDateString("en-US",{month:"short",year:"2-digit"}):"—"}
      </div>
    </Link>
  )
}
