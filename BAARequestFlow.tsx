"use client"
// src/components/projects/tabs/ProjectDashboardTab.tsx
import Link from "next/link"
import { Badge, Avatar, ProgressBar } from "@/components/ui"

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function ProjectDashboardTab({ projectId, tasks, risks, milestones, budgetItems }: {
  projectId:string; tasks:any[]; risks:any[]; milestones:any[]; budgetItems:any[]
}) {
  const totalPlanned = budgetItems.reduce((s,b) => s+Number(b.plannedAmount||0), 0)
  const totalActual  = budgetItems.reduce((s,b) => s+Number(b.actualAmount||0), 0)
  const overdueTasks = tasks.filter(t =>
    t.dueDate && new Date(t.dueDate) < new Date() && !["DONE","CANCELLED"].includes(t.status)
  )
  const doneTasks = tasks.filter(t => t.status === "DONE")

  const card: React.CSSProperties = {
    background:"#fff", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", overflow:"hidden"
  }

  return (
    <div style={{ padding:16 }}>
      {/* Quick stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
        {[
          { icon:"✅", label:"Tasks complete", value:`${doneTasks.length}/${tasks.length}`,
            color:"var(--text)" },
          { icon:"⏰", label:"Overdue tasks", value:overdueTasks.length,
            color:overdueTasks.length>0?"var(--red)":"var(--text)" },
          { icon:"⚠", label:"Open high risks", value:risks.filter(r=>r.score>=9).length,
            color:risks.filter(r=>r.score>=9).length>0?"var(--amber)":"var(--text)" },
          { icon:"🎯", label:"Upcoming milestones", value:milestones.length,
            color:"var(--text)" },
        ].map(kpi => (
          <div key={kpi.label} style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:"12px 14px" }}>
            <div style={{ fontSize:18, marginBottom:6 }}>{kpi.icon}</div>
            <div style={{ fontSize:22, fontWeight:700, color:kpi.color, lineHeight:1 }}>{kpi.value}</div>
            <div style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {/* Recent tasks */}
        <div style={card}>
          <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)",
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>Recent tasks</span>
            <Link href={`/projects/${projectId}/tasks`}
              style={{ fontSize:12, color:"var(--steel)", textDecoration:"none" }}>All tasks →</Link>
          </div>
          {tasks.slice(0,6).map(t => (
            <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px",
              borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}>
              <input type="checkbox" checked={t.status==="DONE"} readOnly
                style={{ width:14, height:14, accentColor:"var(--green)", flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:500, color:"var(--text)",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  textDecoration:t.status==="DONE"?"line-through":"none",
                  opacity:t.status==="DONE"?0.5:1 }}>
                  {t.title}
                </div>
              </div>
              {t.assignees?.[0] && (
                <Avatar name={t.assignees[0].user.name}
                  avatarUrl={t.assignees[0].user.avatarUrl} size={20} />
              )}
              <Badge variant={
                t.priority==="CRITICAL"?"red":t.priority==="HIGH"?"amber":"gray"
              }>{t.priority}</Badge>
            </div>
          ))}
          {tasks.length === 0 && (
            <div style={{ padding:"20px 14px", textAlign:"center", fontSize:12, color:"var(--text-3)" }}>
              No tasks yet
            </div>
          )}
        </div>

        {/* Milestones & risks */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={card}>
            <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)",
              fontSize:13, fontWeight:600, color:"var(--text)" }}>Milestones</div>
            {milestones.length === 0 ? (
              <div style={{ padding:"16px 14px", fontSize:12, color:"var(--text-3)", textAlign:"center" }}>
                No upcoming milestones
              </div>
            ) : milestones.slice(0,4).map(m => {
              const days = Math.ceil((new Date(m.dueDate).getTime() - Date.now()) / 86400000)
              return (
                <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px",
                  borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}>
                  <span style={{ color:"var(--amber)", fontSize:12 }}>◇</span>
                  <span style={{ flex:1, fontSize:12, color:"var(--text)", fontWeight:500,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {m.name}
                  </span>
                  <span style={{ fontSize:11, fontWeight:600, flexShrink:0,
                    color:days<0?"var(--red)":days<=7?"var(--amber)":"var(--text-3)" }}>
                    {days<0?"Overdue":days===0?"Today":days===1?"Tomorrow":`${days}d`}
                  </span>
                </div>
              )
            })}
          </div>

          <div style={card}>
            <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)",
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>Top risks</span>
              <Link href={`/projects/${projectId}/risks`}
                style={{ fontSize:12, color:"var(--steel)", textDecoration:"none" }}>All →</Link>
            </div>
            {risks.length === 0 ? (
              <div style={{ padding:"16px 14px", fontSize:12, color:"var(--text-3)", textAlign:"center" }}>
                No open risks
              </div>
            ) : risks.slice(0,3).map(r => (
              <div key={r.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px",
                borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}>
                <div style={{ width:26, height:26, borderRadius:6, flexShrink:0,
                  background:r.score>=15?"#FEF2F2":r.score>=9?"#FFFBEB":"#EFF6FF",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:11, fontWeight:700,
                  color:r.score>=15?"var(--red)":r.score>=9?"var(--amber)":"var(--steel)" }}>
                  {r.score}
                </div>
                <span style={{ flex:1, fontSize:12, color:"var(--text)",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {r.title}
                </span>
                <Badge variant={r.score>=15?"red":r.score>=9?"amber":"blue"}>
                  {r.score>=15?"Critical":r.score>=9?"High":"Medium"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
