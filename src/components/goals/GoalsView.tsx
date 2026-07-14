"use client"
// src/components/goals/GoalsView.tsx
import { useState } from "react"
import { Badge, Avatar, EmptyState } from "@/components/ui"

const STATUS_COLORS: Record<string,any> = {
  ON_TRACK:"green", AT_RISK:"amber", OFF_TRACK:"red", COMPLETED:"green", DRAFT:"gray"
}
const STATUS_LABELS: Record<string,string> = {
  ON_TRACK:"On track", AT_RISK:"At risk", OFF_TRACK:"Off track", COMPLETED:"Completed", DRAFT:"Draft"
}

// ── Sample goals for empty-state demo ──────────

export function GoalsView({ goals:initialGoals, projects, workspaceId, userRole }:{
  goals:any[]; projects:any[]; workspaceId:string; userRole:string
}) {
  const goals = initialGoals
  const isDemo = false

  const [filter, setFilter]       = useState("all")
  const [expanded, setExpanded]   = useState<Record<string,boolean>>(
    Object.fromEntries(goals.map(g=>[g.id,true]))
  )
  const [creating, setCreating]   = useState(false)
  const [form, setForm]           = useState({ title:"", description:"", type:"ANNUAL", quarter:"", status:"DRAFT" })
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState("")
  const [localGoals, setLocalGoals]= useState(goals)
  const [krForm, setKrForm]        = useState<Record<string,any>>({})
  const [showKrForm, setShowKrForm]= useState<Record<string,boolean>>({})

  function showToast(msg:string){ setToast(msg); setTimeout(()=>setToast(""),3000) }

  const filtered = localGoals.filter(g=>{
    if(filter==="all") return true
    if(filter==="active") return !["COMPLETED","DRAFT"].includes(g.status)
    return g.status===filter
  })

  const onTrack  = localGoals.filter(g=>g.status==="ON_TRACK").length
  const atRisk   = localGoals.filter(g=>g.status==="AT_RISK").length
  const offTrack = localGoals.filter(g=>g.status==="OFF_TRACK").length
  const avgProgress = localGoals.length
    ? Math.round(localGoals.reduce((s,g)=>{
        const kr=(g.keyResults||[]).map((k:any)=>k.progress||0)
        const pj=(g.linkedProjects||[]).map((lp:any)=>lp.percentComplete ?? lp.progress ?? 0)
        const av=[...kr,...pj]
        return s+(av.length?av.reduce((a:number,b:number)=>a+b,0)/av.length:(g.progress||0))
      },0)/localGoals.length) : 0

  async function createGoal(e:React.FormEvent) {
    e.preventDefault()
    if(!form.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/goals", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...form, workspaceId})
      })
      if(res.ok) {
        const { data } = await res.json()
        setLocalGoals(g=>[...g,{...data,keyResults:data.keyResults||[],linkedProjects:data.linkedProjects||[]}])
        showToast("✓ Goal created")
        setCreating(false)
        setForm({title:"",description:"",type:"ANNUAL",quarter:"",status:"DRAFT"})
      }
    } catch{ showToast("Create failed — goals schema may need migration") }
    finally { setSaving(false) }
  }

  // Update a goal and replace it in local state with the server's fresh copy
  // (key results, linked projects with live progress, and rolled-up progress).
  async function patchGoal(goalId:string, body:any):Promise<boolean> {
    const res = await fetch(`/api/goals/${goalId}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body),
    })
    if(res.ok){
      const { data } = await res.json()
      setLocalGoals(gs=>gs.map(g=>g.id===goalId?{
        ...g, ...data,
        keyResults:(data.keyResults||[]).map((kr:any)=>({ id:kr.id, title:kr.title, target:kr.target, current:kr.currentValue, baseline:kr.baseline, unit:kr.unit, progress:kr.progress })),
        linkedProjects:data.linkedProjects||[],
      }:g))
      return true
    }
    const d = await res.json().catch(()=>({})); showToast("✗ "+(d.error||"Update failed")); return false
  }
  async function changeStatus(goalId:string, status:string){ await patchGoal(goalId,{ status }) }
  async function removeGoal(goalId:string){
    if(!confirm("Delete this goal and its key results?")) return
    const res = await fetch(`/api/goals/${goalId}`, { method:"DELETE" })
    if(res.ok){ setLocalGoals(gs=>gs.filter(g=>g.id!==goalId)); showToast("Goal deleted") }
    else showToast("✗ Delete failed")
  }
  // Whole-set replace for key results (used by add / edit-current / delete).
  async function saveKeyResults(goalId:string, krs:any[]){
    return patchGoal(goalId,{ keyResults: krs.map(kr=>({ title:kr.title, target:Number(kr.target)||0, currentValue:Number(kr.current)||0, baseline:(kr.baseline!=null&&kr.baseline!=="")?Number(kr.baseline):null, unit:kr.unit||null })) })
  }
  async function setLinked(goalId:string, projectIds:string[]){ await patchGoal(goalId,{ projectIds }) }

  const canCreate = ["SUPER_ADMIN","OWNER","ADMIN","PMO_DIRECTOR","PROGRAM_MANAGER"].includes(userRole)
  const input: React.CSSProperties = {
    width:"100%", padding:"8px 10px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    color:"var(--text)", outline:"none"
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",position:"relative"}}>
      {/* Header */}
      <div style={{background:"#fff",borderBottom:"1px solid var(--border)",padding:"14px 20px",
        display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:17,fontWeight:600,color:"var(--text)",marginBottom:2}}>Goals & OKRs</h1>
          <p style={{fontSize:12,color:"var(--text-3)"}}>
            {localGoals.length} goal{localGoals.length!==1?"s":""} · {avgProgress}% avg progress
            {isDemo&&" · "}
            {isDemo&&<span style={{color:"var(--amber)",fontWeight:500}}>Sample data shown</span>}
          </p>
        </div>
        {canCreate&&(
          <button onClick={()=>setCreating(true)}
            style={{padding:"8px 16px",background:"var(--steel)",color:"#fff",border:"none",
              borderRadius:"var(--radius)",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)"}}>
            + New goal
          </button>
        )}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:20}}>
        {/* KPI strip */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
          {[
            {label:"On track",   value:onTrack,   color:"var(--green)", bg:"#ECFDF5"},
            {label:"At risk",    value:atRisk,    color:"var(--amber)", bg:"#FFFBEB"},
            {label:"Off track",  value:offTrack,  color:"var(--red)",   bg:"#FEF2F2"},
            {label:"Avg progress",value:`${avgProgress}%`,color:"var(--steel)",bg:"var(--steel-pale,#EFF6FF)"},
          ].map(k=>(
            <div key={k.label} style={{background:k.bg,border:`1px solid ${k.color}20`,
              borderRadius:"var(--radius)",padding:"12px 14px"}}>
              <div style={{fontSize:24,fontWeight:700,color:k.color,lineHeight:1}}>{k.value}</div>
              <div style={{fontSize:11,color:"var(--text-3)",marginTop:4}}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
          {[
            {id:"all",      label:"All goals"},
            {id:"active",   label:"Active"},
            {id:"ON_TRACK", label:"On track"},
            {id:"AT_RISK",  label:"At risk"},
            {id:"OFF_TRACK",label:"Off track"},
            {id:"COMPLETED",label:"Completed"},
          ].map(f=>(
            <button key={f.id} onClick={()=>setFilter(f.id)}
              style={{padding:"6px 12px",border:"1px solid var(--border)",borderRadius:20,
                fontSize:12,cursor:"pointer",fontFamily:"var(--font)",
                background:filter===f.id?"var(--steel)":"#fff",
                color:filter===f.id?"#fff":"var(--text-3)",
                borderColor:filter===f.id?"var(--steel)":"var(--border)",
                fontWeight:filter===f.id?600:400}}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Create goal form */}
        {creating&&(
          <form onSubmit={createGoal}
            style={{background:"#fff",border:"2px solid var(--steel)",borderRadius:"var(--radius)",
              padding:20,marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:14}}>
              🎯 New strategic goal
            </div>
            <div style={{marginBottom:12}}>
              <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>
                Goal title *
              </label>
              <input value={form.title} autoFocus
                onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                placeholder="e.g. Launch new product by Q4, Reduce costs by 20%, Achieve ISO certification"
                style={input} />
            </div>
            <div style={{marginBottom:12}}>
              <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>
                Description
              </label>
              <textarea value={form.description} rows={2}
                onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                placeholder="What does success look like?"
                style={{...input,resize:"vertical",lineHeight:1.5}} />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>Type</label>
                <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}
                  style={{...input,appearance:"none" as const,cursor:"pointer"}}>
                  <option value="ANNUAL">Annual</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>Quarter</label>
                <input value={form.quarter} onChange={e=>setForm(f=>({...f,quarter:e.target.value}))}
                  placeholder="e.g. Q4 2026" style={input} />
              </div>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>Status</label>
                <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}
                  style={{...input,appearance:"none" as const,cursor:"pointer"}}>
                  <option value="DRAFT">Draft</option>
                  <option value="ON_TRACK">On track</option>
                  <option value="AT_RISK">At risk</option>
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button type="button" onClick={()=>setCreating(false)}
                style={{padding:"9px 16px",background:"#fff",border:"1px solid var(--border)",
                  borderRadius:"var(--radius)",fontSize:13,cursor:"pointer",fontFamily:"var(--font)",color:"var(--text-2)"}}>
                Cancel
              </button>
              <button type="submit" disabled={!form.title.trim()||saving}
                style={{padding:"9px 20px",background:"var(--steel)",color:"#fff",border:"none",
                  borderRadius:"var(--radius)",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)",
                  opacity:!form.title.trim()?0.5:1}}>
                {saving?"Saving…":"Create goal"}
              </button>
            </div>
          </form>
        )}

        {/* Goals list */}
        {filtered.length===0?(
          <EmptyState icon="🎯" title="No goals yet"
            description="Create strategic goals and link them to projects and key results." />
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {filtered.map(goal=>{
              const isOpen = expanded[goal.id]!==false
              // Roll up BOTH key-result progress AND linked-project completion (equal weight across all contributors)
              const krVals   = (goal.keyResults||[]).map((kr:any)=>kr.progress||0)
              const projVals = (goal.linkedProjects||[]).map((lp:any)=>lp.percentComplete ?? lp.progress ?? 0)
              const allVals  = [...krVals, ...projVals]
              const avgKR    = allVals.length
                ? Math.round(allVals.reduce((s:number,v:number)=>s+v,0)/allVals.length)
                : goal.progress||0
              return (
                <div key={goal.id} style={{background:"#fff",border:"1px solid var(--border)",
                  borderRadius:"var(--radius)",overflow:"hidden"}}>
                  {/* Goal header */}
                  <div onClick={()=>setExpanded(e=>({...e,[goal.id]:!e[goal.id]}))}
                    style={{padding:"16px 18px",display:"flex",alignItems:"flex-start",gap:12,
                      cursor:"pointer",transition:"background .1s"}}
                    onMouseOver={e=>(e.currentTarget.style.background="var(--surface)")}
                    onMouseOut={e=>(e.currentTarget.style.background="#fff")}>
                    {/* Progress circle */}
                    <div style={{position:"relative",width:44,height:44,flexShrink:0}}>
                      <svg width={44} height={44} style={{transform:"rotate(-90deg)"}}>
                        <circle cx={22} cy={22} r={18} fill="none" stroke="var(--border)" strokeWidth={4}/>
                        <circle cx={22} cy={22} r={18} fill="none"
                          stroke={goal.status==="ON_TRACK"?"var(--green)":goal.status==="AT_RISK"?"var(--amber)":"var(--red)"}
                          strokeWidth={4}
                          strokeDasharray={`${2*Math.PI*18}`}
                          strokeDashoffset={`${2*Math.PI*18*(1-avgKR/100)}`}
                          strokeLinecap="round"/>
                      </svg>
                      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
                        justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--text)"}}>
                        {avgKR}%
                      </div>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                        <span style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{goal.title}</span>
                        <Badge variant={STATUS_COLORS[goal.status]||"gray"}>
                          {STATUS_LABELS[goal.status]||goal.status}
                        </Badge>
                        {goal.type&&(
                          <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:4,
                            background:"var(--surface-1,#F1F5F9)",color:"var(--text-3)"}}>
                            {goal.type}
                          </span>
                        )}
                        {goal.quarter&&(
                          <span style={{fontSize:10,color:"var(--text-3)"}}>{goal.quarter}</span>
                        )}
                      </div>
                      {goal.description&&(
                        <div style={{fontSize:12,color:"var(--text-3)",lineHeight:1.55,marginBottom:6}}>
                          {goal.description}
                        </div>
                      )}
                      <div style={{display:"flex",gap:12,fontSize:11,color:"var(--text-3)"}}>
                        {goal.owner&&<span>Owner: {goal.owner.name}</span>}
                        {goal.keyResults&&<span>{goal.keyResults.length} key result{goal.keyResults.length!==1?"s":""}</span>}
                        {goal.linkedProjects?.length>0&&(
                          <span>🔗 {goal.linkedProjects.length} project{goal.linkedProjects.length!==1?"s":""}</span>
                        )}
                      </div>
                    </div>
                    {canCreate&&(
                      <div onClick={e=>e.stopPropagation()}
                        style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                        <select value={goal.status} onChange={e=>changeStatus(goal.id,e.target.value)}
                          style={{fontSize:11,padding:"3px 5px",borderRadius:5,border:"1px solid var(--border)",
                            background:"#fff",color:"var(--text-2)",fontFamily:"var(--font)",cursor:"pointer"}}>
                          {["DRAFT","ON_TRACK","AT_RISK","OFF_TRACK","ACHIEVED","MISSED"].map(s=>(
                            <option key={s} value={s}>{STATUS_LABELS[s]||s}</option>
                          ))}
                        </select>
                        <button onClick={()=>removeGoal(goal.id)} title="Delete goal"
                          style={{fontSize:13,background:"none",border:"none",cursor:"pointer",color:"var(--text-4)",padding:2}}>🗑</button>
                      </div>
                    )}
                    <span style={{fontSize:12,color:"var(--text-4)",flexShrink:0,
                      transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
                  </div>

                  {/* Key results + linked projects */}
                  {isOpen&&(
                    <div style={{borderTop:"1px solid var(--border)",background:"var(--surface)"}}>
                      {/* Key results */}
                      <div style={{padding:"12px 18px"}}>
                        <div style={{fontSize:11,fontWeight:600,color:"var(--text-3)",
                          letterSpacing:".06em",textTransform:"uppercase",marginBottom:10}}>
                          Key results
                        </div>
                        {(goal.keyResults||[]).length===0&&(
                          <div style={{fontSize:12,color:"var(--text-4)",marginBottom:8}}>No key results yet.</div>
                        )}
                        {(goal.keyResults||[]).map((kr:any)=>{
                          const progressColor = kr.progress>=80?"var(--green)":
                            kr.progress>=50?"var(--steel)":kr.progress>=25?"var(--amber)":"var(--red)"
                          return (
                            <div key={kr.id} style={{marginBottom:12,paddingBottom:12,
                              borderBottom:"1px solid var(--border)"}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                                <div style={{width:6,height:6,borderRadius:"50%",background:progressColor,flexShrink:0}}/>
                                <span style={{flex:1,fontSize:12,fontWeight:500,color:"var(--text)"}}>{kr.title}</span>
                                <span style={{fontSize:12,fontWeight:700,color:progressColor,flexShrink:0}}>{kr.progress}%</span>
                                {canCreate&&(
                                  <button onClick={()=>saveKeyResults(goal.id,(goal.keyResults||[]).filter((k:any)=>k.id!==kr.id))}
                                    title="Remove key result"
                                    style={{fontSize:12,background:"none",border:"none",cursor:"pointer",color:"var(--text-4)",padding:0}}>✕</button>
                                )}
                              </div>
                              <div style={{height:6,background:"var(--border)",borderRadius:3,overflow:"hidden",marginLeft:14}}>
                                <div style={{height:"100%",width:`${kr.progress}%`,background:progressColor,borderRadius:3,transition:"width .5s"}}/>
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:"var(--text-3)",marginTop:4,marginLeft:14}}>
                                {canCreate?(
                                  <>
                                    <span>Current</span>
                                    <input type="number" defaultValue={kr.current}
                                      onBlur={e=>{ const v=Number(e.target.value); if(v!==Number(kr.current)) saveKeyResults(goal.id,(goal.keyResults||[]).map((k:any)=>k.id===kr.id?{...k,current:v}:k)) }}
                                      style={{width:72,fontSize:10,padding:"2px 4px",border:"1px solid var(--border)",borderRadius:4,fontFamily:"var(--font)"}}/>
                                    <span>{kr.baseline!=null?`from ${kr.baseline} → `:"of "}{kr.unit==="$"?`$${Number(kr.target).toLocaleString("en-US")}`:`${kr.target}${kr.unit?" "+kr.unit:""}`}</span>
                                  </>
                                ):(
                                  <span>{kr.unit==="$"?`$${Number(kr.current).toLocaleString("en-US")} → $${Number(kr.target).toLocaleString("en-US")}`:`${kr.current}${kr.unit||""} of ${kr.target}${kr.unit||""}`}</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        {canCreate&&(showKrForm[goal.id]?(
                          <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",marginTop:4}}>
                            <input placeholder="Key result" value={krForm[goal.id]?.title||""}
                              onChange={e=>setKrForm(f=>({...f,[goal.id]:{...f[goal.id],title:e.target.value}}))}
                              style={{flex:"1 1 170px",fontSize:12,padding:"5px 7px",border:"1px solid var(--border)",borderRadius:5,fontFamily:"var(--font)"}}/>
                            <input placeholder="Current" type="number" value={krForm[goal.id]?.current??""}
                              onChange={e=>setKrForm(f=>({...f,[goal.id]:{...f[goal.id],current:e.target.value}}))}
                              style={{width:78,fontSize:12,padding:"5px 7px",border:"1px solid var(--border)",borderRadius:5,fontFamily:"var(--font)"}}/>
                            <input placeholder="Start" type="number" title="Starting value (for reduction goals, set this above the target)" value={krForm[goal.id]?.baseline??""}
                              onChange={e=>setKrForm(f=>({...f,[goal.id]:{...f[goal.id],baseline:e.target.value}}))}
                              style={{width:70,fontSize:12,padding:"5px 7px",border:"1px solid var(--border)",borderRadius:5,fontFamily:"var(--font)"}}/>
                            <input placeholder="Target" type="number" value={krForm[goal.id]?.target??""}
                              onChange={e=>setKrForm(f=>({...f,[goal.id]:{...f[goal.id],target:e.target.value}}))}
                              style={{width:78,fontSize:12,padding:"5px 7px",border:"1px solid var(--border)",borderRadius:5,fontFamily:"var(--font)"}}/>
                            <input placeholder="Unit" value={krForm[goal.id]?.unit||""}
                              onChange={e=>setKrForm(f=>({...f,[goal.id]:{...f[goal.id],unit:e.target.value}}))}
                              style={{width:64,fontSize:12,padding:"5px 7px",border:"1px solid var(--border)",borderRadius:5,fontFamily:"var(--font)"}}/>
                            <button onClick={async()=>{ const kf=krForm[goal.id]; if(!kf?.title?.trim())return;
                              const okr=await saveKeyResults(goal.id,[...(goal.keyResults||[]),{title:kf.title,current:Number(kf.current)||0,target:Number(kf.target)||100,baseline:(kf.baseline!=null&&kf.baseline!=="")?Number(kf.baseline):null,unit:kf.unit||null}]);
                              if(okr){ setKrForm(f=>({...f,[goal.id]:{}})); setShowKrForm(s=>({...s,[goal.id]:false})) } }}
                              style={{fontSize:12,padding:"5px 12px",background:"var(--steel)",color:"#fff",border:"none",borderRadius:5,cursor:"pointer",fontFamily:"var(--font)"}}>Add</button>
                            <button onClick={()=>setShowKrForm(s=>({...s,[goal.id]:false}))}
                              style={{fontSize:12,padding:"5px 8px",background:"none",border:"none",cursor:"pointer",color:"var(--text-4)",fontFamily:"var(--font)"}}>Cancel</button>
                          </div>
                        ):(
                          <button onClick={()=>setShowKrForm(s=>({...s,[goal.id]:true}))}
                            style={{fontSize:12,color:"var(--steel)",background:"none",border:"none",cursor:"pointer",fontFamily:"var(--font)",padding:"4px 0"}}>
                            + Add key result
                          </button>
                        ))}
                      </div>

                      {/* Linked projects — live progress (flows/syncs from the projects) */}
                      <div style={{padding:"12px 18px",borderTop:"1px solid var(--border)"}}>
                        <div style={{fontSize:11,fontWeight:600,color:"var(--text-3)",
                          letterSpacing:".06em",textTransform:"uppercase",marginBottom:10}}>
                          Linked projects · live progress
                        </div>
                        {(goal.linkedProjects||[]).length===0&&(
                          <div style={{fontSize:12,color:"var(--text-4)",marginBottom:8}}>No projects linked.</div>
                        )}
                        {(goal.linkedProjects||[]).map((p:any)=>{
                          const hc = p.health==="RED"?"var(--red)":p.health==="AMBER"?"var(--amber)":"var(--green)"
                          return (
                            <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                              <span style={{fontSize:10,fontFamily:"monospace",color:"var(--text-4)",width:52,flexShrink:0}}>{p.code}</span>
                              <span style={{flex:1,fontSize:12,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                              <div style={{width:90,height:6,background:"var(--border)",borderRadius:3,overflow:"hidden",flexShrink:0}}>
                                <div style={{height:"100%",width:`${p.percentComplete||0}%`,background:hc,borderRadius:3}}/>
                              </div>
                              <span style={{fontSize:11,fontWeight:700,color:hc,width:34,textAlign:"right",flexShrink:0}}>{p.percentComplete||0}%</span>
                              {canCreate&&(
                                <button onClick={()=>setLinked(goal.id,(goal.linkedProjects||[]).filter((x:any)=>x.id!==p.id).map((x:any)=>x.id))}
                                  title="Unlink project"
                                  style={{fontSize:12,background:"none",border:"none",cursor:"pointer",color:"var(--text-4)",padding:0}}>✕</button>
                              )}
                            </div>
                          )
                        })}
                        {canCreate&&(()=>{
                          const linkedIds = new Set((goal.linkedProjects||[]).map((p:any)=>p.id))
                          const avail = (projects||[]).filter((p:any)=>!linkedIds.has(p.id))
                          if(avail.length===0) return null
                          return (
                            <select defaultValue=""
                              onChange={e=>{ const v=e.target.value; e.target.value=""; if(v) setLinked(goal.id,[...(goal.linkedProjects||[]).map((x:any)=>x.id),v]) }}
                              style={{fontSize:11,padding:"4px 6px",borderRadius:5,border:"1px solid var(--border)",background:"#fff",color:"var(--text-2)",cursor:"pointer",fontFamily:"var(--font)",marginTop:4}}>
                              <option value="">🔗 Link a project…</option>
                              {avail.map((p:any)=>(<option key={p.id} value={p.id}>{p.code} · {p.name}</option>))}
                            </select>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
          background:"var(--navy,#0D1B2A)",color:"#fff",padding:"10px 20px",borderRadius:9,
          fontSize:13,zIndex:999,boxShadow:"0 8px 24px rgba(0,0,0,.25)",whiteSpace:"nowrap"}}>
          {toast}
        </div>
      )}
    </div>
  )
}
