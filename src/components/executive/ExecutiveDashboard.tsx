"use client"
// src/components/executive/ExecutiveDashboard.tsx
// Executive Dashboard — C-Suite view per PM Standard — Governance
// Provides Resources & Direction layer: portfolio health, financial, risk,
// milestone pipeline, benefits realization, pending decisions

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Avatar } from "@/components/ui"

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: any) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric", timeZone:"UTC" })
}
function fmtCurrency(n: number) {
  if (n>=1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if (n>=1_000)     return `$${(n/1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString("en-US")}`
}
function daysUntil(d: any) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime()-Date.now())/86400000)
}

const HEALTH_CFG: Record<string,{color:string;bg:string;label:string;dot:string}> = {
  GREEN: { color:"#059669", bg:"#ECFDF5", label:"On track",  dot:"🟢" },
  AMBER: { color:"#D97706", bg:"#FFFBEB", label:"At risk",   dot:"🟡" },
  RED:   { color:"#DC2626", bg:"#FEF2F2", label:"Off track", dot:"🔴" },
  ON_HOLD:{ color:"#64748B",bg:"#F8FAFC", label:"On hold",   dot:"⚫" },
}
const PRIORITY_CFG: Record<string,{color:string}> = {
  CRITICAL:{ color:"#DC2626" }, HIGH:{ color:"#F59E0B" },
  MEDIUM:  { color:"#1B6CA8" }, LOW:{ color:"#64748B" },
}
const STATUS_CFG: Record<string,{color:string;bg:string}> = {
  SUBMITTED:    { color:"#1B6CA8", bg:"#EFF6FF" },
  UNDER_REVIEW: { color:"#F59E0B", bg:"#FFFBEB" },
  APPROVED:     { color:"#059669", bg:"#ECFDF5" },
}
const BENEFIT_CFG: Record<string,{color:string;label:string}> = {
  PROJECTED: { color:"#1B6CA8", label:"Projected"  },
  TRACKING:  { color:"#F59E0B", label:"Tracking"   },
  REALIZED:  { color:"#059669", label:"Realized"   },
  MISSED:    { color:"#DC2626", label:"Missed"     },
}

// ── KPI Card ──────────────────────────────────────────────────────────────

function KPI({ icon, label, value, sub, color, bg }: {
  icon:string; label:string; value:string|number;
  sub?:string; color?:string; bg?:string
}) {
  return (
    <div style={{ background:bg||"#fff", border:"1px solid var(--border)",
      borderRadius:"var(--radius)", padding:"14px 16px" }}>
      <div style={{ fontSize:20, marginBottom:6 }}>{icon}</div>
      <div style={{ fontSize:24, fontWeight:800, color:color||"var(--text)", lineHeight:1 }}>
        {value}
      </div>
      <div style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:color||"var(--text-4)", marginTop:2 }}>{sub}</div>}
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────────────

function Section({ title, icon, children, action }: {
  title:string; icon:string; children:React.ReactNode; action?:React.ReactNode
}) {
  return (
    <div style={{ background:"#fff", border:"1px solid var(--border)",
      borderRadius:"var(--radius)", overflow:"hidden" }}>
      <div style={{ padding:"11px 16px", borderBottom:"1px solid var(--border)",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        background:"var(--surface)" }}>
        <div style={{ fontSize:12, fontWeight:700, color:"var(--text)",
          display:"flex", alignItems:"center", gap:6 }}>
          <span>{icon}</span> {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export function ExecutiveDashboard({ projects, risks, milestones,
  changeRequests, benefits, decisions, budgetItems, workspaceId }: {
  projects:any[]; risks:any[];
  milestones:{ d30:any[]; d60:any[]; d90:any[] };
  changeRequests:any[]; benefits:any[];
  decisions:any[]; budgetItems:any[]; workspaceId:string
}) {
  const [milestoneWindow, setMilestoneWindow] = useState<30|60|90>(30)

  // ── Portfolio KPIs ─────────────────────────────────────────────────────
  const activeProjects = projects.filter(p => p.status === "ACTIVE")
  const healthCounts = {
    GREEN: projects.filter(p => p.health==="GREEN").length,
    AMBER: projects.filter(p => p.health==="AMBER").length,
    RED:   projects.filter(p => p.health==="RED").length,
  }

  // ── Financial aggregation ──────────────────────────────────────────────
  const totalBAC     = projects.reduce((s,p) => s+p.budgetTotal, 0)
  const totalSpent   = projects.reduce((s,p) => s+p.budgetSpent, 0)
  const totalEV      = budgetItems.reduce((s,b) => s+b.earnedValue, 0)
  const totalAC      = budgetItems.reduce((s,b) => s+b.actualCost,  0)
  const totalPlanned = budgetItems.reduce((s,b) => s+b.plannedCost,  0)
  const portfolioCPI = totalAC > 0 ? totalEV/totalAC : 1
  const portfolioSPI = totalPlanned > 0 ? totalEV/totalPlanned : 1
  const budgetPct    = totalBAC > 0 ? Math.round((totalSpent/totalBAC)*100) : 0
  const projectedOverrun = projects
    .filter(p => p.budgetSpent > p.budgetTotal*0.9)
    .length

  // ── Risk exposure ──────────────────────────────────────────────────────
  const criticalRisks = risks.filter(r => r.score>=15).length
  const highRisks     = risks.filter(r => r.score>=9 && r.score<15).length

  // ── Benefits ──────────────────────────────────────────────────────────
  const realizedBenefits  = benefits.filter(b => b.status==="REALIZED").length
  const projectedBenefits = benefits.filter(b => b.status==="PROJECTED").length
  const missedBenefits    = benefits.filter(b => b.status==="MISSED").length

  // ── CRs pending ───────────────────────────────────────────────────────
  const pendingCRs   = changeRequests.filter(cr => ["SUBMITTED","UNDER_REVIEW"].includes(cr.status))
  const approvedCRs  = changeRequests.filter(cr => cr.status==="APPROVED")
  const totalCRBudget = changeRequests.reduce((s,cr) => s+(cr.budgetImpact||0),0)

  // ── Milestone window ──────────────────────────────────────────────────
  const milestoneList = milestoneWindow===30 ? milestones.d30
    : milestoneWindow===60 ? milestones.d60 : milestones.d90

  // ── Project health grid ────────────────────────────────────────────────
  // Compute EVM per project from budgetItems
  const projectEVM: Record<string,{cpi:number;spi:number}> = {}
  for (const p of projects) {
    const items = budgetItems.filter(b => b.projectId===p.id)
    const ev = items.reduce((s,b)=>s+b.earnedValue,0)
    const ac = items.reduce((s,b)=>s+b.actualCost,0)
    const pl = items.reduce((s,b)=>s+b.plannedCost,0)
    projectEVM[p.id] = {
      cpi: ac>0 ? ev/ac : 1,
      spi: pl>0 ? ev/pl : 1,
    }
  }

  const now = new Date().toLocaleDateString("en-US", {
    weekday:"long", year:"numeric", month:"long", day:"numeric" })
  const tx = useTranslations("exec")
  const router = useRouter()

  async function approvalAct(projectId: string, action: "approve" | "reject") {
    let reason = ""
    if (action === "reject") reason = window.prompt("Reason for sending back to Draft (optional):") || ""
    const res = await fetch(`/api/projects/${projectId}/approval`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(d?.error || `Action failed (${res.status})`)
      return
    }
    router.refresh()
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflowY:"auto",
      background:"var(--surface)" }}>

      {/* ── Executive Header ── */}
      <div style={{ background:"linear-gradient(135deg,#1a3a5c 0%,#1B6CA8 100%)",
        padding:"24px 28px", color:"#fff", flexShrink:0 }}>
        <div className="fs-wrap" style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:14 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,.5)",
              textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>
              Executive Dashboard · FlowSync PM
            </div>
            <h1 style={{ fontSize:26, fontWeight:800, margin:"0 0 4px", color:"#fff" }}>
              Portfolio Overview
            </h1>
            <div suppressHydrationWarning style={{ fontSize:12, color:"rgba(255,255,255,.55)" }}>{now}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <button onClick={async () => {
                const btn = document.getElementById("deck-btn-exec") as HTMLButtonElement | null
                if (btn) { btn.disabled = true; btn.textContent = "Building…" }
                try {
                  const res = await fetch(`/api/workspace/export-pptx`, {
                    method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
                    body: JSON.stringify({ flavor:"EXECUTIVE" }),
                  })
                  if (!res.ok) { alert("Deck generation failed"); return }
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a"); a.href = url; a.download = "Executive_Portfolio_Deck.pptx"; a.click()
                  URL.revokeObjectURL(url)
                } finally { if (btn) { btn.disabled = false; btn.textContent = "🎬 Executive deck" } }
              }}
              id="deck-btn-exec"
              style={{ padding:"8px 16px", background:"rgba(255,255,255,.12)", color:"#fff",
                border:"1px solid rgba(255,255,255,.3)", borderRadius:"var(--radius)",
                fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"var(--font)",
                marginBottom:10 }}>
              🎬 Executive deck
            </button>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginBottom:4 }}>
              Overall portfolio health
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              {Object.entries(healthCounts).map(([h,c]) => (
                <div key={h} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:22, fontWeight:800,
                    color:h==="GREEN"?"#86EFAC":h==="AMBER"?"#FDE68A":"#FCA5A5" }}>
                    {c}
                  </div>
                  <div style={{ fontSize:9, color:"rgba(255,255,255,.4)",
                    textTransform:"uppercase" }}>
                    {HEALTH_CFG[h]?.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:16 }}>

      {/* ── Awaiting approval ── */}
      {(() => {
        const pending = projects.filter((p: any) => p.status === "PENDING_APPROVAL")
        if (!pending.length) return null
        return (
          <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A",
            borderLeft:"4px solid #F59E0B", borderRadius:"var(--radius)",
            padding:"14px 18px", margin:"0 0 16px" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#92400E", marginBottom:2 }}>
              {tx("⏳ Projects awaiting your approval")} ({pending.length})
            </div>
            <div style={{ fontSize:11, color:"#B45309", marginBottom:10 }}>
              Approving authorizes execution — the project moves from Draft to Active and a governance
              decision is logged. Rejecting returns it to Draft with your reason.
            </div>
            {pending.map((p: any) => {
              const pm = (p.members || []).find((m: any) => m.projectRole === "PM")
              return (
                <div key={p.id} className="fs-wrap" style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"9px 0", borderTop:"1px solid #FDE68A" }}>
                  <a href={`/projects/${p.id}`} style={{ flex:1, textDecoration:"none" }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{p.name}</span>
                    <span style={{ fontSize:11, color:"var(--text-3)", marginLeft:8 }}>
                      {p.code}{pm?.user?.name ? ` · PM: ${pm.user.name}` : ""}
                    </span>
                    <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>
                      Submitted{p.approvalRequestedBy?.name ? ` by ${p.approvalRequestedBy.name}` : ""}
                      {p.approvalRequestedAt ? ` · ${new Date(p.approvalRequestedAt).toLocaleDateString("en-US", { month:"short", day:"numeric", timeZone:"UTC" })}` : ""} — requesting authorization to start execution
                    </div>
                  </a>
                  <button onClick={() => approvalAct(p.id, "approve")}
                    style={{ padding:"6px 14px", background:"#ECFDF5", border:"1px solid #A7F3D0",
                      borderRadius:"var(--radius)", fontSize:12, fontWeight:600, color:"#059669",
                      cursor:"pointer", fontFamily:"var(--font)" }}>{tx("✓ Approve")}</button>
                  <button onClick={() => approvalAct(p.id, "reject")}
                    style={{ padding:"6px 14px", background:"#FEF2F2", border:"1px solid #FECACA",
                      borderRadius:"var(--radius)", fontSize:12, fontWeight:600, color:"#DC2626",
                      cursor:"pointer", fontFamily:"var(--font)" }}>{tx("✗ Reject")}</button>
                </div>
              )
            })}
          </div>
        )
      })()}

        {/* ── KPI Strip ── */}
        <div className="fs-cols-6">
          <KPI icon="📁" label="Active projects" value={activeProjects.length} />
          <KPI icon="💰" label="Total portfolio budget" value={fmtCurrency(totalBAC)}
            sub={`${budgetPct}% spent`}
            color={budgetPct>90?"var(--red)":budgetPct>75?"var(--amber)":"var(--text)"} />
          <KPI icon="📊" label="Portfolio CPI"
            value={portfolioCPI.toFixed(2)}
            sub={portfolioCPI>=1?"Under budget":"Over budget"}
            color={portfolioCPI>=1?"var(--green)":"var(--red)"}
            bg={portfolioCPI>=1?"#ECFDF5":"#FEF2F2"} />
          <KPI icon="⏱" label="Portfolio SPI"
            value={portfolioSPI.toFixed(2)}
            sub={portfolioSPI>=1?"On schedule":"Behind schedule"}
            color={portfolioSPI>=1?"var(--green)":"var(--amber)"}
            bg={portfolioSPI>=1?"#ECFDF5":"#FFFBEB"} />
          <KPI icon="⚠" label="High/Critical risks"
            value={criticalRisks+highRisks}
            sub={`${criticalRisks} critical`}
            color={criticalRisks>0?"var(--red)":highRisks>0?"var(--amber)":"var(--green)"}
            bg={criticalRisks>0?"#FEF2F2":"#fff"} />
          <KPI icon="💹" label="Benefits realized"
            value={`${realizedBenefits}/${benefits.length}`}
            sub={missedBenefits>0?`${missedBenefits} missed`:`${projectedBenefits} projected`}
            color={missedBenefits>0?"var(--red)":"var(--text)"} />
        </div>

        {/* ── Row 1: Project health grid + Financial summary ── */}
        <div className="fs-cols-2">

          {/* Project health grid */}
          <Section title={tx("Project Health Scorecard")} icon="🚦"
            action={
              <Link href="/projects" style={{ fontSize:11, color:"var(--steel)",
                textDecoration:"none" }}>All projects →</Link>
            }>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"var(--surface)" }}>
                    {["Project","Health","Priority","Progress","CPI","SPI","CR"].map((h,i)=>(
                      <th key={i} style={{ padding:"8px 10px", textAlign:"left",
                        fontSize:9, fontWeight:700, color:"var(--text-3)",
                        textTransform:"uppercase", letterSpacing:".05em",
                        borderBottom:"1px solid var(--border)", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projects.map(p => {
                    const h = HEALTH_CFG[p.health] || HEALTH_CFG.GREEN
                    const pc = PRIORITY_CFG[p.priority] || PRIORITY_CFG.MEDIUM
                    const evm = projectEVM[p.id] || { cpi:1, spi:1 }
                    const pendingCR = changeRequests.filter(cr =>
                      cr.project?.id===p.id && ["SUBMITTED","UNDER_REVIEW"].includes(cr.status)
                    ).length
                    return (
                      <tr key={p.id}
                        style={{ borderBottom:"1px solid var(--surface-1,#F8FAFC)" }}>
                        <td style={{ padding:"9px 10px" }}>
                          <Link href={`/projects/${p.id}`}
                            style={{ fontSize:12, fontWeight:600, color:"var(--text)",
                              textDecoration:"none", display:"block",
                              overflow:"hidden", textOverflow:"ellipsis",
                              whiteSpace:"nowrap", maxWidth:160 }}>
                            {p.name}
                          </Link>
                          <div style={{ fontSize:10, color:"var(--text-4)" }}>{p.code}</div>
                        </td>
                        <td style={{ padding:"9px 10px" }}>
                          <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px",
                            borderRadius:10, color:h.color, background:h.bg }}>
                            {h.dot} {h.label}
                          </span>
                        </td>
                        <td style={{ padding:"9px 10px", fontSize:11,
                          fontWeight:700, color:pc.color }}>
                          {p.priority}
                        </td>
                        <td style={{ padding:"9px 10px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:50, height:6, background:"var(--border)",
                              borderRadius:3, overflow:"hidden" }}>
                              <div style={{ height:"100%", borderRadius:3,
                                width:`${p.percentComplete||0}%`,
                                background:p.percentComplete>=80?"var(--green)":
                                  p.percentComplete>=50?"var(--steel)":"var(--amber)" }} />
                            </div>
                            <span style={{ fontSize:11, color:"var(--text-3)" }}>
                              {p.percentComplete||0}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding:"9px 10px", fontSize:11, fontWeight:700,
                          color:evm.cpi>=1?"var(--green)":"var(--red)" }}>
                          {evm.cpi.toFixed(2)}
                        </td>
                        <td style={{ padding:"9px 10px", fontSize:11, fontWeight:700,
                          color:evm.spi>=1?"var(--green)":"var(--amber)" }}>
                          {evm.spi.toFixed(2)}
                        </td>
                        <td style={{ padding:"9px 10px" }}>
                          {pendingCR > 0 ? (
                            <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px",
                              borderRadius:10, background:"#FFFBEB", color:"#D97706" }}>
                              {pendingCR} pending
                            </span>
                          ) : (
                            <span style={{ fontSize:10, color:"var(--text-4)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {projects.length === 0 && (
                    <tr><td colSpan={7} style={{ padding:"20px", textAlign:"center",
                      fontSize:12, color:"var(--text-3)" }}>No active projects</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Financial summary */}
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <Section title={tx("Financial Overview")} icon="💰">
              <div style={{ padding:16 }}>
                {/* Budget utilization bar */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between",
                    fontSize:12, marginBottom:6 }}>
                    <span style={{ color:"var(--text-2)", fontWeight:500 }}>Portfolio budget utilization</span>
                    <span style={{ fontWeight:700,
                      color:budgetPct>90?"var(--red)":budgetPct>75?"var(--amber)":"var(--text)" }}>
                      {budgetPct}%
                    </span>
                  </div>
                  <div style={{ height:10, background:"var(--border)", borderRadius:5, overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:5,
                      width:`${Math.min(budgetPct,100)}%`,
                      background:budgetPct>90?"var(--red)":budgetPct>75?"var(--amber)":"var(--steel)",
                      transition:"width .5s" }} />
                  </div>
                </div>

                {/* EVM metrics row */}
                <div className="fs-cols-3" style={{ marginBottom:14 }}>
                  {[
                    { label:tx("Budget (BAC)"),  value:fmtCurrency(totalBAC), color:"var(--text)" },
                    { label:tx("Actual Cost"),   value:fmtCurrency(totalSpent),
                      color:totalSpent>totalBAC?"var(--red)":"var(--text)" },
                    { label:tx("Earned Value"),  value:fmtCurrency(totalEV), color:"var(--steel)" },
                  ].map(m => (
                    <div key={m.label} style={{ background:"var(--surface)",
                      borderRadius:"var(--radius)", padding:"10px 12px" }}>
                      <div style={{ fontSize:9, fontWeight:700, color:"var(--text-4)",
                        textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize:16, fontWeight:700, color:m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* CR financial impact */}
                {totalCRBudget !== 0 && (
                  <div style={{ background:totalCRBudget>0?"#FEF2F2":"#ECFDF5",
                    borderRadius:"var(--radius)", padding:"10px 12px", fontSize:12 }}>
                    <span style={{ fontWeight:700,
                      color:totalCRBudget>0?"var(--red)":"var(--green)" }}>
                      {totalCRBudget>0?"⚠":"✓"} Pending CR budget impact:&nbsp;
                      {totalCRBudget>0?"+":""}{fmtCurrency(Math.abs(totalCRBudget))}
                    </span>
                    <span style={{ color:"var(--text-3)", marginLeft:4 }}>
                      across {changeRequests.filter(cr=>cr.budgetImpact).length} change requests
                    </span>
                  </div>
                )}

                {projectedOverrun > 0 && (
                  <div style={{ background:"#FEF2F2", borderRadius:"var(--radius)",
                    padding:"10px 12px", fontSize:12, marginTop:10,
                    color:"var(--red)", fontWeight:600 }}>
                    ⚠ {projectedOverrun} project{projectedOverrun!==1?"s":""} at &gt;90% budget utilization
                  </div>
                )}
              </div>
            </Section>

            {/* Benefits realization */}
            <Section title={tx("Benefits Realization")} icon="💹">
              <div style={{ padding:"10px 16px" }}>
                <div style={{ display:"flex", gap:10, marginBottom:10 }}>
                  {Object.entries(BENEFIT_CFG).map(([s,c]) => {
                    const count = benefits.filter(b=>b.status===s).length
                    return (
                      <div key={s} style={{ flex:1, textAlign:"center", padding:"8px 4px",
                        background:"var(--surface)", borderRadius:6 }}>
                        <div style={{ fontSize:18, fontWeight:800, color:c.color }}>{count}</div>
                        <div style={{ fontSize:9, color:"var(--text-4)", textTransform:"uppercase",
                          letterSpacing:".04em" }}>{tx((c.label||s) as any)}</div>
                      </div>
                    )
                  })}
                </div>
                {benefits.filter(b=>b.status==="REALIZED").slice(0,2).map(b => (
                  <div key={b.id} style={{ fontSize:11, color:"var(--green)",
                    padding:"4px 0", borderBottom:"1px solid var(--surface-1,#F8FAFC)" }}>
                    ✓ {b.title}
                    {b.actualValue && <span style={{ color:"var(--text-3)", marginLeft:6 }}>{b.actualValue}</span>}
                  </div>
                ))}
                {missedBenefits > 0 && (
                  <div style={{ fontSize:11, color:"var(--red)", marginTop:6, fontWeight:600 }}>
                    ✗ {missedBenefits} benefit{missedBenefits!==1?"s":""} missed
                  </div>
                )}
              </div>
            </Section>
          </div>
        </div>

        {/* ── Row 2: Risk exposure + Milestone pipeline ── */}
        <div className="fs-cols-2">

          {/* Risk exposure */}
          <Section title={tx("Risk Exposure — Top Threats")} icon="⚠"
            action={
              <div style={{ display:"flex", gap:8, fontSize:11 }}>
                <span style={{ padding:"2px 7px", borderRadius:10,
                  background:"#FEF2F2", color:"var(--red)", fontWeight:700 }}>
                  {criticalRisks} critical
                </span>
                <span style={{ padding:"2px 7px", borderRadius:10,
                  background:"#FFFBEB", color:"var(--amber)", fontWeight:700 }}>
                  {highRisks} high
                </span>
              </div>
            }>
            {risks.length === 0 ? (
              <div style={{ padding:"16px", textAlign:"center", fontSize:12,
                color:"var(--text-3)" }}>No high risks open</div>
            ) : risks.slice(0,8).map(r => {
              const scoreColor = r.score>=15?"var(--red)":r.score>=9?"var(--amber)":"var(--steel)"
              const scoreBg    = r.score>=15?"#FEF2F2":r.score>=9?"#FFFBEB":"#EFF6FF"
              return (
                <div key={r.id} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"9px 14px", borderBottom:"1px solid var(--surface-1,#F8FAFC)" }}>
                  <div style={{ width:28, height:28, borderRadius:6, flexShrink:0,
                    background:scoreBg, display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:11, fontWeight:800, color:scoreColor }}>
                    {r.score}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:500, color:"var(--text)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize:10, color:"var(--text-4)" }}>
                      {r.project?.code} · {r.project?.name}
                    </div>
                  </div>
                  <Link href={`/projects/${r.project?.id}/risks`}
                    style={{ fontSize:10, color:"var(--steel)", textDecoration:"none",
                      flexShrink:0 }}>View →</Link>
                </div>
              )
            })}
          </Section>

          {/* Milestone pipeline */}
          <Section title={tx("Milestone Pipeline")} icon="◇"
            action={
              <div style={{ display:"flex", gap:2, border:"1px solid var(--border)",
                borderRadius:6, overflow:"hidden" }}>
                {([30,60,90] as const).map(d => (
                  <button key={d} onClick={() => setMilestoneWindow(d)}
                    style={{ padding:"3px 10px", border:"none", fontSize:11,
                      cursor:"pointer", fontFamily:"var(--font)",
                      background:milestoneWindow===d?"var(--steel)":"#fff",
                      color:milestoneWindow===d?"#fff":"var(--text-3)" }}>
                    {d}d
                  </button>
                ))}
              </div>
            }>
            {milestoneList.length === 0 ? (
              <div style={{ padding:"16px", textAlign:"center", fontSize:12,
                color:"var(--text-3)" }}>
                No milestones in next {milestoneWindow} days
              </div>
            ) : milestoneList.map(m => {
              const days = daysUntil(m.dueDate)
              const isAtRisk = m.status==="AT_RISK"
              return (
                <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"9px 14px", borderBottom:"1px solid var(--surface-1,#F8FAFC)" }}>
                  <span style={{ fontSize:14,
                    color:isAtRisk?"var(--red)":"var(--amber)" }}>◇</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:500, color:"var(--text)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {m.name}
                    </div>
                    <div style={{ fontSize:10, color:"var(--text-4)" }}>
                      {m.project?.code} · {fmtDate(m.dueDate)}
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:12, fontWeight:700,
                      color:days!==null&&days<=7?"var(--red)":days!==null&&days<=14?"var(--amber)":"var(--text-3)" }}>
                      {days===0?"Today":days===1?"Tomorrow":`${days}d`}
                    </div>
                    {isAtRisk && (
                      <div style={{ fontSize:9, color:"var(--red)", fontWeight:600 }}>AT RISK</div>
                    )}
                  </div>
                </div>
              )
            })}
          </Section>
        </div>

        {/* ── Row 3: Pending decisions + Recent decisions ── */}
        <div className="fs-cols-2">

          {/* Change requests requiring action */}
          <Section title={tx("Change Requests — Action Required")} icon="🔄"
            action={pendingCRs.length > 0 ? (
              <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px",
                borderRadius:10, background:"#FFFBEB", color:"var(--amber)" }}>
                {pendingCRs.length} pending
              </span>
            ) : undefined}>
            {pendingCRs.length === 0 ? (
              <div style={{ padding:"16px", textAlign:"center", fontSize:12,
                color:"var(--text-3)" }}>No pending change requests</div>
            ) : pendingCRs.slice(0,6).map(cr => {
              const sc = STATUS_CFG[cr.status] || STATUS_CFG.SUBMITTED
              const pc = PRIORITY_CFG[cr.priority] || PRIORITY_CFG.MEDIUM
              return (
                <div key={cr.id} style={{ padding:"10px 14px",
                  borderBottom:"1px solid var(--surface-1,#F8FAFC)" }}>
                  <div style={{ display:"flex", alignItems:"flex-start",
                    justifyContent:"space-between", gap:8 }}>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:"var(--text-3)" }}>
                          {cr.code}
                        </span>
                        <span style={{ fontSize:9, fontWeight:700, padding:"1px 6px",
                          borderRadius:8, color:sc.color, background:sc.bg }}>
                          {cr.status.replace("_"," ")}
                        </span>
                        <span style={{ fontSize:9, fontWeight:700, color:pc.color }}>
                          {cr.priority}
                        </span>
                      </div>
                      <div style={{ fontSize:12, fontWeight:500, color:"var(--text)",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {cr.title}
                      </div>
                      <div style={{ fontSize:10, color:"var(--text-4)" }}>
                        {cr.project?.code} · {cr.requestedBy?.name}
                        {cr.budgetImpact ? ` · ${cr.budgetImpact>0?"+":""}${fmtCurrency(Math.abs(cr.budgetImpact))}` : ""}
                      </div>
                    </div>
                    <Link href={`/projects/${cr.project?.id}/changes`}
                      style={{ fontSize:10, color:"var(--steel)", textDecoration:"none",
                        flexShrink:0, whiteSpace:"nowrap" }}>
                      Review →
                    </Link>
                  </div>
                </div>
              )
            })}
            {approvedCRs.length > 0 && (
              <div style={{ padding:"8px 14px", background:"#ECFDF5",
                fontSize:11, color:"var(--green)", fontWeight:500 }}>
                ✓ {approvedCRs.length} approved — awaiting implementation
              </div>
            )}
          </Section>

          {/* Recent key decisions */}
          <Section title={tx("Recent Key Decisions")} icon="⚡"
            action={
              <span style={{ fontSize:11, color:"var(--text-3)" }}>Last 5 recorded</span>
            }>
            {decisions.length === 0 ? (
              <div style={{ padding:"16px", textAlign:"center", fontSize:12,
                color:"var(--text-3)" }}>No decisions recorded</div>
            ) : decisions.map(d => (
              <div key={d.id} style={{ padding:"10px 14px",
                borderBottom:"1px solid var(--surface-1,#F8FAFC)" }}>
                <div style={{ display:"flex", alignItems:"flex-start",
                  justifyContent:"space-between", gap:8 }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:"var(--text-3)" }}>
                        {d.code}
                      </span>
                      <span style={{ fontSize:10, color:"var(--text-4)" }}>
                        {fmtDate(d.madeAt)}
                      </span>
                    </div>
                    <div style={{ fontSize:12, fontWeight:500, color:"var(--text)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {d.title}
                    </div>
                    <div style={{ fontSize:10, color:"var(--text-4)" }}>
                      {d.project?.code} · {d.madeBy?.name}
                    </div>
                  </div>
                  <Link href={`/projects/${d.project?.id}/decisions`}
                    style={{ fontSize:10, color:"var(--steel)", textDecoration:"none",
                      flexShrink:0 }}>
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </Section>
        </div>

        {/* ── PM Standard Footer ── */}
        <div style={{ background:"#fff", border:"1px solid var(--border)",
          borderRadius:"var(--radius)", padding:"12px 16px",
          fontSize:11, color:"var(--text-4)", textAlign:"center", lineHeight:1.6 }}>
          FlowSync PM Executive Dashboard · PM Measurement Performance Domain (§2.7) ·
          Data refreshes on page load · CPI and SPI calculated from Earned Value Management data
        </div>
      </div>
    </div>
  )
}
