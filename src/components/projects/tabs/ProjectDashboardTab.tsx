"use client"
// src/components/projects/tabs/ProjectDashboardTab.tsx
import { useTranslations } from "next-intl"
import { useState } from "react"
import Link from "next/link"
import { Avatar } from "@/components/ui"
import { useRouter } from "next/navigation"

const HEALTH_COLOR: Record<string,string> = {
  GREEN:"#059669", YELLOW:"#F59E0B", AMBER:"#F59E0B", RED:"#DC2626", ON_HOLD:"#94A3B8"
}
const HEALTH_LABEL: Record<string,string> = {
  GREEN:"On track", YELLOW:"At risk", AMBER:"At risk", RED:"Off track", ON_HOLD:"On hold"
}
const PRIORITY_COLOR: Record<string,string> = {
  CRITICAL:"#DC2626", HIGH:"#F59E0B", MEDIUM:"#1B6CA8", LOW:"#64748B"
}
const PRIORITY_BG: Record<string,string> = {
  CRITICAL:"#FEF2F2", HIGH:"#FFFBEB", MEDIUM:"#EFF6FF", LOW:"#F8FAFC"
}
const PROJECT_ROLE_COLOR: Record<string,string> = {
  SPONSOR:"#7C3AED", STAKEHOLDER:"#F59E0B", PM:"#1B6CA8",
  PMO:"#0E7490", TEAM_MEMBER:"#059669", EXTERNAL_RESOURCE:"#64748B"
}
const PROJECT_ROLE_LABEL: Record<string,string> = {
  SPONSOR:"Sponsor", STAKEHOLDER:"Stakeholder", PM:"PM",
  PMO:"PMO", TEAM_MEMBER:"Team member", EXTERNAL_RESOURCE:"External"
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}
function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric", timeZone:"UTC" })
}
function startOfWeek(d: Date) {
  const c = new Date(d)
  const day = c.getDay()
  c.setDate(c.getDate() - day + (day === 0 ? -6 : 1))
  return c
}

// ── Agile / Scrum methodology panel ────────────────────────────────────────

function MethodologyPanelAgile({ tasks, phases, milestones }: {
  tasks:any[]; phases:any[]; milestones:any[]
}) {
  const sprints = phases.filter(p =>
    p.name?.toLowerCase().includes("sprint") || p.name?.toLowerCase().includes("iteration")
  )
  const currentSprint = sprints.find(p => p.status === "IN_PROGRESS") || sprints[sprints.length-1]
  const sprintTasks = currentSprint ? tasks.filter(t => t.phaseId === currentSprint.id) : tasks
  const total     = sprintTasks.length
  const done      = sprintTasks.filter(t => t.status==="DONE").length
  const inProg    = sprintTasks.filter(t => t.status==="IN_PROGRESS").length
  const blocked   = sprintTasks.filter(t => t.status==="BLOCKED").length
  const remaining = total - done
  const burndownPct = total > 0 ? Math.round((done/total)*100) : 0

  // Velocity per completed sprint
  const completedSprints = sprints.filter(p => p.status==="COMPLETED")
  const sprintVelocities = completedSprints.map(s =>
    tasks.filter(t => t.phaseId===s.id && t.status==="DONE").length
  )
  const velocity = sprintVelocities.length > 0
    ? Math.round(sprintVelocities.reduce((a,b)=>a+b,0)/sprintVelocities.length)
    : null
  const velocityTrend = sprintVelocities.length >= 2
    ? sprintVelocities[sprintVelocities.length-1] > sprintVelocities[sprintVelocities.length-2]
      ? "↑ improving" : sprintVelocities[sprintVelocities.length-1] < sprintVelocities[sprintVelocities.length-2]
      ? "↓ declining" : "→ stable"
    : null

  const nextReview = milestones.find(m =>
    (m.name?.toLowerCase().includes("review") || m.name?.toLowerCase().includes("sprint")) &&
    m.status !== "ACHIEVED" && m.dueDate && new Date(m.dueDate) > new Date()
  )
  const daysToReview = nextReview
    ? Math.ceil((new Date(nextReview.dueDate).getTime()-Date.now())/86400000)
    : null

  // Velocity chart
  const chartH = 48, chartW = 180
  const maxV = Math.max(...sprintVelocities, 1)
  const points = sprintVelocities.map((v,i) => ({
    x: sprintVelocities.length > 1 ? (i / (sprintVelocities.length-1)) * chartW : chartW/2,
    y: chartH - (v/maxV)*(chartH-6) - 2
  }))
  const pathD = points.map((p,i) => `${i===0?"M":"L"}${p.x},${p.y}`).join(" ")

  return (
    <div style={{ background:"#F5F3FF", border:"1px solid #DDD6FE",
      borderRadius:"var(--radius)", padding:16, borderLeft:"3px solid #7C3AED" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <span style={{ fontSize:12, fontWeight:700, color:"#7C3AED" }}>
          🔁 {currentSprint ? currentSprint.name : "Sprint Overview"}
        </span>
        {currentSprint?.status && (
          <span style={{ fontSize:10, padding:"2px 8px", borderRadius:8,
            background:"#EDE9FE", color:"#7C3AED", fontWeight:600 }}>
            {currentSprint.status.replace("_"," ")}
          </span>
        )}
        <span style={{ fontSize:11, color:"#64748B", marginLeft:"auto" }}>
          Sprint {sprints.indexOf(currentSprint)+1} of {sprints.length}
        </span>
      </div>

      <div style={{ display:"flex", gap:12 }}>
        {/* Left: metrics */}
        <div style={{ flex:1 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
            {[
              { label:"Done",        value:done,      color:"#059669" },
              { label:"In progress", value:inProg,    color:"#1B6CA8" },
              { label:"Remaining",   value:remaining, color:"#7C3AED" },
              { label:"Blocked",     value:blocked,   color:"#DC2626" },
              { label:"Velocity",    value:velocity!==null?`${velocity}`:"-", color:"#F59E0B" },
              { label:"Trend",       value:velocityTrend||"—", color:velocityTrend?.startsWith("↑")?"#059669":velocityTrend?.startsWith("↓")?"#DC2626":"#64748B" },
            ].map(s => (
              <div key={s.label} style={{ background:"#fff", borderRadius:6, padding:"8px 10px" }}>
                <div style={{ fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:9, color:"#64748B", marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: velocity trend chart */}
        {sprintVelocities.length >= 2 && (
          <div style={{ flexShrink:0 }}>
            <div style={{ fontSize:9, color:"#7C3AED", fontWeight:700, marginBottom:4,
              textTransform:"uppercase", letterSpacing:".05em" }}>Velocity trend</div>
            <svg width={chartW} height={chartH} style={{ overflow:"visible" }}>
              <path d={pathD} fill="none" stroke="#7C3AED" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {points.map((p,i)=>(
                <circle key={i} cx={p.x} cy={p.y} r={3} fill="#7C3AED" />
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* Sprint burndown bar */}
      <div style={{ marginTop:8 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11,
          color:"#64748B", marginBottom:4 }}>
          <span>Sprint progress — {burndownPct}%</span>
          {daysToReview !== null && (
            <span style={{ color:daysToReview<=2?"#DC2626":daysToReview<=5?"#F59E0B":"#64748B",
              fontWeight:daysToReview<=2?700:400 }}>
              {daysToReview===0?"Review TODAY":daysToReview===1?"Review tomorrow":`Review in ${daysToReview}d`}
            </span>
          )}
        </div>
        <div style={{ height:8, background:"#DDD6FE", borderRadius:4, overflow:"hidden" }}>
          <div style={{ height:"100%", borderRadius:4, width:`${burndownPct}%`,
            background:"#7C3AED", transition:"width .4s" }} />
        </div>
      </div>

      {blocked > 0 && (
        <div style={{ fontSize:11, color:"#DC2626", fontWeight:600, marginTop:8 }}>
          ⚠ {blocked} blocked task{blocked!==1?"s":""} — resolve before sprint review
        </div>
      )}
    </div>
  )
}

// ── Waterfall methodology panel ─────────────────────────────────────────────

function MethodologyPanelWaterfall({ phases, milestones, tasks }: {
  phases:any[]; milestones:any[]; tasks:any[]
}) {
  const PHASE_STATUS: Record<string,{color:string;bg:string;label:string}> = {
    COMPLETED:   { color:"#059669", bg:"#ECFDF5", label:"Complete"    },
    IN_PROGRESS: { color:"#1B6CA8", bg:"#EFF6FF", label:"In Progress" },
    PENDING:     { color:"#94A3B8", bg:"#F8FAFC", label:"Pending"     },
    ON_HOLD:     { color:"#F59E0B", bg:"#FFFBEB", label:"On Hold"     },
  }

  // Derive each phase's progress from its tasks (matches Gantt & Tasks tab)
  const phaseInfo = new Map<string, { pct: number; status: string }>()
  for (const p of phases) {
    const pts = tasks.filter((t: any) => t.phaseId === p.id)
    const pct = pts.length
      ? Math.round(pts.reduce((sm: number, t: any) => sm + (t.percentComplete || 0), 0) / pts.length)
      : 0
    const status = p.status === "ON_HOLD" ? "ON_HOLD"
      : pts.length && pct === 100 ? "COMPLETED"
      : pct > 0 ? "IN_PROGRESS"
      : "PENDING"
    phaseInfo.set(p.id, { pct, status })
  }
  const currentPhase = phases.find(p => phaseInfo.get(p.id)?.status === "IN_PROGRESS")
  const completedPhases = phases.filter(p => phaseInfo.get(p.id)?.status === "COMPLETED").length
  const withTasks = phases.filter(p => tasks.some((t: any) => t.phaseId === p.id))
  const phasePct = withTasks.length
    ? Math.round(withTasks.reduce((sm, p) => sm + (phaseInfo.get(p.id)?.pct || 0), 0) / withTasks.length)
    : 0

  // Next phase gate milestone
  const nextGate = milestones.find(m =>
    (m.name?.toLowerCase().includes("gate") || m.name?.toLowerCase().includes("phase")) &&
    m.status !== "ACHIEVED" && m.dueDate && new Date(m.dueDate) > new Date()
  )
  const daysToGate = nextGate
    ? Math.ceil((new Date(nextGate.dueDate).getTime()-Date.now())/86400000)
    : null

  return (
    <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE",
      borderRadius:"var(--radius)", padding:16, borderLeft:"3px solid #1B6CA8" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <span style={{ fontSize:12, fontWeight:700, color:"#1B6CA8" }}>
          📋 Phase Progress — Waterfall
        </span>
        {nextGate && (
          <span style={{ marginLeft:"auto", fontSize:11,
            color:daysToGate!==null&&daysToGate<=7?"#DC2626":"#64748B",
            fontWeight:daysToGate!==null&&daysToGate<=7?700:400 }}>
            {daysToGate!==null
              ? daysToGate===0?"Phase gate TODAY":daysToGate===1?"Phase gate tomorrow":`Phase gate in ${daysToGate}d`
              : ""}
          </span>
        )}
      </div>

      {/* Phase timeline */}
      <div style={{ display:"flex", gap:4, marginBottom:12, flexWrap:"wrap" }}>
        {phases.map((p, i) => {
          const info = phaseInfo.get(p.id) || { pct: 0, status: "PENDING" }
          const sc = PHASE_STATUS[info.status] || PHASE_STATUS.PENDING
          const isCurrent = p.id === currentPhase?.id
          return (
            <div key={p.id} style={{ flex:1, minWidth:80, position:"relative" }}>
              {i > 0 && (
                <div style={{ position:"absolute", left:-4, top:"50%", transform:"translateY(-50%)",
                  width:8, height:2, background:"#CBD5E1", zIndex:1 }} />
              )}
              <div style={{ background:isCurrent?"#1B6CA8":sc.bg,
                border:`1px solid ${isCurrent?"#1B6CA8":sc.color}20`,
                borderRadius:6, padding:"8px 10px", textAlign:"center",
                borderTop:`3px solid ${sc.color}` }}>
                <div style={{ fontSize:10, fontWeight:700,
                  color:isCurrent?"#fff":sc.color, marginBottom:2 }}>
                  {info.status==="COMPLETED"?"✓ ":""}
                  {isCurrent?"▶ ":""}{p.name?.slice(0,18)}{p.name?.length>18?"…":""}
                </div>
                <div style={{ fontSize:9, color:isCurrent?"rgba(255,255,255,.7)":sc.color,
                  fontWeight:600 }}>{sc.label}{info.pct > 0 && info.pct < 100 ? ` · ${info.pct}%` : ""}</div>
                {/* Phase gate indicator */}
                {p.gateApproved && (
                  <div style={{ fontSize:8, color:"#059669", fontWeight:700, marginTop:2 }}>
                    🚪 Gate ✓
                  </div>
                )}
                {p.status==="COMPLETED" && !p.gateApproved && (
                  <div style={{ fontSize:8, color:"#D97706", fontWeight:700, marginTop:2 }}>
                    🚪 Gate pending
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Phase completion bar */}
      <div style={{ marginBottom:currentPhase?10:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11,
          color:"#64748B", marginBottom:4 }}>
          <span>{completedPhases} of {phases.length} phases complete</span>
          <span style={{ fontWeight:600, color:"#1B6CA8" }}>{phasePct}%</span>
        </div>
        <div style={{ height:8, background:"#BFDBFE", borderRadius:4, overflow:"hidden" }}>
          <div style={{ height:"100%", borderRadius:4, width:`${phasePct}%`,
            background:"#1B6CA8", transition:"width .4s" }} />
        </div>
      </div>

      {currentPhase && (
        <div style={{ fontSize:11, color:"#1E40AF", fontWeight:500 }}>
          Current phase: <strong>{currentPhase.name}</strong>
          {(() => {
            const phaseTasks = tasks.filter(t => t.phaseId===currentPhase.id)
            const done = phaseTasks.filter(t => t.status==="DONE").length
            return phaseTasks.length > 0
              ? ` — ${done}/${phaseTasks.length} tasks complete`
              : ""
          })()}
        </div>
      )}
    </div>
  )
}

export function ProjectDashboardTab({
  project, projectId, tasks, risks, milestones, budgetItems, members, statusUpdates, phases,
  portfolios, programs, linkedGoals=[]
}: {
  project:any; projectId:string; tasks:any[]; risks:any[];
  milestones:any[]; budgetItems:any[]; members:any[]; statusUpdates:any[]; phases?:any[];
  portfolios?:any[]; programs?:any[]; linkedGoals?:any[]
}) {
  const td = useTranslations("projectDash")
  const router = useRouter()
  const [weekOffset, setWeekOffset] = useState(0)
  const [saving, setSaving] = useState(false)
  const [editField, setEditField] = useState<string|null>(null)
  const [editValue, setEditValue] = useState("")
  const [statusSection, setStatusSection] = useState<"summary"|"accomplishments"|"next"|"risks">("summary")

  // Weekly status
  const baseWeek = startOfWeek(new Date())
  const weekStart = new Date(baseWeek)
  weekStart.setDate(weekStart.getDate() + weekOffset * 7)
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6)
  const weekLabel = `${weekStart.toLocaleDateString("en-US", {month:"short",day:"numeric", timeZone:"UTC" })} – ${weekEnd.toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric", timeZone:"UTC" })}`

  const weekStatus = statusUpdates.find(s => {
    const ps = new Date(s.periodStart), pe = new Date(s.periodEnd)
    return ps <= weekEnd && pe >= weekStart
  })

  // Team roles — using expanded PM Standard taxonomy
  const pm           = members.find(m => m.projectRole === "PM")
  const sponsors     = members.filter(m => ["SPONSOR","EXECUTIVE_SPONSOR"].includes(m.projectRole))
  const stakeholders = members.filter(m => m.projectRole === "STAKEHOLDER")
  const pmoMembers   = members.filter(m => ["PMO","PMO_DIRECTOR"].includes(m.projectRole))

  // Budget
  const totalPlanned = budgetItems.reduce((s,b) => s + Number(b.plannedCost||0), 0)
  const totalActual  = budgetItems.reduce((s,b) => s + Number(b.actualCost||0), 0)
  const budgetPct    = totalPlanned > 0 ? Math.round((totalActual/totalPlanned)*100) : 0

  // Task stats
  const doneTasks     = tasks.filter(t => t.status === "DONE")
  const overdueTasks  = tasks.filter(t =>
    t.dueDate && new Date(t.dueDate) < new Date() && !["DONE","CANCELLED"].includes(t.status)
  )
  const highRisks = risks.filter(r => r.score >= 9)

  // Overall risk
  const overallRisk = highRisks.length === 0 ? "LOW"
    : risks.some(r => r.score >= 15) ? "HIGH"
    : "MEDIUM"
  const riskColor = { HIGH:"#DC2626", MEDIUM:"#F59E0B", LOW:"#059669" }[overallRisk]!
  const riskBg    = { HIGH:"#FEF2F2", MEDIUM:"#FFFBEB", LOW:"#ECFDF5" }[overallRisk]!

  async function saveField(field: string, value: string) {
    setSaving(true)
    try {
      await fetch(`/api/projects/${projectId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ [field]: value || null }),
      })
      router.refresh()
    } finally { setSaving(false); setEditField(null) }
  }

  const card: React.CSSProperties = {
    background:"#fff", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", overflow:"hidden",
  }
  const sTitle: React.CSSProperties = {
    padding:"11px 14px", borderBottom:"1px solid var(--border)",
    fontSize:11, fontWeight:700, color:"var(--text-3)",
    textTransform:"uppercase", letterSpacing:".05em",
    display:"flex", alignItems:"center", justifyContent:"space-between",
    gap:6,
  }
  const editBtn: React.CSSProperties = {
    fontSize:11, color:"var(--steel)", background:"none", border:"none",
    cursor:"pointer", fontFamily:"var(--font)", fontWeight:400, padding:"2px 4px",
  }
  const ta: React.CSSProperties = {
    width:"100%", padding:"9px 11px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    lineHeight:1.7, resize:"vertical" as const, outline:"none", color:"var(--text)",
  }

  function EditablePanel({ field, label, icon, value, hint }: {
    field:string; label:string; icon:string; value?:string|null; hint:string
  }) {
    const isEditing = editField === field
    return (
      <div style={card}>
        <div style={sTitle}>
          <span>{icon} {label}</span>
          {!isEditing && (
            <button style={editBtn}
              onClick={() => { setEditField(field); setEditValue(value||"") }}>
              {value ? "Edit" : "+ Add"}
            </button>
          )}
        </div>
        <div style={{ padding:14 }}>
          {isEditing ? (
            <div>
              <textarea autoFocus rows={3} value={editValue} style={ta}
                onChange={e => setEditValue(e.target.value)} placeholder={hint} />
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <button disabled={saving} onClick={() => saveField(field, editValue)}
                  style={{ padding:"6px 14px", background:"var(--steel)", color:"#fff",
                    border:"none", borderRadius:"var(--radius)", fontSize:12,
                    cursor:"pointer", fontFamily:"var(--font)" }}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setEditField(null)}
                  style={{ padding:"6px 12px", background:"#fff", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                    fontFamily:"var(--font)", color:"var(--text-2)" }}>Cancel</button>
              </div>
            </div>
          ) : value ? (
            <p style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.75, margin:0,
              whiteSpace:"pre-line" }}>{value}</p>
          ) : (
            <p style={{ fontSize:13, color:"var(--text-4)", fontStyle:"italic", margin:0 }}>
              {hint}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding:16, display:"flex", flexDirection:"column", gap:14 }}>

      {/* ── Header strip: priority + confidential + health ── */}
      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        {project?.isConfidential && (
          <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20,
            background:"#1E1B4B", color:"#fff", letterSpacing:".04em" }}>
            🔒 CONFIDENTIAL
          </span>
        )}
        {project?.priority && (
          <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20,
            background: PRIORITY_BG[project.priority], color: PRIORITY_COLOR[project.priority],
            letterSpacing:".04em" }}>
            {project.priority} PRIORITY
          </span>
        )}
        {project?.health && (
          <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20,
            background:`${HEALTH_COLOR[project.health]}18`, color:HEALTH_COLOR[project.health],
            letterSpacing:".04em" }}>
            {HEALTH_LABEL[project.health]?.toUpperCase()}
          </span>
        )}
        {project?.methodology && (
          <span style={{ fontSize:11, color:"var(--text-3)", fontWeight:500 }}>
            {project.methodology}
          </span>
        )}
        <span style={{ fontSize:11, color:"var(--text-3)", marginLeft:"auto" }}>
          {fmtDate(project?.startDate)} → {fmtDate(project?.endDate)}
        </span>
      </div>

      {/* ── Row 1: Description + Economic Impact ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {EditablePanel({ field: 'description', label: 'Description', icon: '📋', value: project?.description, hint: 'Describe this project at a high level.' })}
        {EditablePanel({ field: 'economicImpact', label: 'Economic Impact / ROI', icon: '💹', value: project?.economicImpact, hint: 'Describe the expected financial benefit or ROI of this project.' })}
      </div>

      {/* ── Row 2: Objective + Scope (In) ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {EditablePanel({ field: 'objective', label: 'Project Objective', icon: '🎯', value: project?.objective, hint: 'What must this project achieve? State the measurable outcomes.' })}
        {EditablePanel({ field: 'scope', label: 'In Scope', icon: '✅', value: project?.scope, hint: 'What deliverables and work are included in this project?' })}
      </div>

      {/* ── Row 3: Out of Scope + Background/Assumptions ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {EditablePanel({ field: 'outOfScope', label: 'Out of Scope', icon: '🚫', value: project?.outOfScope, hint: 'What is explicitly excluded from this project?' })}
        {project?.background ? (
          EditablePanel({ field: 'background', label: 'Background', icon: '📖', value: project?.background, hint: 'What is the background and context for this project?' })
        ) : project?.assumptions ? (
          EditablePanel({ field: 'assumptions', label: 'Assumptions', icon: '💡', value: project?.assumptions, hint: 'What assumptions has the team made about this project?' })
        ) : (
          EditablePanel({ field: 'background', label: 'Background', icon: '📖', value: project?.background, hint: 'What is the background and context for this project?' })
        )}
      </div>

      {/* ── Stakeholders strip ── */}
      <div style={card}>
        <div style={sTitle}>👥 Project Leadership & Stakeholders</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)" }}>
          {[
            { role:td("Project Manager"), people:pm?[pm]:[], color:"#1B6CA8" },
            { role:"Sponsor",         people:sponsors,    color:"#7C3AED" },
            { role:"Stakeholders",    people:stakeholders,color:"#F59E0B" },
            { role:"PMO",             people:pmoMembers,  color:"#0E7490" },
          ].map((g,i) => (
            <div key={g.role} style={{ padding:"12px 14px",
              borderRight:i<3?"1px solid var(--border)":"none" }}>
              <div style={{ fontSize:10, fontWeight:700, color:g.color,
                textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>
                {g.role}
              </div>
              {g.people.length === 0 ? (
                <span style={{ fontSize:12, color:"var(--text-4)", fontStyle:"italic" }}>Unassigned</span>
              ) : g.people.map(m => (
                <div key={m.id} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
                  <Avatar name={m.user?.name} avatarUrl={m.user?.avatarUrl} size={26} />
                  <div>
                    <div style={{ fontSize:12, fontWeight:500, color:"var(--text)" }}>{m.user?.name}</div>
                    <div style={{ fontSize:10, color:"var(--text-3)" }}>{m.allocation}% allocated</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Portfolio / Program assignment ── */}
      {(portfolios && portfolios.length > 0) && (
        <div style={{ ...card, padding:"14px 18px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, fontWeight:700, color:"var(--text-3)",
              textTransform:"uppercase", letterSpacing:".05em" }}>📊 Portfolio</span>
            <select
              defaultValue={project?.program?.portfolio?.id || ""}
              onChange={async e => {
                const portfolioId = e.target.value || null
                await fetch(`/api/projects/${projectId}`, {
                  method:"PATCH", headers:{"Content-Type":"application/json"},
                  body: JSON.stringify({ portfolioId, programId: null }),
                })
                router.refresh()
              }}
              style={{ padding:"5px 10px", fontSize:12, border:"1px solid var(--border)",
                borderRadius:"var(--radius)", cursor:"pointer", fontFamily:"var(--font)",
                color:"var(--text)", outline:"none", background:"#fff" }}>
              <option value="">No portfolio assigned</option>
              {(portfolios||[]).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {programs && programs.length > 0 && (
              <>
                <span style={{ fontSize:11, fontWeight:700, color:"var(--text-3)",
                  textTransform:"uppercase", letterSpacing:".05em" }}>🗂 Program</span>
                <select
                  defaultValue={project?.programId || ""}
                  onChange={async e => {
                    const programId = e.target.value || null
                    await fetch(`/api/projects/${projectId}`, {
                      method:"PATCH", headers:{"Content-Type":"application/json"},
                      body: JSON.stringify({ programId }),
                    })
                    router.refresh()
                  }}
                  style={{ padding:"5px 10px", fontSize:12, border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", cursor:"pointer", fontFamily:"var(--font)",
                    color:"var(--text)", outline:"none", background:"#fff" }}>
                  <option value="">No program assigned</option>
                  {(programs||[]).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </>
            )}
            {project?.program?.portfolio && (
              <span style={{ fontSize:11, color:"var(--text-3)", marginLeft:4 }}>
                Currently: <strong>{project.program.portfolio.name}</strong>
                {project.program && ` → ${project.program.name}`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Strategic goals this project supports ── */}
      {linkedGoals && linkedGoals.length > 0 && (
        <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"12px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:10 }}>
            🎯 Strategic goals
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {linkedGoals.map((g:any)=>{
              const sc = g.status==="ACHIEVED"?"var(--green)":(g.status==="OFF_TRACK"||g.status==="MISSED")?"var(--red)":g.status==="AT_RISK"?"var(--amber)":"var(--steel)"
              const pc = g.progress>=80?"var(--green)":g.progress>=50?"var(--steel)":g.progress>=25?"var(--amber)":"var(--red)"
              return (
                <div key={g.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ flex:1, fontSize:13, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.title}</span>
                  <span style={{ fontSize:9, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase" }}>{g.type}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:sc, textTransform:"capitalize" }}>{String(g.status||"").replace(/_/g," ").toLowerCase()}</span>
                  <div style={{ width:90, height:6, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${g.progress||0}%`, background:pc, borderRadius:3 }}/>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:pc, width:34, textAlign:"right" }}>{g.progress||0}%</span>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize:10, color:"var(--text-4)", marginTop:8 }}>
            This project contributes to the goals above. Links are managed in Goals.
          </div>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10 }}>
        {[
          { icon:"✅", label:td("Tasks complete"),
            value:`${doneTasks.length}/${tasks.length}`,
            color:"var(--text)" },
          { icon:"⏰", label:td("Overdue tasks"),
            value:overdueTasks.length,
            color:overdueTasks.length>0?"var(--red)":"var(--text)" },
          { icon:"⚠",  label:td("Overall risk"),
            value:overallRisk,
            color:riskColor, bg:riskBg },
          { icon:"💰", label:td("Budget used"),
            value:`${budgetPct}%`,
            color:budgetPct>90?"var(--red)":budgetPct>75?"var(--amber)":"var(--text)" },
          { icon:"📊", label:td("Progress"),
            value:`${project?.percentComplete||0}%`,
            color:"var(--steel)" },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: (kpi as any).bg || "#fff",
            border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"12px 14px" }}>
            <div style={{ fontSize:18, marginBottom:6 }}>{kpi.icon}</div>
            <div style={{ fontSize:22, fontWeight:700, color:kpi.color, lineHeight:1 }}>{kpi.value}</div>
            <div style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* ── Methodology-Aware Panel ── */}
      {project?.methodology === "SCRUM" || project?.methodology === "AGILE" ? (
        <MethodologyPanelAgile tasks={tasks} phases={phases||[]} milestones={milestones} />
      ) : project?.methodology === "WATERFALL" ? (
        <MethodologyPanelWaterfall phases={phases||[]} milestones={milestones} tasks={tasks} />
      ) : null}

      {/* ── Weekly Status — redesigned ── */}
      <div style={card}>
        <div style={sTitle}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span>📅 Weekly Status</span>
            {weekStatus && (
              <span style={{ padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:700,
                background:`${HEALTH_COLOR[weekStatus.health]}18`,
                color:HEALTH_COLOR[weekStatus.health] }}>
                {HEALTH_LABEL[weekStatus.health]}
              </span>
            )}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={() => setWeekOffset(w=>w-1)}
              style={{ padding:"2px 7px", background:"#fff", border:"1px solid var(--border)",
                borderRadius:4, cursor:"pointer", fontSize:12, fontFamily:"var(--font)" }}>‹</button>
            <span style={{ fontSize:11, fontWeight:500, color:"var(--text-2)",
              minWidth:150, textAlign:"center" }}>{weekLabel}</span>
            <button onClick={() => setWeekOffset(w=>w+1)}
              style={{ padding:"2px 7px", background:"#fff", border:"1px solid var(--border)",
                borderRadius:4, cursor:"pointer", fontSize:12, fontFamily:"var(--font)" }}>›</button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)}
                style={{ fontSize:11, color:"var(--steel)", background:"none", border:"none",
                  cursor:"pointer", fontFamily:"var(--font)" }}>Today</button>
            )}
          </div>
        </div>

        {weekStatus ? (
          <div>
            {/* Section tabs */}
            <div style={{ display:"flex", borderBottom:"1px solid var(--border)",
              padding:"0 14px", gap:0 }}>
              {[
                { id:"summary",         label:"Summary"         },
                { id:"accomplishments", label:td("Accomplished")    },
                { id:"next",            label:td("Next period")     },
                { id:"risks",           label:td("Risks & Issues")  },
              ].map(s => (
                <button key={s.id}
                  onClick={() => setStatusSection(s.id as any)}
                  style={{ padding:"8px 12px", border:"none", background:"none",
                    borderBottom:`2px solid ${statusSection===s.id?"var(--steel)":"transparent"}`,
                    fontSize:11, fontWeight:statusSection===s.id?600:400,
                    color:statusSection===s.id?"var(--steel)":"var(--text-3)",
                    cursor:"pointer", fontFamily:"var(--font)", transition:"all .15s" }}>
                  {s.label}
                </button>
              ))}
              <div style={{ marginLeft:"auto", display:"flex", alignItems:"center" }}>
                <span style={{ fontSize:11, color:"var(--text-3)", padding:"8px 12px" }}>
                  {weekStatus.percentComplete}% complete
                </span>
              </div>
            </div>

            <div style={{ padding:14, minHeight:80 }}>
              {statusSection === "summary" && (
                <p style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.75, margin:0 }}>
                  {weekStatus.summary || <span style={{ color:"var(--text-4)", fontStyle:"italic" }}>No summary recorded.</span>}
                </p>
              )}
              {statusSection === "accomplishments" && (
                <p style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.75, margin:0, whiteSpace:"pre-line" }}>
                  {weekStatus.accomplishments || <span style={{ color:"var(--text-4)", fontStyle:"italic" }}>No accomplishments recorded.</span>}
                </p>
              )}
              {statusSection === "next" && (
                <p style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.75, margin:0, whiteSpace:"pre-line" }}>
                  {weekStatus.nextSteps || <span style={{ color:"var(--text-4)", fontStyle:"italic" }}>No next steps recorded.</span>}
                </p>
              )}
              {statusSection === "risks" && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"var(--amber)",
                      textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>⚠ Risks</div>
                    <p style={{ fontSize:12, color:"var(--text-2)", lineHeight:1.7, margin:0, whiteSpace:"pre-line" }}>
                      {weekStatus.risks || <span style={{ color:"var(--text-4)", fontStyle:"italic" }}>None recorded.</span>}
                    </p>
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"var(--red)",
                      textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>🚩 Issues</div>
                    <p style={{ fontSize:12, color:"var(--text-2)", lineHeight:1.7, margin:0, whiteSpace:"pre-line" }}>
                      {weekStatus.issues || <span style={{ color:"var(--text-4)", fontStyle:"italic" }}>None recorded.</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding:"20px 14px", textAlign:"center" }}>
            <div style={{ fontSize:12, color:"var(--text-3)", marginBottom:10 }}>
              No status update for this week
            </div>
            <Link href={`/projects/${projectId}/reports`}
              style={{ fontSize:12, color:"var(--steel)", textDecoration:"none", fontWeight:500 }}>
              + Create weekly status report →
            </Link>
          </div>
        )}
      </div>

      {/* ── Tasks + Milestones + Risks ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {/* Recent tasks */}
        <div style={card}>
          <div style={sTitle}>
            Recent tasks
            <Link href={`/projects/${projectId}/tasks`}
              style={{ fontSize:11, color:"var(--steel)", textDecoration:"none", fontWeight:400 }}>
              All tasks →
            </Link>
          </div>
          {tasks.length === 0 ? (
            <div style={{ padding:"16px 14px", fontSize:12, color:"var(--text-3)", textAlign:"center" }}>
              No tasks yet
            </div>
          ) : tasks.slice(0,6).map(t => (
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
                <Avatar
                  name={(t.assignees[0].projectMember?.user||t.assignees[0].user)?.name}
                  avatarUrl={(t.assignees[0].projectMember?.user||t.assignees[0].user)?.avatarUrl}
                  size={20} />
              )}
            </div>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Milestones */}
          <div style={card}>
            <div style={sTitle}>Milestones</div>
            {milestones.length === 0 ? (
              <div style={{ padding:"16px 14px", fontSize:12, color:"var(--text-3)", textAlign:"center" }}>
                No upcoming milestones
              </div>
            ) : milestones.slice(0,4).map(m => {
              const days = Math.ceil((new Date(m.dueDate).getTime()-Date.now())/86400000)
              return (
                <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"9px 14px", borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}>
                  <span style={{ color: m.acceptedAt ? "var(--green)" : "var(--amber)", fontSize:12 }}>
                    {m.acceptedAt ? "✓" : "◇"}
                  </span>
                  <span style={{ flex:1, fontSize:12, color:"var(--text)", fontWeight:500,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {m.name}
                  </span>
                  {m.acceptedAt ? (
                    <span style={{ fontSize:10, color:"var(--green)", fontWeight:600 }}>
                      Accepted
                    </span>
                  ) : (
                    <span style={{ fontSize:11, fontWeight:600, flexShrink:0,
                      color:days<0?"var(--red)":days<=7?"var(--amber)":"var(--text-3)" }}>
                      {days<0?td("Overdue"):days===0?"Today":days===1?"Tomorrow":`${days}d`}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Top risks */}
          <div style={card}>
            <div style={sTitle}>
              Top risks
              <Link href={`/projects/${projectId}/risks`}
                style={{ fontSize:11, color:"var(--steel)", textDecoration:"none", fontWeight:400 }}>
                All →
              </Link>
            </div>
            {risks.length === 0 ? (
              <div style={{ padding:"16px 14px", fontSize:12, color:"var(--text-3)", textAlign:"center" }}>
                No open risks
              </div>
            ) : risks.slice(0,3).map(r => (
              <div key={r.id} style={{ display:"flex", alignItems:"center", gap:10,
                padding:"9px 14px", borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}>
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
