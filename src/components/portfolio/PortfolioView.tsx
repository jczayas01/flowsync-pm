"use client"
// src/components/portfolio/PortfolioView.tsx
import { useState } from "react"
import { useRouter } from "next/navigation"
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
  const canCreate = !["VIEWER","CLIENT","MEMBER"].includes(userRole)

  const [editingPort, setEditingPort] = useState<any|null>(null)
  const [editForm, setEditForm]       = useState({ name:"", description:"" })
  const [savingPort, setSavingPort]   = useState(false)

  async function savePortfolio() {
    if (!editForm.name.trim() || savingPort) return
    setSavingPort(true)
    try {
      const res = await fetch(`/api/portfolio/${editingPort.id}`, {
        method:"PATCH", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ name: editForm.name.trim(), description: editForm.description || null }),
      })
      if (!res.ok) { const d = await res.json().catch(()=>({})); alert(d?.error||`Update failed (${res.status})`); return }
      setEditingPort(null)
      router.refresh()
    } finally { setSavingPort(false) }
  }

  async function deletePortfolio(port: any) {
    if (port.programs?.length > 0) {
      alert(`"${port.name}" still contains ${port.programs.length} program(s).\n\nDelete or move its programs first — nothing is removed implicitly.`)
      return
    }
    if (!confirm(`Delete portfolio "${port.name}"?`)) return
    const res = await fetch(`/api/portfolio/${port.id}`, {
      method:"DELETE", headers:{"x-workspace-id":workspaceId},
    })
    if (!res.ok) { const d = await res.json().catch(()=>({})); alert(d?.error||`Delete failed (${res.status})`); return }
    router.refresh()
  }

  // Global stats
  const allProjects = portfolios.flatMap(p=>p.programs.flatMap((pr:any)=>pr.projects)).concat(unassigned)
  const global = rollup(allProjects)

  function togglePort(id:string) { setOpenPorts(s=>({...s,[id]:!s[id]})) }
  function toggleProg(id:string) { setOpenProgs(s=>({...s,[id]:!s[id]})) }

  const router = useRouter()
  const [portForm, setPortForm] = useState({ name:"", description:"", color:"#1B6CA8" })
  const [portSaving, setPortSaving] = useState(false)
  const [portError, setPortError]   = useState("")

  async function createPortfolio() {
    if (!portForm.name.trim()) { setPortError("Name is required"); return }
    setPortSaving(true); setPortError("")
    try {
      const res = await fetch("/api/portfolio", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-workspace-id": workspaceId },
        body: JSON.stringify(portForm),
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        setPortError(d.error || "Failed to create portfolio")
        return
      }
      setCreating(false)
      setPortForm({ name:"", description:"", color:"#1B6CA8" })
      router.refresh()
    } catch { setPortError("Network error") }
    finally { setPortSaving(false) }
  }

  const card: React.CSSProperties = {
    background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)"
  }

  const COLORS = ["#1B6CA8","#059669","#7C3AED","#DC2626","#F59E0B","#0E7490","#64748B","#EC4899"]

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* New Portfolio Modal */}
      {creating && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)",
          zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={() => setCreating(false)}>
          <div style={{ background:"#fff", borderRadius:12, padding:28, width:440,
            boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:17, fontWeight:700, color:"var(--text)", marginBottom:20 }}>
              New Portfolio
            </div>
            {portError && (
              <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"var(--red)",
                padding:"9px 12px", borderRadius:"var(--radius)", fontSize:12, marginBottom:14 }}>
                ✗ {portError}
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ display:"block", fontSize:11, fontWeight:700,
                  color:"var(--text-3)", textTransform:"uppercase",
                  letterSpacing:".05em", marginBottom:5 }}>Name *</label>
                <input autoFocus value={portForm.name}
                  onChange={e => setPortForm(f=>({...f, name:e.target.value}))}
                  placeholder="e.g. Digital Transformation Portfolio"
                  style={{ width:"100%", padding:"9px 12px", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
                    color:"var(--text)", outline:"none" }} />
              </div>
              <div>
                <label style={{ display:"block", fontSize:11, fontWeight:700,
                  color:"var(--text-3)", textTransform:"uppercase",
                  letterSpacing:".05em", marginBottom:5 }}>Description</label>
                <textarea rows={3} value={portForm.description}
                  onChange={e => setPortForm(f=>({...f, description:e.target.value}))}
                  placeholder="What projects or programs does this portfolio contain?"
                  style={{ width:"100%", padding:"9px 12px", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
                    color:"var(--text)", outline:"none", resize:"vertical", lineHeight:1.6 }} />
              </div>
              <div>
                <label style={{ display:"block", fontSize:11, fontWeight:700,
                  color:"var(--text-3)", textTransform:"uppercase",
                  letterSpacing:".05em", marginBottom:8 }}>Color</label>
                <div style={{ display:"flex", gap:8 }}>
                  {COLORS.map(c => (
                    <div key={c} onClick={() => setPortForm(f=>({...f, color:c}))}
                      style={{ width:28, height:28, borderRadius:"50%", background:c,
                        cursor:"pointer", border:`3px solid ${portForm.color===c?"#1E293B":"transparent"}`,
                        transition:"border .15s" }} />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:22 }}>
              <button onClick={() => { setCreating(false); setPortError("") }}
                style={{ padding:"9px 18px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:13, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>
                Cancel
              </button>
              <button onClick={createPortfolio} disabled={portSaving||!portForm.name.trim()}
                style={{ padding:"9px 20px", background:"var(--steel)", color:"#fff",
                  border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                  cursor:portSaving?"wait":"pointer", fontFamily:"var(--font)",
                  opacity:!portForm.name.trim()?0.5:1 }}>
                {portSaving ? "Creating…" : "Create portfolio"}
              </button>
            </div>
          </div>
        </div>
      )}
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
                  {editingPort?.id === port.id && (
                    <div style={{padding:"12px 18px",borderBottom:"1px solid var(--border)",
                      background:"var(--surface)",display:"flex",flexDirection:"column",gap:8}}
                      onClick={e=>e.stopPropagation()}>
                      <input value={editForm.name} placeholder="Portfolio name"
                        onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}
                        style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",
                          fontSize:13,fontFamily:"var(--font)"}} />
                      <textarea value={editForm.description} placeholder="Description (optional)" rows={2}
                        onChange={e=>setEditForm(f=>({...f,description:e.target.value}))}
                        style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",
                          fontSize:12,fontFamily:"var(--font)",resize:"vertical"}} />
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={savePortfolio} disabled={savingPort||!editForm.name.trim()}
                          style={{padding:"7px 16px",background:"var(--steel)",color:"#fff",border:"none",
                            borderRadius:"var(--radius)",fontSize:12,fontWeight:600,fontFamily:"var(--font)",
                            cursor:savingPort?"wait":"pointer"}}>
                          {savingPort?"Saving…":"💾 Save"}
                        </button>
                        <button onClick={()=>setEditingPort(null)}
                          style={{padding:"7px 12px",background:"#fff",border:"1px solid var(--border)",
                            borderRadius:"var(--radius)",fontSize:12,cursor:"pointer",
                            fontFamily:"var(--font)",color:"var(--text-2)"}}>Cancel</button>
                      </div>
                    </div>
                  )}

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
                    {canCreate && (
                      <div style={{display:"flex",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                        <button title="Edit portfolio"
                          onClick={()=>{ setEditingPort(port); setEditForm({ name:port.name, description:port.description||"" }) }}
                          style={{padding:"4px 9px",background:"#fff",border:"1px solid var(--border)",
                            borderRadius:"var(--radius)",fontSize:11,cursor:"pointer",
                            fontFamily:"var(--font)",color:"var(--text-2)"}}>✏️</button>
                        <button title="Delete portfolio"
                          onClick={()=>deletePortfolio(port)}
                          style={{padding:"4px 9px",background:"#fff",border:"1px solid #FECACA",
                            borderRadius:"var(--radius)",fontSize:11,cursor:"pointer",
                            fontFamily:"var(--font)",color:"#DC2626"}}>🗑</button>
                      </div>
                    )}
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
        {p.endDate?new Date(p.endDate).toLocaleDateString("en-US", {month:"short",year:"2-digit", timeZone:"UTC" }):"—"}
      </div>
    </Link>
  )
}
