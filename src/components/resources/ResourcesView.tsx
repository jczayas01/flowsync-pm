"use client"
// src/components/resources/ResourcesView.tsx
import { computeWorkload } from "@/lib/workload"
import { useTranslations } from "next-intl"
import { useState, useMemo } from "react"
import { Avatar } from "@/components/ui"

const WEEKS = 8
const CAPACITY_HRS = 40

function heatClass(pct:number, isOff=false):{bg:string;text:string;label:string} {
  if(isOff)    return {bg:"#F1F5F9",text:"#94A3B8",label:"Off"}
  if(pct===0)  return {bg:"#F8FAFC",text:"#CBD5E1",label:"—"}
  if(pct<=50)  return {bg:"#F0FFF4",text:"#166534",label:`${pct}%`}
  if(pct<=80)  return {bg:"#ECFDF5",text:"#059669",label:`${pct}%`}
  if(pct<=95)  return {bg:"#FFFBEB",text:"#92400E",label:`${pct}%`}
  if(pct<=105) return {bg:"#FEF3C7",text:"#92400E",label:`${pct}%`}
  return {bg:"#FEE2E2",text:"#991B1B",label:`${pct}%`}
}

export function ResourcesView({ members, projectAssignments, timeEntries, tasks = [], workspaceId }:{
  members:any[]; projectAssignments:any[]; timeEntries:any[]; tasks?:any[]; workspaceId:string
}) {
  const t = useTranslations("resources")
  const [subTab, setSubTab]   = useState<"heatmap"|"capacity"|"availability">("heatmap")
  const [weeks,  setWeeks]    = useState(8)
  const [overOnly,setOverOnly]= useState(false)

  // Week date labels starting from last Monday
  const wl = useMemo(()=>computeWorkload(tasks, WEEKS),[tasks])
  const weekDates = useMemo(()=>wl.weekStarts.map(ms=>new Date(ms)),[wl])

  const todayIdx = 0 // current week

  // Workload per user — task-effort engine (D1–D4 signed spec; see src/lib/workload.ts)
  const allocationByUser = useMemo(()=>{
    const out: Record<string, any> = {}
    for (const [uid, m] of Object.entries(wl.byUser)) {
      out[uid] = { ...(m as any), total: (m as any).thisWeek,
        projects: (m as any).projects.map((p:any)=>({ ...p, hours: p.thisWeek, color: "var(--steel)" })) }
    }
    return out
  },[wl])

  const overAllocated = members.filter(m=>{
    const uid=m.userId||m.user?.id
    return (allocationByUser[uid]?.total||0)>CAPACITY_HRS
  })

  const displayMembers = overOnly
    ? members.filter(m=>(allocationByUser[m.userId||m.user?.id]?.total||0)>CAPACITY_HRS)
    : members

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Header */}
      <div style={{background:"#fff",borderBottom:"1px solid var(--border)",padding:"14px 20px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <h1 style={{fontSize:17,fontWeight:600,color:"var(--text)",marginBottom:2}}>{t("Resource management")}</h1>
            <p style={{fontSize:12,color:"var(--text-3)"}}>
              {members.length} {members.length!==1?t("team members"):t("team member")} · {CAPACITY_HRS}{t("h/week capacity each")}
            </p>
          </div>
          {overAllocated.length>0&&(
            <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"var(--radius)",
              padding:"8px 14px",fontSize:12,color:"var(--red)",fontWeight:500}}>
              ⚠ {overAllocated.length} {overAllocated.length!==1?t("team members"):t("team member")} {t("over-allocated")}
            </div>
          )}
          {wl.unassigned.count>0 && (
            <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:"var(--radius)",
              padding:"6px 12px",fontSize:12,color:"var(--steel)",fontWeight:600}}>
              📥 {t("Unassigned effort")}: {wl.unassigned.count} {t("tasks")} · {wl.unassigned.hours}h
            </div>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="fs-tabbar" style={{background:"#fff",borderBottom:"1px solid var(--border)",padding:"0 20px",flexShrink:0,display:"flex",gap:0}}>
        {[["heatmap","📊 Workload heatmap"],["capacity","👤 Capacity"],["availability","🗓 Availability"]].map(([id,label])=>(
          <button key={id} onClick={()=>setSubTab(id as any)}
            style={{padding:"10px 14px",border:"none",background:"none",cursor:"pointer",
              fontFamily:"var(--font)",fontSize:12,fontWeight:500,whiteSpace:"nowrap",
              color:subTab===id?"var(--steel)":"var(--text-3)",
              borderBottom:subTab===id?"2px solid var(--steel)":"2px solid transparent",
              marginBottom:-1}}>
            {t(label as any)}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8,padding:"8px 0"}}>
          {subTab==="heatmap"&&(
            <>
              <select value={weeks} onChange={e=>setWeeks(Number(e.target.value))}
                style={{padding:"4px 20px 4px 8px",border:"1px solid var(--border)",borderRadius:5,
                  fontSize:11,fontFamily:"var(--font)",color:"var(--text)",appearance:"none" as const}}>
                <option value={4}>4 weeks</option>
                <option value={8}>8 weeks</option>
                <option value={12}>12 weeks</option>
              </select>
              <button onClick={()=>setOverOnly(o=>!o)}
                style={{padding:"4px 10px",border:"1px solid var(--border)",borderRadius:5,
                  fontSize:11,fontFamily:"var(--font)",cursor:"pointer",
                  background:overOnly?"var(--red-pale,#FEF2F2)":"#fff",
                  color:overOnly?"var(--red)":"var(--text-3)"}}>
                🔴 Over-allocated only
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto"}}>

        {/* HEATMAP */}
        {subTab==="heatmap"&&(
          <div style={{padding:20}}>
            {/* Legend */}
            <div style={{display:"flex",gap:14,marginBottom:14,flexWrap:"wrap"}}>
              <span style={{fontSize:11,fontWeight:600,color:"var(--text-2)"}}>Workload:</span>
              {[
                {bg:"#F0FFF4",text:"#166534",label:"0–50% Free"},
                {bg:"#ECFDF5",text:"#059669",label:"51–80% Optimal"},
                {bg:"#FFFBEB",text:"#92400E",label:"81–95% High"},
                {bg:"#FEF3C7",text:"#92400E",label:"96–105% At limit"},
                {bg:"#FEE2E2",text:"#991B1B",label:"106%+ Over"},
              ].map(l=>(
                <div key={l.label} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--text-3)"}}>
                  <div style={{width:14,height:14,borderRadius:3,background:l.bg,border:`1px solid ${l.text}30`}}/>
                  {l.label}
                </div>
              ))}
            </div>

            {/* Grid */}
            {members.length===0?(
              <div style={{textAlign:"center",padding:48,fontSize:13,color:"var(--text-3)"}}>
                {t("No team members found")}
              </div>
            ):(
              <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:"var(--radius)",overflow:"hidden"}}>
                {/* Column headers */}
                <div style={{display:"grid",
                  minWidth:640,
                  gridTemplateColumns:`180px repeat(${weeks},1fr) 60px`,
                  background:"var(--surface)",borderBottom:"2px solid var(--border)",overflowX:"auto"}}>
                  <div style={{padding:"8px 12px",fontSize:10,fontWeight:600,color:"var(--text-3)",
                    textTransform:"uppercase",letterSpacing:".05em"}}>
                    Team member
                  </div>
                  {weekDates.map((d,i)=>(
                    <div key={i} style={{padding:"6px 4px",textAlign:"center",fontSize:10,
                      fontWeight:600,color:i===todayIdx?"var(--steel)":"var(--text-3)",
                      borderLeft:"1px solid var(--border)",
                      background:i===todayIdx?"var(--steel-pale,#EFF6FF)":"transparent"}}>
                      {d.toLocaleDateString("en-US", {month:"short",day:"numeric", timeZone:"UTC" })}
                    </div>
                  ))}
                  <div style={{padding:"6px 4px",textAlign:"center",fontSize:10,
                    fontWeight:600,color:"var(--text-3)",borderLeft:"1px solid var(--border)"}}>
                    Avg
                  </div>
                </div>

                {/* Rows */}
                {displayMembers.map(m=>{
                  const userId = m.userId||m.user?.id
                  const user   = m.user||m
                  const alloc  = allocationByUser[userId]||{total:0,projects:[]}
                  const weeklyLoads = (alloc.weekly||weekDates.map(()=>0)).map((h:number)=>Math.round(h))
                  const avgPct = Math.round(weeklyLoads.reduce((s,h)=>s+h,0)/weeks/CAPACITY_HRS*100)

                  return (
                    <div key={userId} style={{display:"grid",
                      gridTemplateColumns:`180px repeat(${weeks},1fr) 60px`,
                      borderBottom:"1px solid var(--border)"}}>
                      {/* Name */}
                      <div style={{padding:"8px 12px",display:"flex",alignItems:"center",gap:7,
                        borderRight:"1px solid var(--border)"}}>
                        <Avatar name={user.name||"?"} avatarUrl={user.avatarUrl} size={26}/>
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:500,color:"var(--text)",
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {user.name}
                          </div>
                          <div style={{fontSize:10,color:"var(--text-3)"}}>
                            {m.role?.replace("_"," ")}
                          </div>
                        </div>
                      </div>
                      {/* Week cells */}
                      {weeklyLoads.map((hrs,wi)=>{
                        const pct  = Math.round(hrs/CAPACITY_HRS*100)
                        const heat = heatClass(pct)
                        return (
                          <div key={wi} title={`${hrs}h (${pct}%) — ${weekDates[wi].toLocaleDateString("en-US", { timeZone:"UTC" })}`}
                            style={{borderLeft:"1px solid rgba(0,0,0,.05)",
                              display:"flex",alignItems:"center",justifyContent:"center",cursor:"default",
                              background:wi===todayIdx?heat.bg+"cc":heat.bg}}>
                            <div style={{textAlign:"center"}}>
                              <div style={{fontSize:10,fontWeight:700,color:heat.text}}>{pct}%</div>
                              <div style={{fontSize:9,color:heat.text,opacity:.7}}>{hrs}h</div>
                            </div>
                          </div>
                        )
                      })}
                      {/* Avg */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"center",
                        borderLeft:"1px solid var(--border)"}}>
                        <span style={{fontSize:11,fontWeight:700,
                          color:avgPct>105?"var(--red)":avgPct>90?"var(--amber)":"var(--green)"}}>
                          {avgPct}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* CAPACITY */}
        {subTab==="capacity"&&(
          <div style={{padding:20,display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
            {members.map(m=>{
              const userId = m.userId||m.user?.id
              const user   = m.user||m
              const alloc  = allocationByUser[userId]||{total:0,projects:[]}
              const pct    = Math.round(alloc.total/CAPACITY_HRS*100)
              const over   = pct>105
              const barColor = over?"var(--red)":pct>90?"var(--amber)":"var(--green)"
              return (
                <div key={userId} style={{border:`1px solid ${over?"rgba(220,38,38,.3)":"var(--border)"}`,
                  borderRadius:"var(--radius)",padding:16,
                  background:over?"var(--red-pale,#FEF2F2)":"#fff"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <Avatar name={user.name} avatarUrl={user.avatarUrl} size={34}/>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{user.name}</div>
                        <div style={{fontSize:11,color:"var(--text-3)"}}>{m.role?.replace("_"," ")}</div>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:20,fontWeight:700,color:barColor,lineHeight:1}}>{pct}%</div>
                      <div style={{fontSize:10,color:"var(--text-3)"}}>{alloc.total}/{CAPACITY_HRS}h</div>
                    </div>
                  </div>
                  <div style={{height:6,background:"var(--border)",borderRadius:3,overflow:"hidden",marginBottom:12}}>
                    <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:barColor,borderRadius:3}}/>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    {alloc.projects.map((p:any,i:number)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:7,fontSize:12}}>
                        <div style={{width:8,height:8,borderRadius:2,background:p.color,flexShrink:0}}/>
                        <span style={{flex:1,color:"var(--text-2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {p.name}
                        </span>
                        <span style={{color:"var(--text-3)",flexShrink:0}}>{p.hours}h</span>
                      </div>
                    ))}
                    {(alloc.unscheduled?.length>0 || alloc.missingEstimate?.length>0 || alloc.overScheduled?.length>0) && (
                      <div style={{marginTop:8,paddingTop:8,borderTop:"1px dashed var(--border)",display:"flex",flexDirection:"column",gap:3}}>
                        {alloc.unscheduled?.length>0 && (
                          <div style={{fontSize:11,color:"var(--text-3)"}}>
                            🗂 {alloc.unscheduled.length} {t("unscheduled")} · {alloc.unscheduled.reduce((s:number,x:any)=>s+x.hours,0).toFixed(0)}h
                          </div>
                        )}
                        {alloc.missingEstimate?.length>0 && (
                          <div style={{fontSize:11,color:"#B45309"}}>
                            ⚠ {alloc.missingEstimate.length} {t("tasks without estimates")}
                          </div>
                        )}
                        {alloc.overScheduled?.length>0 && (
                          <div style={{fontSize:11,color:"var(--red,#DC2626)"}}>
                            ⛔ {alloc.overScheduled.length} {t("over-scheduled")}: {alloc.overScheduled.slice(0,2).map((x:any)=>`${x.title.slice(0,24)} (${x.dailyLoad}${t("h/day")})`).join(", ")}
                          </div>
                        )}
                      </div>
                    )}
                    {alloc.total<CAPACITY_HRS&&(
                      <div style={{display:"flex",alignItems:"center",gap:7,fontSize:12,opacity:.5}}>
                        <div style={{width:8,height:8,borderRadius:2,background:"var(--border)",flexShrink:0}}/>
                        <span style={{flex:1,color:"var(--text-3)"}}>Available</span>
                        <span style={{color:"var(--text-3)"}}>{CAPACITY_HRS-alloc.total}h</span>
                      </div>
                    )}
                  </div>
                  {over&&(
                    <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid rgba(220,38,38,.2)",
                      fontSize:11,color:"var(--red)",fontWeight:500}}>
                      {t("Over-allocated by")} {alloc.total-CAPACITY_HRS}{t("h/week")}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* AVAILABILITY */}
        {subTab==="availability"&&(
          <div style={{padding:20}}>
            <div style={{marginBottom:14,fontSize:13,color:"var(--text-3)"}}>
              4-week forward availability · 🟢 Available · 🟡 Partially booked · 🔴 Over-allocated · ⬜ Time off
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
              {members.map(m=>{
                const userId = m.userId||m.user?.id
                const user   = m.user||m
                const alloc  = allocationByUser[userId]||{total:0,projects:[]}
                const weeks4 = weekDates.slice(0,4).map((_,i)=>{
                  const variance=[.9,1.05,1,.95][i]
                  const hrs=Math.round(alloc.total*variance)
                  const pct=Math.round(hrs/CAPACITY_HRS*100)
                  return {hrs,pct,date:weekDates[i]}
                })
                const avgPct = Math.round(weeks4.reduce((s,w)=>s+w.pct,0)/4)
                const statusColor = avgPct>105?"var(--red)":avgPct>85?"var(--amber)":"var(--green)"
                return (
                  <div key={userId} style={{background:"#fff",border:"1px solid var(--border)",
                    borderRadius:"var(--radius)",padding:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <Avatar name={user.name} avatarUrl={user.avatarUrl} size={28}/>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>{user.name}</div>
                        <div style={{fontSize:10,color:statusColor,fontWeight:500}}>
                          {avgPct>105?t("Over-allocated"):avgPct>85?t("Heavily booked"):avgPct>50?t("Partially available"):t("Available")}
                          {" · "}{alloc.total}h/wk
                        </div>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:6}}>
                      <div style={{fontSize:9,color:"var(--text-4)",textAlign:"center"}}>Wk1</div>
                      <div style={{fontSize:9,color:"var(--text-4)",textAlign:"center"}}>Wk2</div>
                      <div style={{fontSize:9,color:"var(--text-4)",textAlign:"center"}}>Wk3</div>
                      <div style={{fontSize:9,color:"var(--text-4)",textAlign:"center"}}>Wk4</div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                      {weeks4.map((w,i)=>{
                        const heat=heatClass(w.pct)
                        return (
                          <div key={i} style={{background:heat.bg,borderRadius:5,padding:"6px 2px",
                            textAlign:"center",fontSize:10,fontWeight:600,color:heat.text}}>
                            {w.pct}%
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
