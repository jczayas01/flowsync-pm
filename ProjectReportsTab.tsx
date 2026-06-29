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
const SAMPLE_GOALS = [
  {
    id:"g1", title:"Achieve full EHR deployment across all clinical units",
    description:"Complete the EHR rollout for all 12 clinical departments by Q4 2026.",
    status:"ON_TRACK", type:"ANNUAL", quarter:"Q3 2026", progress:68,
    owner:{name:"Juan Carlos Zayas"}, linkedProjects:["PRJ-001","PRJ-004"],
    keyResults:[
      { id:"kr1", title:"Complete EHR go-live in 12 departments", progress:75, target:12, current:9, unit:"departments" },
      { id:"kr2", title:"Achieve ≥85% staff adoption rate",       progress:72, target:85, current:61, unit:"%" },
      { id:"kr3", title:"Zero critical HIPAA incidents post go-live", progress:100, target:0, current:0, unit:"incidents" },
    ]
  },
  {
    id:"g2", title:"Reduce IT infrastructure operational costs by 30%",
    description:"Cloud migration and infrastructure optimisation to reduce annual OpEx.",
    status:"AT_RISK", type:"ANNUAL", quarter:"Q4 2026", progress:40,
    owner:{name:"Luis Rodriguez"}, linkedProjects:["PRJ-003"],
    keyResults:[
      { id:"kr4", title:"Migrate 80% of on-prem workloads to cloud", progress:40, target:80, current:32, unit:"%" },
      { id:"kr5", title:"Reduce monthly infrastructure spend to $45K", progress:55, target:45000, current:67000, unit:"$" },
    ]
  },
  {
    id:"g3", title:"Achieve HIPAA compliance certification",
    description:"Full compliance with HIPAA Security and Privacy Rules across all systems.",
    status:"ON_TRACK", type:"QUARTERLY", quarter:"Q3 2026", progress:80,
    owner:{name:"Ana González"}, linkedProjects:["PRJ-004"],
    keyResults:[
      { id:"kr6", title:"Complete 18 required security policies",     progress:100, target:18, current:18, unit:"policies" },
      { id:"kr7", title:"Train 100% of workforce on HIPAA",           progress:72,  target:100, current:72, unit:"%" },
      { id:"kr8", title:"Sign BAAs with all 23 business associates",  progress:65,  target:23, current:15, unit:"BAAs" },
    ]
  },
]

export function GoalsView({ goals:initialGoals, workspaceId, userRole }:{
  goals:any[]; workspaceId:string; userRole:string
}) {
  // Use real goals if available, otherwise show sample data
  const goals = initialGoals.length > 0 ? initialGoals : SAMPLE_GOALS
  const isDemo = initialGoals.length === 0

  const [filter, setFilter]       = useState("all")
  const [expanded, setExpanded]   = useState<Record<string,boolean>>(
    Object.fromEntries(goals.map(g=>[g.id,true]))
  )
  const [creating, setCreating]   = useState(false)
  const [form, setForm]           = useState({ title:"", description:"", type:"ANNUAL", quarter:"", status:"DRAFT" })
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState("")
  const [localGoals, setLocalGoals]= useState(goals)

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
    ? Math.round(localGoals.reduce((s,g)=>s+(g.progress||0),0)/localGoals.length) : 0

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
        setLocalGoals(g=>[...g,{...data,keyResults:[]}])
        showToast("✓ Goal created")
        setCreating(false)
        setForm({title:"",description:"",type:"ANNUAL",quarter:"",status:"DRAFT"})
      }
    } catch{ showToast("Create failed — goals schema may need migration") }
    finally { setSaving(false) }
  }

  const canCreate = !["READ_ONLY","CLIENT"].includes(userRole)
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
                placeholder="e.g. Achieve HIPAA compliance certification by Q4"
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
                  <option value="STRATEGIC">Strategic</option>
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
              const avgKR  = goal.keyResults?.length
                ? Math.round(goal.keyResults.reduce((s:number,kr:any)=>s+(kr.progress||0),0)/goal.keyResults.length)
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
                    <span style={{fontSize:12,color:"var(--text-4)",flexShrink:0,
                      transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
                  </div>

                  {/* Key results */}
                  {isOpen&&goal.keyResults&&goal.keyResults.length>0&&(
                    <div style={{borderTop:"1px solid var(--border)",padding:"12px 18px",
                      background:"var(--surface)"}}>
                      <div style={{fontSize:11,fontWeight:600,color:"var(--text-3)",
                        letterSpacing:".06em",textTransform:"uppercase",marginBottom:10}}>
                        Key results
                      </div>
                      {goal.keyResults.map((kr:any)=>{
                        const progressColor = kr.progress>=80?"var(--green)":
                          kr.progress>=50?"var(--steel)":kr.progress>=25?"var(--amber)":"var(--red)"
                        return (
                          <div key={kr.id} style={{marginBottom:12,
                            paddingBottom:12,borderBottom:"1px solid var(--border-strong,#CBD5E1)30"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                              <div style={{width:6,height:6,borderRadius:"50%",
                                background:progressColor,flexShrink:0}}/>
                              <span style={{flex:1,fontSize:12,fontWeight:500,color:"var(--text)"}}>
                                {kr.title}
                              </span>
                              <span style={{fontSize:12,fontWeight:700,color:progressColor,flexShrink:0}}>
                                {kr.progress}%
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div style={{height:6,background:"var(--border)",borderRadius:3,
                              overflow:"hidden",marginLeft:14}}>
                              <div style={{height:"100%",width:`${kr.progress}%`,
                                background:progressColor,borderRadius:3,transition:"width .5s"}}/>
                            </div>
                            {/* Current vs target */}
                            {kr.current!==undefined&&kr.target!==undefined&&(
                              <div style={{fontSize:10,color:"var(--text-3)",marginTop:4,marginLeft:14}}>
                                {kr.unit==="$"
                                  ? `$${Number(kr.current).toLocaleString()} → $${Number(kr.target).toLocaleString()}`
                                  : `${kr.current}${kr.unit||""} of ${kr.target}${kr.unit||""}${kr.unit==="departments"?" departments":""}`
                                }
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {canCreate&&(
                        <button
                          style={{fontSize:12,color:"var(--steel)",background:"none",border:"none",
                            cursor:"pointer",fontFamily:"var(--font)",padding:"4px 0",
                            display:"flex",alignItems:"center",gap:5}}>
                          + Add key result
                        </button>
                      )}
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
