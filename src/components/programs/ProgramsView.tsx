"use client"
// src/components/programs/ProgramsView.tsx
// PM Standard — Portfolio Hierarchy — Portfolio → Program → Project hierarchy

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Avatar } from "@/components/ui"

const HEALTH: Record<string,{color:string;label:string;dot:string}> = {
  GREEN:  { color:"#059669", label:"On track",  dot:"🟢" },
  AMBER:  { color:"#D97706", label:"At risk",   dot:"🟡" },
  RED:    { color:"#DC2626", label:"Off track", dot:"🔴" },
}
const METHOD: Record<string,{color:string;bg:string}> = {
  WATERFALL:{ color:"#1B6CA8", bg:"#EFF6FF" },
  SCRUM:    { color:"#7C3AED", bg:"#F5F3FF" },
  AGILE:    { color:"#059669", bg:"#ECFDF5" },
}
function fmtDate(d:any) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric", timeZone:"UTC" })
}
function fmtCurrency(n:number) {
  if (n>=1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if (n>=1_000)     return `$${(n/1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString("en-US")}`
}

export function ProgramsView({ programs: programsProp, portfolios, unassignedProjects: unassignedProp, workspaceId, userRole }: {
  programs:any[]; portfolios:any[]; unassignedProjects:any[];
  workspaceId:string; userRole:string
}) {
  const router = useRouter()
  // Mirror server data into local state so assignment can update the UI optimistically;
  // re-sync whenever the server sends fresh props (after router.refresh()).
  const [programs, setPrograms] = useState<any[]>(programsProp)
  const [unassignedProjects, setUnassignedProjects] = useState<any[]>(unassignedProp)
  useEffect(() => { setPrograms(programsProp) }, [programsProp])
  useEffect(() => { setUnassignedProjects(unassignedProp) }, [unassignedProp])
  const [showCreate, setShowCreate]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState("")
  // Collapsed by default (same as Portfolio) — summary rows first, expand on demand.
  const [collapsed, setCollapsed]     = useState<Set<string>>(new Set(programsProp.map((p:any)=>p.id)))
  const [assigning, setAssigning]     = useState<string|null>(null)
  const [editingProg, setEditingProg] = useState<any|null>(null)
  const [editForm, setEditForm]       = useState({ name:"", description:"" })
  const [savingProg, setSavingProg]   = useState(false)

  async function saveProgram() {
    if (!editForm.name.trim() || savingProg) return
    setSavingProg(true)
    try {
      const res = await fetch(`/api/programs/${editingProg.id}`, {
        method:"PATCH", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ name: editForm.name.trim(), description: editForm.description || null }),
      })
      if (!res.ok) { const d = await res.json().catch(()=>({})); alert(d?.error||`Update failed (${res.status})`); return }
      setEditingProg(null)
      router.refresh()
    } finally { setSavingProg(false) }
  }

  async function deleteProgram(prog: any) {
    if (!confirm(`Delete program "${prog.name}"?\n\nIts ${prog.projects.length} project(s) will NOT be deleted — they return to Unassigned.`)) return
    const res = await fetch(`/api/programs/${prog.id}`, {
      method:"DELETE", headers:{"x-workspace-id":workspaceId},
    })
    if (!res.ok) { const d = await res.json().catch(()=>({})); alert(d?.error||`Delete failed (${res.status})`); return }
    router.refresh()
  }

  const [form, setForm]               = useState({
    name:"", description:"", portfolioId:"", color:"#1B6CA8"
  })

  const canCreate = ["OWNER","ADMIN","PMO_DIRECTOR","PROGRAM_MANAGER"].includes(userRole)
  const canAssign = canCreate   // program-management roles may assign projects to programs
  const COLORS = ["#1B6CA8","#059669","#7C3AED","#DC2626","#F59E0B","#0E7490","#64748B","#EC4899"]

  async function assignToProgram(projectId: string, programId: string) {
    if (!programId) return
    setAssigning(projectId)
    try {
      const res = await fetch(`/api/projects/${projectId}/program`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ programId }),
      })
      if (res.ok) {
        // Optimistic move: pull the project out of the unassigned list and drop it
        // into the target program immediately, then reconcile with the server.
        const proj = unassignedProjects.find(p => p.id === projectId)
        if (proj) {
          setUnassignedProjects(prev => prev.filter(p => p.id !== projectId))
          setPrograms(prev => prev.map(pr => pr.id === programId
            ? { ...pr, projects: [...(pr.projects || []), { ...proj, budgetTotal:0, budgetSpent:0 }] }
            : pr))
        }
        router.refresh()
        return
      }
      const d = await res.json().catch(()=>({}))
      setError(d.error || "Failed to assign project to program")
    } finally { setAssigning(null) }
  }

  async function createProgram() {
    if (!form.name.trim() || !form.portfolioId) {
      setError("Name and portfolio are required"); return
    }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/programs", {
        method:"POST",
        headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        setError(d.error || "Failed to create program"); return
      }
      setShowCreate(false)
      setForm({ name:"", description:"", portfolioId:"", color:"#1B6CA8" })
      router.refresh()
    } finally { setSaving(false) }
  }

  function toggle(id:string) {
    setCollapsed(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })
  }

  const inp: React.CSSProperties = {
    width:"100%", padding:"8px 12px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    color:"var(--text)", outline:"none",
  }
  const lbl: React.CSSProperties = {
    display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
    textTransform:"uppercase", letterSpacing:".05em", marginBottom:5,
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ background:"var(--steel)", padding:"16px 20px", color:"#fff",
        display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <div style={{ fontSize:11, opacity:.5, textTransform:"uppercase",
            letterSpacing:".08em", marginBottom:4 }}>
            PM Standard — Portfolio Hierarchy — Value Delivery Components
          </div>
          <div style={{ fontSize:18, fontWeight:700 }}>Programs</div>
          <div style={{ fontSize:12, opacity:.65, marginTop:2 }}>
            Portfolio → <span style={{ color:"#93C5FD" }}>Program</span> → Project
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <div style={{ fontSize:12, opacity:.7 }}>
            {programs.length} program{programs.length!==1?"s":""} ·{" "}
            {programs.reduce((s,p)=>s+p.projects.length,0)} projects
          </div>
          {canCreate && (
            <button onClick={() => setShowCreate(s=>!s)}
              style={{ padding:"8px 16px", background:"rgba(255,255,255,.15)",
                color:"#fff", border:"1px solid rgba(255,255,255,.3)",
                borderRadius:"var(--radius)", fontSize:12, fontWeight:500,
                cursor:"pointer", fontFamily:"var(--font)" }}>
              {showCreate ? "Cancel" : "+ New program"}
            </button>
          )}
        </div>
      </div>

      {/* PM Standard info strip */}
      <div style={{ background:"#EFF6FF", borderBottom:"1px solid #BFDBFE",
        padding:"8px 20px", fontSize:11, color:"#1E40AF", flexShrink:0 }}>
        A <strong>Program</strong> is a group of related projects managed in a coordinated way to obtain
        benefits not available from managing them individually (PM Standard — Portfolio Hierarchy).
        Programs sit between Portfolio and individual Projects in the governance hierarchy.
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:16 }}>

        {/* Create program form */}
        {showCreate && (
          <div style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:20, marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text)", marginBottom:14 }}>
              New Program
            </div>
            {error && (
              <div style={{ color:"var(--red)", fontSize:12, marginBottom:12 }}>✗ {error}</div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lbl}>Program name *</label>
                <input style={inp} value={form.name}
                  onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                  placeholder="e.g. Digital Health Program" />
              </div>
              <div>
                <label style={lbl}>Portfolio *</label>
                <select style={{...inp,cursor:"pointer"}} value={form.portfolioId}
                  onChange={e=>setForm(f=>({...f,portfolioId:e.target.value}))}>
                  <option value="">Select portfolio…</option>
                  {portfolios.map(p=>(
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Color</label>
                <div style={{ display:"flex", gap:8, paddingTop:4 }}>
                  {COLORS.map(c=>(
                    <div key={c} onClick={()=>setForm(f=>({...f,color:c}))}
                      style={{ width:26,height:26,borderRadius:"50%",background:c,cursor:"pointer",
                        border:`3px solid ${form.color===c?"#1E293B":"transparent"}` }} />
                  ))}
                </div>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lbl}>Description</label>
                <textarea rows={2} style={{...inp,resize:"vertical",lineHeight:1.6}}
                  value={form.description}
                  onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                  placeholder="What strategic objective does this program deliver?" />
              </div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={createProgram} disabled={saving||!form.name.trim()||!form.portfolioId}
                style={{ padding:"9px 20px", background:"var(--steel)", color:"#fff",
                  border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                  cursor:"pointer", fontFamily:"var(--font)",
                  opacity:(!form.name.trim()||!form.portfolioId)?0.5:1 }}>
                {saving?"Creating…":"Create program"}
              </button>
              <button onClick={()=>{ setShowCreate(false); setError("") }}
                style={{ padding:"9px 18px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:13, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Programs list */}
        {programs.length === 0 && !showCreate ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🗂</div>
            <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>
              No programs yet
            </div>
            <div style={{ fontSize:13, color:"var(--text-3)", maxWidth:440, margin:"0 auto 20px",
              lineHeight:1.7 }}>
              Programs group related projects to achieve strategic benefits.
              Create your first program to organize projects under a common objective.
            </div>
            {canCreate && (
              <button onClick={()=>setShowCreate(true)}
                style={{ padding:"10px 20px", background:"var(--steel)", color:"#fff",
                  border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                  cursor:"pointer", fontFamily:"var(--font)" }}>
                + New program
              </button>
            )}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {programs.map(prog => {
              const isCollapsed = collapsed.has(prog.id)
              const budget = prog.projects.reduce((s:number,p:any)=>s+p.budgetTotal,0)
              const spent  = prog.projects.reduce((s:number,p:any)=>s+p.budgetSpent,0)
              const avgPct = prog.projects.length
                ? Math.round(prog.projects.reduce((s:number,p:any)=>s+(p.percentComplete||0),0)/prog.projects.length)
                : 0
              const health = prog.projects.some((p:any)=>p.health==="RED") ? "RED"
                : prog.projects.some((p:any)=>p.health==="AMBER") ? "AMBER" : "GREEN"
              const h = HEALTH[health] || HEALTH.GREEN

              return (
                <div key={prog.id} style={{ background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", overflow:"hidden" }}>

                  {editingProg?.id === prog.id && (
                    <div style={{ padding:"12px 18px", borderBottom:"1px solid var(--border)",
                      background:"var(--surface)", display:"flex", flexDirection:"column", gap:8 }}
                      onClick={e=>e.stopPropagation()}>
                      <input value={editForm.name} placeholder="Program name"
                        onChange={e=>setEditForm(f=>({...f, name:e.target.value}))}
                        style={{ padding:"8px 10px", border:"1px solid var(--border)", borderRadius:"var(--radius)",
                          fontSize:13, fontFamily:"var(--font)" }} />
                      <textarea value={editForm.description} placeholder="Description (optional)" rows={2}
                        onChange={e=>setEditForm(f=>({...f, description:e.target.value}))}
                        style={{ padding:"8px 10px", border:"1px solid var(--border)", borderRadius:"var(--radius)",
                          fontSize:12, fontFamily:"var(--font)", resize:"vertical" }} />
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={saveProgram} disabled={savingProg || !editForm.name.trim()}
                          style={{ padding:"7px 16px", background:"var(--steel)", color:"#fff", border:"none",
                            borderRadius:"var(--radius)", fontSize:12, fontWeight:600, fontFamily:"var(--font)",
                            cursor: savingProg ? "wait" : "pointer" }}>
                          {savingProg ? "Saving…" : "💾 Save"}
                        </button>
                        <button onClick={() => setEditingProg(null)}
                          style={{ padding:"7px 12px", background:"#fff", border:"1px solid var(--border)",
                            borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                            fontFamily:"var(--font)", color:"var(--text-2)" }}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Program header */}
                  <div style={{ padding:"14px 18px", borderBottom: isCollapsed?"none":"1px solid var(--border)",
                    display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
                    onClick={() => toggle(prog.id)}>
                    <div style={{ width:6, height:36, borderRadius:3,
                      background:prog.color||"#1B6CA8", flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>
                          {prog.name}
                        </span>
                        <span style={{ fontSize:10, padding:"2px 7px", borderRadius:10,
                          background:h.color+"15", color:h.color, fontWeight:700 }}>
                          {h.dot} {h.label}
                        </span>
                        <span style={{ fontSize:10, color:"var(--text-4)" }}>
                          {prog.portfolio?.name}
                        </span>
                      </div>
                      <div style={{ display:"flex", gap:16, fontSize:11, color:"var(--text-3)" }}>
                        <span>📁 {prog.projects.length} project{prog.projects.length!==1?"s":""}</span>
                        {budget>0 && <span>💰 {fmtCurrency(budget)} budget</span>}
                        <span>📊 {avgPct}% avg complete</span>
                        {prog.manager && (
                          <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                            <Avatar name={prog.manager.name} size={14} />
                            {prog.manager.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ width:100, flexShrink:0 }}>
                      <div style={{ height:6, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:3, width:`${avgPct}%`,
                          background:avgPct>=80?"var(--green)":avgPct>=50?"var(--steel)":"var(--amber)" }} />
                      </div>
                      <div style={{ fontSize:10, color:"var(--text-3)", textAlign:"right", marginTop:2 }}>
                        {avgPct}%
                      </div>
                    </div>

                    {canAssign && (
                      <div style={{ display:"flex", gap:6, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                        <button title="Edit program"
                          onClick={() => { setEditingProg(prog); setEditForm({ name:prog.name, description:prog.description||"" }) }}
                          style={{ padding:"4px 9px", background:"#fff", border:"1px solid var(--border)",
                            borderRadius:"var(--radius)", fontSize:11, cursor:"pointer",
                            fontFamily:"var(--font)", color:"var(--text-2)" }}>✏️</button>
                        <button title="Delete program"
                          onClick={() => deleteProgram(prog)}
                          style={{ padding:"4px 9px", background:"#fff", border:"1px solid #FECACA",
                            borderRadius:"var(--radius)", fontSize:11, cursor:"pointer",
                            fontFamily:"var(--font)", color:"#DC2626" }}>🗑</button>
                      </div>
                    )}
                    <span style={{ fontSize:12, color:"var(--text-4)",
                      transform:isCollapsed?"rotate(-90deg)":"rotate(0)",
                      display:"inline-block", transition:"transform .15s" }}>▼</span>
                  </div>

                  {/* Project list */}
                  {!isCollapsed && (
                    <div style={{ padding:"8px 0" }}>
                      {prog.projects.length === 0 ? (
                        <div style={{ padding:"12px 24px", fontSize:12, color:"var(--text-4)" }}>
                          No projects assigned to this program yet.
                        </div>
                      ) : prog.projects.map((p:any) => {
                        const ph = HEALTH[p.health] || HEALTH.GREEN
                        const m  = METHOD[p.methodology] || METHOD.WATERFALL
                        return (
                          <Link key={p.id} href={`/projects/${p.id}`}
                            style={{ display:"flex", alignItems:"center", gap:12,
                              padding:"9px 24px", textDecoration:"none",
                              borderBottom:"1px solid var(--surface-1,#F8FAFC)" }}
                            onMouseOver={e=>(e.currentTarget.style.background="var(--surface)")}
                            onMouseOut={e =>(e.currentTarget.style.background="transparent")}>
                            <span style={{ fontSize:11, fontFamily:"monospace",
                              color:"var(--text-4)", width:50, flexShrink:0 }}>
                              {p.code}
                            </span>
                            <span style={{ fontSize:13, fontWeight:500, color:"var(--text)",
                              flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {p.name}
                            </span>
                            <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px",
                              borderRadius:8, color:m.color, background:m.bg, flexShrink:0 }}>
                              {p.methodology}
                            </span>
                            <span style={{ fontSize:10, color:ph.color, fontWeight:700,
                              flexShrink:0 }}>{ph.dot} {ph.label}</span>
                            <div style={{ width:60, flexShrink:0 }}>
                              <div style={{ height:4, background:"var(--border)",
                                borderRadius:2, overflow:"hidden" }}>
                                <div style={{ height:"100%", borderRadius:2,
                                  width:`${p.percentComplete||0}%`,
                                  background:"var(--steel)" }} />
                              </div>
                            </div>
                            <span style={{ fontSize:11, color:"var(--text-3)",
                              width:32, textAlign:"right", flexShrink:0 }}>
                              {p.percentComplete||0}%
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Unassigned projects */}
            {unassignedProjects.length > 0 && (
              <div style={{ background:"#fff", border:"1px solid #FDE68A",
                borderRadius:"var(--radius)", overflow:"hidden" }}>
                <div style={{ padding:"12px 18px", borderBottom:"1px solid #FDE68A",
                  background:"#FFFBEB", fontSize:12, fontWeight:600, color:"#92400E" }}>
                  ⚠ {unassignedProjects.length} project{unassignedProjects.length!==1?"s":""} not assigned to any program
                </div>
                {error && (
                  <div style={{ padding:"8px 18px", fontSize:12, color:"var(--red)",
                    background:"#FEF2F2", borderBottom:"1px solid #FDE68A" }}>✗ {error}</div>
                )}
                <div style={{ padding:"8px 0" }}>
                  {unassignedProjects.map((p:any) => {
                    const ph = HEALTH[p.health] || HEALTH.GREEN
                    return (
                      <div key={p.id}
                        style={{ display:"flex", alignItems:"center", gap:12,
                          padding:"9px 24px",
                          borderBottom:"1px solid var(--surface-1,#F8FAFC)" }}>
                        <span style={{ fontSize:11, fontFamily:"monospace",
                          color:"var(--text-4)", width:50 }}>{p.code}</span>
                        <Link href={`/projects/${p.id}`}
                          style={{ fontSize:13, fontWeight:500, color:"var(--text)",
                            flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                            textDecoration:"none" }}>
                          {p.name}
                        </Link>
                        <span style={{ fontSize:10, color:ph.color, fontWeight:700 }}>
                          {ph.dot} {ph.label}
                        </span>
                        {canAssign && (
                          <select defaultValue="" disabled={assigning===p.id || programs.length===0}
                            onChange={e => { const v = e.target.value; e.target.value = ""; assignToProgram(p.id, v) }}
                            style={{ fontSize:11, padding:"4px 6px", borderRadius:"var(--radius)",
                              border:"1px solid var(--border)", background:"#fff",
                              color:"var(--text-2)", cursor:"pointer", fontFamily:"var(--font)" }}>
                            <option value="">{assigning===p.id ? "Assigning…" : "Assign to program…"}</option>
                            {programs.map((pr:any) => (
                              <option key={pr.id} value={pr.id}>{pr.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
