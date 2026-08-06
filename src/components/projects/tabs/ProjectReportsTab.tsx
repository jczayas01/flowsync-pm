"use client"
// src/components/projects/tabs/ProjectReportsTab.tsx

import { useLocale, useTranslations } from "next-intl"
import { M365ImportModal } from "@/components/projects/M365ImportModal"
import { DateField } from "@/components/shared/DatePicker"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import nextDynamic from "next/dynamic"

const ReportSnapshot = nextDynamic(() => import("@/components/charts/ReportSnapshot"),
  { ssr: false, loading: () => <div style={{ height: 120 }} /> })

const REPORT_TYPES = [
  { value:"STATUS",       label:"Weekly Status Report",  icon:"📋",
    desc:"Accomplishments, plans, risks, EVM summary." },
  { value:"PLAN",         label:"Project Management Plan", icon:"📘",
    desc:"The integrated baseline: scope, schedule, cost, governance, risk and change control — the document a sponsor signs." },
  { value:"BRIEF",        label:"Project Brief",         icon:"📄",
    desc:"Onboarding document: background, scope, governance, risks — built from your documents." },
  { value:"EXECUTIVE",    label:"Executive Brief",        icon:"👔",
    desc:"1-page strategic summary for leadership." },
  { value:"PHASE_GATE",   label:"Phase Gate Review",      icon:"🔁",
    desc:"Go/No-Go decision with entry/exit criteria." },
  { value:"EVM",          label:"EVM Performance Report", icon:"📊",
    desc:"Full Earned Value analysis — CPI, SPI, EAC, TCPI." },
  { value:"RISK_SUMMARY", label:"Risk Summary Report",    icon:"⚠",
    desc:"Risk register summary and recommended responses." },
]

const AUDIENCES = [
  { value:"TEAM",               label:"Project Team",       icon:"👥" },
  { value:"SPONSOR",            label:"Executive Sponsor",  icon:"🏢" },
  { value:"STEERING_COMMITTEE", label:"Steering Committee", icon:"⚖" },
  { value:"PMO",                label:"PMO",                icon:"📐" },
]

function coerceReport(r: any) {
  if (!r || typeof r !== "object") return r
  const H: Record<string, string> = {
    GREEN:"GREEN", YELLOW:"YELLOW", AMBER:"YELLOW", RED:"RED",
    VERDE:"GREEN", AMARILLO:"YELLOW", "ÁMBAR":"YELLOW", AMBAR:"YELLOW", ROJO:"RED",
  }
  const out: any = { ...r }
  if (out.overallHealth !== undefined)
    out.overallHealth = H[String(out.overallHealth).toUpperCase().trim()] || "GREEN"
  for (const k of Object.keys(out)) {
    const v = out[k]
    if (v != null && typeof v === "object" && !Array.isArray(v) &&
        /^(accomplishments|planned|decisions|strategic|critical|recommended|corrective)/i.test(k))
      out[k] = Object.values(v)
  }
  return out
}

const HEALTH_COLOR: Record<string,string> = {
  GREEN:"#059669", AMBER:"#D97706", YELLOW:"#D97706", RED:"#DC2626",
}
const HEALTH_LABEL: Record<string,string> = {
  GREEN:"On track", AMBER:"At risk", YELLOW:"At risk", RED:"Off track",
}

function fmtDate(d:any) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric", timeZone:"UTC" })
}

// ── Report section helpers (top-level, not nested) ──────────────────────────

function ReportSection({ title, children }: { title:string; children:React.ReactNode }) {
  // Report chrome follows the UI language; the AI narrative already does.
  const _loc = useLocale()
  const SEC_ES: Record<string, string> = {
    "Executive Summary": "Resumen Ejecutivo",
    "Key Metrics": "Métricas Clave",
    "Accomplishments": "Logros del Período",
    "Accomplishments This Period": "Logros del Período",
    "Planned Next Period": "Plan del Próximo Período",
    "Budget Status": "Estado del Presupuesto",
    "Schedule Status": "Estado del Cronograma",
    "Risks & Issues": "Riesgos y Problemas",
    "Decisions Needed": "Decisiones Requeridas",
    "Performance Snapshot": "Panorama de Desempeño",
    "Recommendations": "Recomendaciones",
    "Milestone Review": "Revisión de Hitos",
    "Health Assessment": "Evaluación de Salud",
    "Earned Value Analysis": "Análisis de Valor Ganado",
    "Top Risks": "Riesgos Principales",
    "Mitigation Actions": "Acciones de Mitigación",
  }
  const _title = _loc === "es" ? (SEC_ES[String(title)] || title) : title
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#1E293B", textTransform:"uppercase",
        letterSpacing:".06em", marginBottom:8, paddingBottom:4,
        borderBottom:"2px solid var(--r-accent, #1B6CA8)" }}>
        {_title}
      </div>
      {children}
    </div>
  )
}

/** Plain table for baseline sections — the plan is mostly tabular by nature. */
function ReportTable({ head, rows }: { head: string[]; rows: (string|number|null|undefined)[][] }) {
  return (
    <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
      <table style={{ width:"100%", minWidth:460, borderCollapse:"collapse", fontSize:12.5 }}>
        <thead>
          <tr style={{ background:"#F1F5F9" }}>
            {head.map(h => (
              <th key={h} style={{ textAlign:"left", padding:"7px 10px", fontWeight:700,
                color:"#1E293B", borderBottom:"1px solid #E2E8F0", whiteSpace:"nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i) => (
            <tr key={i} style={{ borderBottom:"1px solid #F1F5F9" }}>
              {r.map((c,j) => (
                <td key={j} style={{ padding:"7px 10px", color: j===0 ? "#1E293B" : "#374151",
                  fontWeight: j===0 ? 600 : 400, verticalAlign:"top", lineHeight:1.55 }}>
                  {c ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReportBullet({ text }: { text:string }) {
  return (
    <div style={{ display:"flex", gap:8, marginBottom:5 }}>
      <span style={{ color:"var(--r-accent, #1B6CA8)", flexShrink:0, marginTop:1 }}>•</span>
      <span style={{ fontSize:13, color:"#374151", lineHeight:1.6 }}>{text}</span>
    </div>
  )
}

function ReportMetric({ label, value, color }: { label:string; value:string; color?:string }) {
  return (
    <div style={{ textAlign:"center", padding:"10px 8px", background:"#F8FAFC",
      borderRadius:6, flex:1 }}>
      <div style={{ fontSize:16, fontWeight:800, color:color||"#1E293B" }}>{value}</div>
      <div style={{ fontSize:9, color:"#64748B", textTransform:"uppercase",
        letterSpacing:".05em", marginTop:2 }}>{label}</div>
    </div>
  )
}

// ── Report view ─────────────────────────────────────────────────────────────

function ReportView({ report, reportType, audience, generatedAt, project, workspaceName, workspaceLogo, accent = "#1B6CA8", accent2 = "#F59E0B", onDownload, downloading, onDownloadPdf, downloadingPdf, onEmail, snapshot }: {
  report:any; reportType:string; audience:string; generatedAt:string;
  project:any; workspaceName:string; workspaceLogo?:string; accent?:string; accent2?:string;
  onDownload:()=>void; downloading:boolean
  onDownloadPdf:()=>void; downloadingPdf:boolean; onEmail?:()=>void
  snapshot?: import("@/components/charts/ReportSnapshot").ReportSnapshotData | null
}) {
  const healthColor = HEALTH_COLOR[report.overallHealth] || "#059669"

  return (
    <div id="fs-report-print" className="report-print-root" style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:8, overflow:"hidden",
      ["--r-accent" as any]: accent, ["--r-accent2" as any]: accent2 }}>
      <style>{`@media print {
            /* Every ancestor of the report is a flex column with a fixed height
               and its own scroll area, so the printer only ever saw the visible
               slice. Release the whole chain, then show the report alone. */
            html, body { height: auto !important; overflow: visible !important; }
            body.fs-printing * {
              overflow: visible !important; max-height: none !important; height: auto !important;
            }
            body * { visibility: hidden !important; }
            #fs-report-print, #fs-report-print * { visibility: visible !important; }
            #fs-report-print {
              position: absolute !important; left: 0; top: 0; width: 100% !important;
              margin: 0 !important; box-shadow: none !important; border: none !important;
            }
            @page { margin: 14mm; }
          }`}</style>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${accent} 0%, ${accent2} 140%)`, padding:"20px 24px", color:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
              {workspaceLogo && (
                <img src={workspaceLogo} alt={workspaceName}
                  style={{ height:24, maxWidth:90, objectFit:"contain",
                    filter:"brightness(0) invert(1)", opacity:.85 }} />
              )}
              <span style={{ fontSize:10, opacity:.6, letterSpacing:".08em", textTransform:"uppercase" }}>
                {workspaceName || "FlowSync PM"} — Enterprise Project Management
              </span>
            </div>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>{report.reportTitle}</div>
            <div style={{ fontSize:11, opacity:.7 }}>
              {project?.name} ({project?.code}) · Generated {new Date(generatedAt).toLocaleString("en-US")} ·
              Audience: {AUDIENCES.find(a=>a.value===audience)?.label}
            </div>
          </div>
          <div style={{ padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:700,
            background:healthColor+"30", color:healthColor, border:`1px solid ${healthColor}50`,
            flexShrink:0 }}>
            {HEALTH_LABEL[report.overallHealth]||"On track"}
          </div>
        </div>
      </div>

      <div style={{ padding:24 }}>
        {/* Disclaimer */}
        <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:6,
          padding:"8px 14px", fontSize:11, color:"#92400E", marginBottom:20 }}>
          ⚠ AI-generated report — review for accuracy before distributing.
        </div>

        {snapshot && (snapshot.scurve?.length || snapshot.statusCounts?.length || snapshot.budget) ? (
          <ReportSection title="Performance Snapshot">
            <ReportSnapshot data={snapshot} accent={accent} accent2={accent2} />
          </ReportSection>
        ) : null}

        {/* PROJECT MANAGEMENT PLAN — the baseline document, not a status update */}
        {reportType==="PLAN" && (
          <>
            <ReportSection title="Purpose of this Plan">
              <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.documentPurpose}</p>
            </ReportSection>
            {report.backgroundAndJustification && (
              <ReportSection title="Background and Justification">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.backgroundAndJustification}</p>
              </ReportSection>
            )}
            {Array.isArray(report.objectives) && report.objectives.length > 0 && (
              <ReportSection title="Objectives">
                {report.objectives.map((o:string,i:number) => <ReportBullet key={i} text={o} />)}
              </ReportSection>
            )}
            {report.deliveryApproach && (
              <ReportSection title="Delivery Approach">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.deliveryApproach}</p>
              </ReportSection>
            )}
            {(report.scopeStatement || report.outOfScope) && (
              <ReportSection title="Scope Baseline">
                {report.scopeStatement && (
                  <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:"0 0 8px" }}>
                    <strong style={{ color:"#1E293B" }}>In scope. </strong>{report.scopeStatement}
                  </p>
                )}
                {report.outOfScope && (
                  <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>
                    <strong style={{ color:"#1E293B" }}>Out of scope. </strong>{report.outOfScope}
                  </p>
                )}
              </ReportSection>
            )}
            {Array.isArray(report.deliverables) && report.deliverables.length > 0 && (
              <ReportSection title="Key Deliverables">
                <ReportTable head={["ID","Deliverable","Owner","Acceptance"]}
                  rows={report.deliverables.map((d:any)=>[d.id,d.deliverable,d.owner,d.acceptance])} />
              </ReportSection>
            )}
            {Array.isArray(report.scheduleBaseline) && report.scheduleBaseline.length > 0 && (
              <ReportSection title="Schedule Baseline">
                <ReportTable head={["Phase","Key deliverable","Target date","Gate owner"]}
                  rows={report.scheduleBaseline.map((r2:any)=>[r2.phase,r2.deliverable,r2.targetDate,r2.gateOwner])} />
              </ReportSection>
            )}
            {report.criticalPath && (
              <ReportSection title="Critical Path">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.criticalPath}</p>
              </ReportSection>
            )}
            {Array.isArray(report.costBaseline) && report.costBaseline.length > 0 && (
              <ReportSection title="Cost Baseline">
                <ReportTable head={["Category","Amount","Basis"]}
                  rows={report.costBaseline.map((c:any)=>[c.category,c.amount,c.notes])} />
              </ReportSection>
            )}
            {report.budgetControls && (
              <ReportSection title="Budget Controls and Earned Value">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.budgetControls}</p>
              </ReportSection>
            )}
            {Array.isArray(report.governance) && report.governance.length > 0 && (
              <ReportSection title="Governance and Organization">
                <ReportTable head={["Role","Holder","Responsibility"]}
                  rows={report.governance.map((g:any)=>[g.role,g.holder,g.responsibility])} />
              </ReportSection>
            )}
            {report.decisionRights && (
              <ReportSection title="Decision Rights">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.decisionRights}</p>
              </ReportSection>
            )}
            {report.meetingCadence && (
              <ReportSection title="Reporting Cadence">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.meetingCadence}</p>
              </ReportSection>
            )}
            {report.riskManagement && (
              <ReportSection title="Risk Management">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:"0 0 10px" }}>{report.riskManagement}</p>
                {Array.isArray(report.topRisks) && report.topRisks.length > 0 && (
                  <ReportTable head={["Risk","Score","Response"]}
                    rows={report.topRisks.map((r2:any)=>[r2.risk,r2.score,r2.response])} />
                )}
              </ReportSection>
            )}
            {report.qualityAndAcceptance && (
              <ReportSection title="Quality and Acceptance">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.qualityAndAcceptance}</p>
              </ReportSection>
            )}
            {report.changeControl && (
              <ReportSection title="Change Control">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.changeControl}</p>
              </ReportSection>
            )}
            {Array.isArray(report.communications) && report.communications.length > 0 && (
              <ReportSection title="Communications">
                <ReportTable head={["Audience","Content","Frequency","Channel"]}
                  rows={report.communications.map((c:any)=>[c.audience,c.content,c.frequency,c.channel])} />
              </ReportSection>
            )}
            {Array.isArray(report.successCriteria) && report.successCriteria.length > 0 && (
              <ReportSection title="Success Criteria">
                {report.successCriteria.map((c:string,i:number) => <ReportBullet key={i} text={c} />)}
              </ReportSection>
            )}
            {(Array.isArray(report.assumptions) || Array.isArray(report.constraints)) && (
              <ReportSection title="Assumptions and Constraints">
                {(report.assumptions||[]).map((a:string,i:number) => <ReportBullet key={`a${i}`} text={`Assumption — ${a}`} />)}
                {(report.constraints||[]).map((c:string,i:number) => <ReportBullet key={`c${i}`} text={`Constraint — ${c}`} />)}
              </ReportSection>
            )}
            {report.approval && (
              <ReportSection title="Baseline Approval">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:"0 0 22px" }}>{report.approval}</p>
                <div style={{ display:"flex", gap:40, flexWrap:"wrap" }}>
                  {["Executive Sponsor","Project Manager"].map(role => (
                    <div key={role} style={{ minWidth:200 }}>
                      <div style={{ borderBottom:"1px solid #94A3B8", height:34 }} />
                      <div style={{ fontSize:11, color:"#64748B", marginTop:5 }}>{role} · Date</div>
                    </div>
                  ))}
                </div>
              </ReportSection>
            )}
          </>
        )}

        {/* PROJECT BRIEF — onboarding document, document-grounded */}
        {reportType==="BRIEF" && (
          <>
            <ReportSection title={"Executive Summary"}>
              <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.executiveSummary}</p>
            </ReportSection>
            {report.background && (
              <ReportSection title="Background">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.background}</p>
              </ReportSection>
            )}
            {Array.isArray(report.objectives) && report.objectives.length > 0 && (
              <ReportSection title="Objectives">
                {report.objectives.map((o:string,i:number) => <ReportBullet key={i} text={o} />)}
              </ReportSection>
            )}
            {(report.scopeSummary || report.outOfScopeSummary) && (
              <ReportSection title="Scope">
                {report.scopeSummary && (
                  <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:"0 0 8px" }}>
                    <strong style={{ color:"#1E293B" }}>In scope. </strong>{report.scopeSummary}
                  </p>
                )}
                {report.outOfScopeSummary && (
                  <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>
                    <strong style={{ color:"#1E293B" }}>Out of scope. </strong>{report.outOfScopeSummary}
                  </p>
                )}
              </ReportSection>
            )}
            {report.approach && (
              <ReportSection title="Approach">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.approach}</p>
              </ReportSection>
            )}
            {Array.isArray(report.keyDeliverables) && report.keyDeliverables.length > 0 && (
              <ReportSection title="Key Deliverables">
                <table style={{ width:"100%", minWidth:460, borderCollapse:"collapse", fontSize:12.5 }}>
                  <thead>
                    <tr style={{ background:"#F1F5F9" }}>
                      {["Deliverable","Owner","Due"].map(h => (
                        <th key={h} style={{ textAlign:"left", padding:"7px 10px", fontWeight:700,
                          color:"#1E293B", borderBottom:"1px solid #E2E8F0" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.keyDeliverables.map((d:any,i:number) => (
                      <tr key={i} style={{ borderBottom:"1px solid #F1F5F9" }}>
                        <td style={{ padding:"7px 10px", color:"#374151" }}>{d.deliverable}</td>
                        <td style={{ padding:"7px 10px", color:"#64748B" }}>{d.owner || "—"}</td>
                        <td style={{ padding:"7px 10px", color:"#64748B", fontFamily:"monospace" }}>{d.dueDate || "TBD"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ReportSection>
            )}
            {report.governanceSummary && (
              <ReportSection title="Governance">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.governanceSummary}</p>
              </ReportSection>
            )}
            {report.budgetStatus && (
              <ReportSection title="Budget Status">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.budgetStatus}</p>
              </ReportSection>
            )}
            {report.scheduleStatus && (
              <ReportSection title="Schedule Status">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.scheduleStatus}</p>
              </ReportSection>
            )}
            {report.risksAndIssues && (
              <ReportSection title="Risks & Issues">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.risksAndIssues}</p>
              </ReportSection>
            )}
            {report.stakeholderSummary && (
              <ReportSection title="Stakeholders">
                <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.stakeholderSummary}</p>
              </ReportSection>
            )}
            {Array.isArray(report.openQuestions) && report.openQuestions.length > 0 && (
              <ReportSection title="Open Questions">
                {report.openQuestions.map((q:string,i:number) => <ReportBullet key={i} text={q} />)}
              </ReportSection>
            )}
            {Array.isArray(report.sourceDocuments) && report.sourceDocuments.length > 0 && (
              <ReportSection title="Sources">
                <p style={{ fontSize:12, lineHeight:1.7, color:"#64748B", margin:0 }}>
                  Built from: {report.sourceDocuments.join(" · ")}
                </p>
              </ReportSection>
            )}
          </>
        )}

        {/* STATUS */}
        {reportType==="STATUS" && (
          <>
            <ReportSection title={"Executive Summary"}>
              <p style={{ fontSize:13, lineHeight:1.7, color:"#374151", margin:0 }}>{report.executiveSummary}</p>
            </ReportSection>
            {report.keyMetrics && (
              <ReportSection title="Key Metrics">
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <ReportMetric label="CPI" value={report.keyMetrics.cpi} color={Number(report.keyMetrics.cpi)<1?"#DC2626":"#059669"} />
                  <ReportMetric label="SPI" value={report.keyMetrics.spi} color={Number(report.keyMetrics.spi)<1?"#D97706":"#059669"} />
                  <ReportMetric label="Tasks Complete" value={report.keyMetrics.tasksComplete||"—"} />
                  <ReportMetric label="Overdue Tasks" value={report.keyMetrics.overdueTasks||"0"} color={Number(report.keyMetrics.overdueTasks)>0?"#DC2626":"#059669"} />
                </div>
              </ReportSection>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:20 }}>
              <ReportSection title="Accomplishments This Period">
                {(report.accomplishmentsThisWeek||[]).map((a:string,i:number)=><ReportBullet key={i} text={a}/>)}
              </ReportSection>
              <ReportSection title="Planned Next Period">
                {(report.plannedNextWeek||[]).map((a:string,i:number)=><ReportBullet key={i} text={a}/>)}
              </ReportSection>
            </div>
            <ReportSection title="Budget Status"><p style={{ fontSize:13, color:"#374151", lineHeight:1.6, margin:0 }}>{report.budgetStatus}</p></ReportSection>
            <ReportSection title="Schedule Status"><p style={{ fontSize:13, color:"#374151", lineHeight:1.6, margin:0 }}>{report.scheduleStatus}</p></ReportSection>
            <ReportSection title="Risks & Issues"><p style={{ fontSize:13, color:"#374151", lineHeight:1.6, margin:0 }}>{report.risksAndIssues}</p></ReportSection>
            {(report.decisionsNeeded||[]).length>0 && (
              <ReportSection title="Decisions Required">
                <div style={{ background:"#FEF2F2", borderRadius:6, padding:"10px 14px" }}>
                  {report.decisionsNeeded.map((d:string,i:number)=><ReportBullet key={i} text={d}/>)}
                </div>
              </ReportSection>
            )}
          </>
        )}

        {/* EXECUTIVE */}
        {reportType==="EXECUTIVE" && (
          <>
            <ReportSection title={"Executive Summary"}>
              <p style={{ fontSize:14, lineHeight:1.8, color:"#1E293B", margin:0, fontWeight:500 }}>{report.executiveSummary}</p>
            </ReportSection>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:20 }}>
              <ReportSection title="Strategic Highlights">
                {(report.strategicHighlights||[]).map((h:string,i:number)=><ReportBullet key={i} text={h}/>)}
              </ReportSection>
              <ReportSection title="Critical Issues">
                {(report.criticalIssues||[]).length>0
                  ? report.criticalIssues.map((h:string,i:number)=>(
                      <div key={i} style={{ display:"flex",gap:8,marginBottom:5 }}>
                        <span style={{ color:"#DC2626",flexShrink:0 }}>⚠</span>
                        <span style={{ fontSize:13,color:"#374151",lineHeight:1.6 }}>{h}</span>
                      </div>
                    ))
                  : <p style={{ fontSize:13,color:"#059669" }}>No critical issues.</p>
                }
              </ReportSection>
            </div>
            <ReportSection title="Financial Snapshot"><p style={{ fontSize:13,color:"#374151",lineHeight:1.6,margin:0 }}>{report.financialSnapshot}</p></ReportSection>
            {report.nextMilestone && <ReportSection title="Next Key Milestone"><p style={{ fontSize:13,color:accent2,lineHeight:1.6,margin:0,fontWeight:500 }}>◇ {report.nextMilestone}</p></ReportSection>}
            {(report.recommendedActions||[]).length>0 && (
              <ReportSection title="Actions Requested">
                <div style={{ background:"#EFF6FF",borderRadius:6,padding:"10px 14px" }}>
                  {report.recommendedActions.map((a:string,i:number)=><ReportBullet key={i} text={a}/>)}
                </div>
              </ReportSection>
            )}
          </>
        )}

        {/* PHASE GATE */}
        {reportType==="PHASE_GATE" && (
          <>
            <div style={{ display:"flex",gap:12,marginBottom:20,alignItems:"center" }}>
              <div style={{ padding:"10px 20px",borderRadius:8,fontSize:14,fontWeight:700,
                background:report.gateRecommendation==="PROCEED"?"#ECFDF5":"#FEF2F2",
                color:report.gateRecommendation==="PROCEED"?"#059669":"#DC2626",
                border:`2px solid ${report.gateRecommendation==="PROCEED"?"#059669":"#DC2626"}` }}>
                Gate: {(report.gateRecommendation||"").replace("_"," ")}
              </div>
              <div style={{ fontSize:13,color:"#374151" }}>{report.gateRationale}</div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12 }}>
              <ReportSection title="Scope Variance"><p style={{ fontSize:12,color:"#374151",margin:0,lineHeight:1.6 }}>{report.scopeVariance}</p></ReportSection>
              <ReportSection title="Schedule Variance"><p style={{ fontSize:12,color:"#374151",margin:0,lineHeight:1.6 }}>{report.scheduleVariance}</p></ReportSection>
              <ReportSection title="Cost Variance"><p style={{ fontSize:12,color:"#374151",margin:0,lineHeight:1.6 }}>{report.costVariance}</p></ReportSection>
            </div>
            <ReportSection title="Risk Assessment"><p style={{ fontSize:13,color:"#374151",lineHeight:1.6,margin:0 }}>{report.riskAssessment}</p></ReportSection>
          </>
        )}

        {/* EVM */}
        {reportType==="EVM" && (
          <>
            <ReportSection title="EVM Summary"><p style={{ fontSize:13,lineHeight:1.7,color:"#374151",margin:0 }}>{report.evmSummary}</p></ReportSection>
            {report.metrics && (
              <ReportSection title="Key EVM Metrics">
                <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:12 }}>
                  <ReportMetric label="BAC" value={`$${Number(report.metrics.bac||0).toLocaleString("en-US")}`} />
                  <ReportMetric label="EV"  value={`$${Number(report.metrics.ev||0).toLocaleString("en-US")}`} />
                  <ReportMetric label="AC"  value={`$${Number(report.metrics.ac||0).toLocaleString("en-US")}`} />
                  <ReportMetric label="CPI" value={String(report.metrics.cpi||"—")} color={Number(report.metrics.cpi)<1?"#DC2626":"#059669"} />
                  <ReportMetric label="SPI" value={String(report.metrics.spi||"—")} color={Number(report.metrics.spi)<1?"#D97706":"#059669"} />
                  <ReportMetric label="EAC" value={`$${Number(report.metrics.eac||0).toLocaleString("en-US")}`} />
                </div>
              </ReportSection>
            )}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16 }}>
              <ReportSection title="Cost Performance"><p style={{ fontSize:12,color:"#374151",lineHeight:1.6,margin:0 }}>{report.cpiAnalysis}</p></ReportSection>
              <ReportSection title="Schedule Performance"><p style={{ fontSize:12,color:"#374151",lineHeight:1.6,margin:0 }}>{report.spiAnalysis}</p></ReportSection>
            </div>
            <ReportSection title="Forecast"><p style={{ fontSize:13,color:"#374151",lineHeight:1.6,margin:0 }}>{report.forecast}</p></ReportSection>
            {(report.correctiveActions||[]).length>0 && (
              <ReportSection title="Corrective Actions">
                {report.correctiveActions.map((a:string,i:number)=><ReportBullet key={i} text={a}/>)}
              </ReportSection>
            )}
          </>
        )}

        {/* RISK SUMMARY */}
        {reportType==="RISK_SUMMARY" && (
          <>
            <div style={{ display:"flex",gap:12,marginBottom:20,alignItems:"center" }}>
              <div style={{ padding:"8px 16px",borderRadius:8,fontSize:13,fontWeight:700,
                background:{"CRITICAL":"#FEF2F2","HIGH":"#FFFBEB","MEDIUM":"#EFF6FF","LOW":"#ECFDF5"}[report.overallRiskRating as string]||"#F8FAFC",
                color:{"CRITICAL":"#DC2626","HIGH":"#D97706","MEDIUM":accent,"LOW":"#059669"}[report.overallRiskRating as string]||"#64748B" }}>
                Risk: {report.overallRiskRating}
              </div>
              <p style={{ fontSize:13,color:"#374151",margin:0 }}>{report.riskRatingRationale}</p>
            </div>
            <ReportSection title="Risk Overview"><p style={{ fontSize:13,color:"#374151",lineHeight:1.6,margin:0 }}>{report.riskOverview}</p></ReportSection>
            {(report.criticalRisks||[]).length>0 && (
              <ReportSection title="Critical Risks">
                {report.criticalRisks.map((r:any,i:number)=>(
                  <div key={i} style={{ padding:"10px 12px",background:"#FEF2F2",borderRadius:6,
                    marginBottom:8,borderLeft:"3px solid #DC2626" }}>
                    <div style={{ fontSize:12,fontWeight:700,color:"#DC2626",marginBottom:3 }}>
                      [{r.score}] {r.title}
                    </div>
                    {r.recommendation && <div style={{ fontSize:11,color:"#374151" }}>→ {r.recommendation}</div>}
                  </div>
                ))}
              </ReportSection>
            )}
            <ReportSection title="Top Actions">
              {(report.topThreeActions||[]).map((a:string,i:number)=>(
                <div key={i} style={{ display:"flex",gap:8,marginBottom:8 }}>
                  <span style={{ width:20,height:20,borderRadius:"50%",background:accent,
                    color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",
                    justifyContent:"center",flexShrink:0 }}>{i+1}</span>
                  <span style={{ fontSize:13,color:"#374151",lineHeight:1.5 }}>{a}</span>
                </div>
              ))}
            </ReportSection>
          </>
        )}

        {/* Actions */}
        <div style={{ marginTop:20,paddingTop:16,borderTop:"1px solid #E2E8F0",
          display:"flex",gap:10,alignItems:"center",justifyContent:"flex-end" }}>
          <button onClick={onDownload} disabled={downloading}
            style={{ padding:"8px 18px",background:accent,color:"#fff",border:"none",
              borderRadius:6,fontSize:12,fontWeight:500,cursor:downloading?"wait":"pointer",
              fontFamily:"var(--font)",display:"flex",alignItems:"center",gap:6 }}>
            {downloading ? "Generating…" : "📄 Download Word (.docx)"}
          </button>
          <button onClick={onDownloadPdf} disabled={downloadingPdf}
            style={{ padding:"9px 18px", background:"#fff", color:"var(--text-2)",
              border:"1px solid var(--border)", borderRadius:"var(--radius)", fontSize:13,
              fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}>
            {downloadingPdf ? "Generating…" : "📕 PDF"}
          </button>
          {onEmail && (
            <button onClick={onEmail}
              style={{ padding:"9px 18px", background:"#fff", color:"var(--text-2)",
                border:"1px solid var(--border)", borderRadius:"var(--radius)", fontSize:13,
                fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}>
              ✉️ Email report
            </button>
          )}
          <button onClick={() => {
              document.body.classList.add("fs-printing")
              const done = () => {
                document.body.classList.remove("fs-printing")
                window.removeEventListener("afterprint", done)
              }
              window.addEventListener("afterprint", done)
              window.print()
              setTimeout(done, 4000)   // some browsers never fire afterprint
            }}
            style={{ padding:"8px 16px",background:"#fff",border:"1px solid #E2E8F0",
              borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:"var(--font)" }}>
            🖨 Print
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function ProjectReportsTab({ project, projectId, workspaceName, workspaceLogo, accent = "#1B6CA8", accent2 = "#F59E0B", statusUpdates, members, reportTemplates=[] }: {
  project:any; projectId:string; workspaceName:string; workspaceLogo?:string; accent?:string; accent2?:string;
  statusUpdates:any[]; members:any[]; reportTemplates?:any[]
}) {
  const tr = useTranslations("reports")
  const locale = useLocale()
  const router = useRouter()
  const [view, setView]             = useState<"list"|"generate"|"result">("list")
  const [reportType, setReportType] = useState("STATUS")
  const [audience, setAudience]     = useState("TEAM")
  const [notes, setNotes]           = useState("")
  const [templateId, setTemplateId] = useState("")
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState("")
  const [generatedReport, setGeneratedReport] = useState<any>(null)

  // ── Report edit mode ──
  const [editingReport, setEditingReport] = useState(false)
  const [editDraft, setEditDraft] = useState<Record<string, string>>({})
  const [editKinds, setEditKinds] = useState<Record<string, "string" | "lines" | "health">>({})

  function labelFor(key: string) {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).trim()
  }

  function enterEditMode() {
    if (!generatedReport) return
    const draft: Record<string, string> = {}
    const kinds: Record<string, "string" | "lines" | "health"> = {}
    for (const [k, v] of Object.entries(generatedReport)) {
      if (k === "keyMetrics") continue // computed — not editable
      if (k === "overallHealth" && typeof v === "string") { draft[k] = v; kinds[k] = "health"; continue }
      if (typeof v === "string") { draft[k] = v; kinds[k] = "string"; continue }
      if (Array.isArray(v) && v.every(x => typeof x === "string")) {
        draft[k] = (v as string[]).join("\n"); kinds[k] = "lines"; continue
      }
      // objects / other shapes stay untouched
    }
    setEditDraft(draft); setEditKinds(kinds); setEditingReport(true)
  }

  function saveReportEdits() {
    const next = { ...generatedReport }
    for (const [k, kind] of Object.entries(editKinds)) {
      if (kind === "lines") next[k] = (editDraft[k] || "").split("\n").map(s => s.trim()).filter(Boolean)
      else next[k] = editDraft[k] ?? next[k]
    }
    setGeneratedReport(next)
    setEditingReport(false)
  }

  // ── Save generated report to History ──
  const [savingToHistory, setSavingToHistory] = useState(false)
  const [savedToHistory, setSavedToHistory]   = useState(false)
  const [historyError, setHistoryError]       = useState("")

  async function saveReportToHistory() {
    if (!generatedReport || savingToHistory || savedToHistory) return
    setSavingToHistory(true); setHistoryError("")
    try {
      const r = generatedReport
      const typeMap: Record<string,string> = {
        STATUS: "WEEKLY_STATUS", EXECUTIVE: "EXECUTIVE_BRIEF",
        GATE: "MILESTONE", EVM: "WEEKLY_STATUS", RISK: "WEEKLY_STATUS",
      }
      const healthMap: Record<string,string> = { GREEN:"GREEN", YELLOW:"AMBER", RED:"RED", ON_HOLD:"AMBER" }
      const lines = (v: any) => Array.isArray(v) ? v.join("\n") : (typeof v === "string" ? v : "")

      // Period: current week for status reports, today for one-off reports
      const now = new Date()
      let start = new Date(now), end = new Date(now)
      if (reportType === "STATUS") {
        start = new Date(reportWeek); end = reportWeekEnd(reportWeek)
      }
      start.setHours(0,0,0,0); end.setHours(23,59,59,0)

      const summaryBase = r.executiveSummary || r.summary || ""
      const summary = reportType !== "STATUS" && r.reportTitle
        ? `${r.reportTitle}\n\n${summaryBase}` : summaryBase

      const res = await fetch(`/api/projects/${projectId}/status-updates`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: typeMap[reportType] || "WEEKLY_STATUS",
          health: healthMap[r.overallHealth] || "GREEN",
          periodStart: start.toISOString(),
          periodEnd:   end.toISOString(),
          summary: (summary || tr("Generated report")).slice(0, 5000),
          accomplishments: lines(r.accomplishmentsThisWeek || r.strategicHighlights).slice(0, 5000) || null,
          nextSteps:       lines(r.plannedNextWeek || r.recommendations).slice(0, 5000) || null,
          risks:           (typeof r.risksAndIssues === "string" ? r.risksAndIssues : lines(r.criticalIssues)).slice(0, 5000) || null,
          issues:          lines(r.decisionsNeeded).slice(0, 5000) || null,
          reportData:      { reportType, audience, report: r },
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setHistoryError(d?.error || `Save failed (${res.status})`)
        return
      }
      setSavedToHistory(true)
      router.refresh()
    } catch { setHistoryError("Connection lost — try again") }
    finally { setSavingToHistory(false) }
  }

  // ── View / download a saved history entry ──
  const [historyDownloadingId, setHistoryDownloadingId] = useState<string | null>(null)

  function reportFromEntry(su: any) {
    if (su.reportData?.report) {
      return { report: su.reportData.report, type: su.reportData.reportType || "STATUS", aud: su.reportData.audience || audience }
    }
    // Older / manual entries: rebuild a status-shaped report from the stored fields
    return {
      type: "STATUS", aud: audience,
      report: {
        reportTitle: `${(su.type || "Status update").replace(/_/g, " ")} — ${fmtDate(su.createdAt)}`,
        executiveSummary: su.summary || "",
        accomplishmentsThisWeek: splitLines(su.accomplishments),
        plannedNextWeek: splitLines(su.nextSteps),
        risksAndIssues: su.risks || "",
        decisionsNeeded: splitLines(su.issues),
        overallHealth: su.health === "AMBER" ? "YELLOW" : (su.health || "GREEN"),
      },
    }
  }

  function viewHistoryEntry(su: any) {
    const { report, type, aud } = reportFromEntry(su)
    setReportType(type); setAudience(aud)
    setGeneratedReport(report)
    setGeneratedAt(su.createdAt)
    setEditingReport(false)
    setSavedToHistory(true) // already in history — disarm the save button
    setHistoryError("")
    setResultOrigin("list")
    setView("result")
  }

  async function downloadHistoryEntry(su: any) {
    setHistoryDownloadingId(su.id)
    try {
      const { report } = reportFromEntry(su)
      const res = await fetch(`/api/projects/${projectId}/export-docx`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docType: "STATUS_REPORT", reportData: toDocxShape(report) }),
      })
      if (!res.ok) { alert(tr("Download failed")); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${project?.code}_Report_${new Date(su.createdAt).toISOString().split("T")[0]}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setHistoryDownloadingId(null) }
  }
  const [generatedAt, setGeneratedAt]         = useState("")
  const [resultOrigin, setResultOrigin]       = useState<"generate"|"list">("generate")

  // ── Weekly report scoping ──
  const rWeekStartOf = (d: Date) => {
    const dt = new Date(d); const day = dt.getDay()
    dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1)); dt.setHours(0,0,0,0)
    return dt
  }
  const rWeekOptions = (() => {
    const base = rWeekStartOf(new Date()); const opts: Date[] = []
    for (let i = 0; i < 12; i++) { const d = new Date(base); d.setDate(base.getDate() - i * 7); opts.push(d) }
    return opts
  })()
  const rWeekLabel = (st: Date) => {
    const isThis = st.getTime() === rWeekStartOf(new Date()).getTime()
    const end = new Date(st); end.setDate(st.getDate() + 6)
    const f = (d: Date) => d.toLocaleDateString("en-US", { month:"short", day:"numeric", timeZone:"UTC" })
    return `${isThis ? tr("This week — ") : ""}${f(st)} – ${f(end)}, ${end.getFullYear()}`
  }
  const [reportWeek, setReportWeek]       = useState(() => rWeekStartOf(new Date()).toISOString())
  const [includeWeekDocs, setIncludeWeekDocs] = useState(true)
  // Explicit document selection — when the PM picks documents, those (and only
  // those) inform the report, regardless of the reporting week.
  const [pickDocs, setPickDocs] = useState(false)
  const [pickedDocIds, setPickedDocIds] = useState<Set<string>>(new Set())
  const [m365Open, setM365Open] = useState(false)
  // Microsoft 365 activity as report evidence — read the Smart Inbox, pick what
  // actually informs this report. No logging step required.
  const [useM365, setUseM365] = useState(false)
  const [m365Items, setM365Items] = useState<any[]|null>(null)
  const [m365Loading, setM365Loading] = useState(false)
  const [m365Err, setM365Err] = useState("")
  const [pickedM365, setPickedM365] = useState<Set<string>>(new Set())

  async function loadM365() {
    setM365Loading(true); setM365Err("")
    try {
      const r = await fetch("/api/m365/sync")
      const d = await r.json().catch(() => null)
      if (!r.ok) { setM365Err(d?.error || "Microsoft 365 isn't connected — connect it in Settings → Integrations."); setM365Items([]); return }
      const p = d?.data || d || {}
      if (p.connectionError) { setM365Err("Microsoft 365 needs to be reconnected (Settings → Integrations)."); setM365Items([]); return }
      const rows = [
        ...(p.emails   || []).map((e:any) => ({ key:`e:${e.emailId}`,   kind:"email",
          subject:e.subject, from:e.from, date:e.receivedAt, snippet:e.snippet,
          projectCode:e.projectCode, tag:e.detectedType })),
        ...(p.meetings || []).map((m:any,i:number) => ({ key:`m:${m.meetingId||m.id||i}`, kind:"meeting",
          subject:m.subject, from:m.organizer || "", date:m.start || m.startsAt, snippet:m.snippet || m.bodyPreview || "",
          projectCode:m.projectCode, tag:"MEETING" })),
        ...(p.chats    || []).map((c:any,i:number) => ({ key:`c:${c.messageId||i}`, kind:"chat",
          subject:c.subject || c.preview?.slice(0,80) || "Teams mention", from:c.from || "",
          date:c.createdAt, snippet:c.preview || "", projectCode:c.projectCode, tag:"MENTION" })),
      ]
      // Prefer items matched to this project; if none matched, show everything
      // so the PM can still choose (matching depends on subject conventions).
      const mine = rows.filter(r2 => !r2.projectCode || r2.projectCode === project?.code)
      setM365Items(mine.length ? mine : rows)
    } catch { setM365Err("Couldn't reach Microsoft 365.") ; setM365Items([]) }
    finally { setM365Loading(false) }
  }
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [projDocs, setProjDocs] = useState<any[]|null>(null)
  useEffect(() => {
    let live = true
    fetch(`/api/projects/${projectId}/documents`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => { if (live) setProjDocs(d?.data || []) })
      .catch(() => { if (live) setProjDocs([]) })
    return () => { live = false }
  }, [projectId])
  const reportWeekEnd = (startIso: string) => {
    const st = new Date(startIso); const en = new Date(st)
    en.setDate(st.getDate() + 6); en.setHours(23,59,59,0)
    return en
  }
  const [downloading, setDownloading]         = useState(false)
  const [showStatusForm, setShowStatusForm]   = useState(false)
  const [savingStatus, setSavingStatus]       = useState(false)
  const [statusForm, setStatusForm] = useState({
    health:"GREEN", percentComplete:project?.percentComplete||0,
    summary:"", periodStart:new Date().toISOString().split("T")[0],
    periodEnd:  new Date().toISOString().split("T")[0],
  })

  const selectedType = REPORT_TYPES.find(r => r.value===reportType)

  const SECTION_LABELS:Record<string,string> = {
    text:"Executive summary", kpi:"Key metrics", tasks:"Task status", risks:"Risk register",
    gantt:"Schedule / Gantt", budget:"Budget & EVM", milestones:"Milestones", health:"Health summary", chart:"Charts",
  }
  function applyTemplate(id:string) {
    setTemplateId(id)
    const t = reportTemplates.find((x:any)=>x.id===id)
    if(!t){ setNotes(""); return }
    // Map the template's audience onto the generator's audience enum.
    const audMap:Record<string,string> = { TEAM:"TEAM", EXECUTIVE:"STEERING_COMMITTEE", SPONSOR:"SPONSOR", CLIENT:"TEAM" }
    setAudience(audMap[t.audience] || "TEAM")
    setReportType(t.audience==="EXECUTIVE"||t.audience==="SPONSOR" ? "EXECUTIVE" : "STATUS")
    const secs:string[] = Array.isArray(t.sections) ? t.sections : []
    const labels = secs.map(s=>SECTION_LABELS[s]||s).join(", ")
    setNotes(`Follow the "${t.name}" report template. Structure the report around these sections: ${labels}.`)
  }

  async function generateReport() {
    setGenerating(true); setGenError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-report`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          reportType, audience, additionalNotes: notes || undefined,
          // The project's documentation language wins over the reader's UI
          // language: a project documented in Spanish for a Spanish-speaking
          // sponsor must not switch to English because an English-speaking PM
          // happened to generate the report.
          locale: (project?.docLocale === "es" || project?.docLocale === "en")
            ? project.docLocale
            : (locale === "es" ? "es" : "en"),
          ...(reportType === "STATUS" ? {
            periodStart: new Date(reportWeek).toISOString(),
            periodEnd: reportWeekEnd(reportWeek).toISOString(),
            includeWeekDocs,
            documentIds: pickDocs && pickedDocIds.size ? [...pickedDocIds] : undefined,
            m365Items: useM365 && pickedM365.size
              ? (m365Items || []).filter((i:any) => pickedM365.has(i.key)).slice(0, 12).map((i:any) => ({
                  kind: i.kind, subject: String(i.subject || "").slice(0, 300),
                  from: i.from ? String(i.from).slice(0, 200) : undefined,
                  date: i.date ? new Date(i.date).toLocaleDateString("en-US") : undefined,
                  snippet: i.snippet ? String(i.snippet).slice(0, 1200) : undefined,
                }))
              : undefined,
          } : {}),
        }),
      })
      const d = await res.json()
      if (!res.ok || !d.success) { setGenError(d.error||"Generation failed"); return }
      setGeneratedReport(coerceReport(d.report)); setSavedToHistory(false); setHistoryError(""); setResultOrigin("generate")
      setGeneratedAt(d.generatedAt)
      setView("result")
    } catch { setGenError("Network error") }
    finally { setGenerating(false) }
  }

  // Map any report type into the fields the Word status-report layout renders
  function toDocxShape(r: any) {
    if (!r) return r
    const join = (v: any) => Array.isArray(v) ? v : (typeof v === "string" && v ? [v] : [])
    return {
      reportTitle: r.reportTitle || "Report",
      executiveSummary: r.executiveSummary || r.summary || "",
      accomplishmentsThisWeek: join(r.accomplishmentsThisWeek?.length ? r.accomplishmentsThisWeek : r.strategicHighlights),
      plannedNextWeek: join(r.plannedNextWeek?.length ? r.plannedNextWeek : r.recommendations),
      budgetStatus: r.budgetStatus || "",
      scheduleStatus: r.scheduleStatus || "",
      risksAndIssues: typeof r.risksAndIssues === "string" && r.risksAndIssues
        ? r.risksAndIssues : join(r.criticalIssues).join("\n"),
      decisionsNeeded: join(r.decisionsNeeded),
    }
  }
  const splitLines = (s?: string | null) =>
    (s || "").split("\n").map(t => t.trim()).filter(Boolean)

  // ── Email the report (team + external contacts) ──────────────────────────
  const [emailOpen, setEmailOpen]   = useState(false)
  const [emailSel, setEmailSel]     = useState<Set<string>>(new Set())
  const [emailExtra, setEmailExtra] = useState("")
  const [emailNote, setEmailNote]   = useState("")
  const [emailPdf, setEmailPdf]     = useState(true)
  const [emailBusy, setEmailBusy]   = useState(false)

  // Web-report parity: same Performance Snapshot data the PDF embeds.
  const [snapshot, setSnapshot] = useState<import("@/components/charts/ReportSnapshot").ReportSnapshotData | null>(null)
  useEffect(() => {
    let live = true
    fetch(`/api/projects/${projectId}/reports/chart-data`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (live && d?.data) setSnapshot(d.data) })
      .catch(() => {})
    return () => { live = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])
  const [emailMsg, setEmailMsg]     = useState("")

  async function sendReportEmail() {
    if (!generatedReport) return
    const extras = emailExtra.split(/[,;\s]+/).map(x => x.trim()).filter(x => /.+@.+\..+/.test(x))
    const recipients = Array.from(new Set([...emailSel, ...extras]))
    if (!recipients.length) { setEmailMsg("Pick at least one recipient."); return }
    setEmailBusy(true); setEmailMsg("")
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/send`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          reportData: toDocxShape(generatedReport),
          subject: `[${project?.code}] ${generatedReport?.report?.reportTitle || reportType.replace("_"," ").toLowerCase()} — ${new Date().toLocaleDateString()}`,
          recipients, note: emailNote || null, attachPdf: emailPdf,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setEmailMsg(d?.error || "Send failed."); return }
      const ok = d?.data?.sent?.length || 0, bad = d?.data?.failed?.length || 0
      setEmailMsg(`Sent to ${ok} recipient${ok===1?"":"s"}${bad ? ` — ${bad} failed` : ""}.`)
      if (!bad) setTimeout(() => setEmailOpen(false), 1200)
    } finally { setEmailBusy(false) }
  }

  async function downloadPdf() {
    if (!generatedReport) return
    setDownloadingPdf(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/export-pdf`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ reportData: toDocxShape(generatedReport) }),
      })
      if (!res.ok) { alert("PDF download failed"); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = `${project?.code}_${reportType}_${new Date().toISOString().split("T")[0]}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } finally { setDownloadingPdf(false) }
  }

  async function downloadDocx() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/export-docx`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ docType:"STATUS_REPORT", reportData: toDocxShape(generatedReport) }),
      })
      if (!res.ok) { alert(tr("Download failed")); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = `${project?.code}_${reportType}_${new Date().toISOString().split("T")[0]}.docx`; a.click()
      URL.revokeObjectURL(url)
    } finally { setDownloading(false) }
  }

  async function saveStatusUpdate() {
    if (!statusForm.summary.trim()) return
    setSavingStatus(true)
    try {
      await fetch(`/api/projects/${projectId}/status-updates`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...statusForm, type:"WEEKLY_STATUS" }),
      })
      setShowStatusForm(false); router.refresh()
    } finally { setSavingStatus(false) }
  }

  const inp: React.CSSProperties = {
    width:"100%", padding:"8px 12px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    color:"var(--text)", outline:"none",
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {m365Open && (
        <M365ImportModal projectId={projectId}
          onClose={() => setM365Open(false)}
          onImported={docs => {
            // Newly imported documents land selected — that's why they were fetched.
            setProjDocs(p => [...docs, ...(p || [])])
            setPickedDocIds(p => new Set([...p, ...docs.map((d:any) => d.id)]))
            setM365Open(false)
          }} />
      )}
      {/* Toolbar */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"8px 14px", display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
        <button onClick={()=>setView("list")}
          style={{ padding:"6px 14px", borderRadius:"var(--radius)", fontSize:12,
            fontFamily:"var(--font)", cursor:"pointer", border:"1px solid var(--border)",
            background:view==="list"?"var(--steel)":"#fff",
            color:view==="list"?"#fff":"var(--text-2)" }}>
          📋 History
        </button>
        <button onClick={()=>setView("generate")}
          style={{ padding:"6px 14px", borderRadius:"var(--radius)", fontSize:12,
            fontFamily:"var(--font)", cursor:"pointer", border:"none",
            background:view!=="list"?"var(--steel)":"#059669", color:"#fff", fontWeight:500 }}>
          ✨ AI Generate Report
        </button>
        <button onClick={()=>setShowStatusForm(s=>!s)}
          style={{ padding:"6px 14px", borderRadius:"var(--radius)", fontSize:12,
            fontFamily:"var(--font)", cursor:"pointer",
            border:"1px solid var(--border)", background:"#fff", color:"var(--text-2)" }}>
          + Manual status update
        </button>
        <div style={{ marginLeft:"auto", fontSize:11, color:"var(--text-3)" }}>
          {statusUpdates.length} update{statusUpdates.length!==1?"s":""}
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:16 }}>

        {/* AI GENERATOR */}
        {view==="generate" && (
          <div style={{ maxWidth:720, margin:"0 auto" }}>
            <div style={{ background:"#fff", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", padding:24 }}>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>✨ AI Report Generator</div>
              <div style={{ fontSize:12, color:"var(--text-3)", marginBottom:20 }}>
                Reads live project data and generates a report tailored to your selected audience.
              </div>

              {/* Start from a workspace template */}
              {reportTemplates.length>0 && (
                <div style={{ marginBottom:18, padding:"12px 14px", background:"var(--surface)",
                  border:"1px solid var(--border)", borderRadius:"var(--radius)" }}>
                  <label style={{ display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
                    textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>Start from a template</label>
                  <select value={templateId} onChange={e=>applyTemplate(e.target.value)}
                    style={{ width:"100%", padding:"8px 10px", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)", color:"var(--text)",
                      background:"#fff", cursor:"pointer" }}>
                    <option value="">None — configure manually below</option>
                    {reportTemplates.map((t:any)=>(
                      <option key={t.id} value={t.id}>{t.name} · {t.audience}</option>
                    ))}
                  </select>
                  {templateId && (
                    <div style={{ fontSize:11, color:"var(--text-3)", marginTop:6 }}>
                      Template applied — audience, type, and sections below are pre-filled. Adjust anything, then generate.
                    </div>
                  )}
                </div>
              )}

              {/* Report type */}
              <div style={{ marginBottom:18 }}>
                <label style={{ display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
                  textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>Report type</label>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
                  {REPORT_TYPES.map(rt => (
                    <div key={rt.value} onClick={() => setReportType(rt.value)}
                      style={{ padding:"12px 14px", borderRadius:"var(--radius)", cursor:"pointer",
                        border:`2px solid ${reportType===rt.value?"var(--steel)":"var(--border)"}`,
                        background:reportType===rt.value?"#EFF6FF":"#fff" }}>
                      <div style={{ fontSize:14, marginBottom:4 }}>{rt.icon}</div>
                      <div style={{ fontSize:12, fontWeight:600,
                        color:reportType===rt.value?"var(--steel)":"var(--text)" }}>{rt.label}</div>
                      <div style={{ fontSize:10, color:"var(--text-3)", marginTop:3 }}>{rt.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audience */}
              <div style={{ marginBottom:18 }}>
                <label style={{ display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
                  textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>Audience</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {AUDIENCES.map(a => (
                    <div key={a.value} onClick={() => setAudience(a.value)}
                      style={{ padding:"7px 14px", borderRadius:"var(--radius)", cursor:"pointer",
                        border:`2px solid ${audience===a.value?"var(--steel)":"var(--border)"}`,
                        background:audience===a.value?"#EFF6FF":"#fff",
                        fontSize:12, fontWeight:audience===a.value?600:400,
                        color:audience===a.value?"var(--steel)":"var(--text-2)",
                        display:"flex", alignItems:"center", gap:5 }}>
                      <span>{a.icon}</span> {a.label}
                    </div>
                  ))}
                </div>
              </div>

              {reportType === "STATUS" && (
                <div style={{ marginBottom:18 }}>
                  <label style={{ display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
                    textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>Report week</label>
                  <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                    <select value={reportWeek} onChange={e => setReportWeek(e.target.value)}
                      style={{ padding:"8px 12px", border:"1px solid var(--border)",
                        borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
                        color:"var(--text)", background:"#fff" }}>
                      {rWeekOptions.map(w => (
                        <option key={w.toISOString()} value={w.toISOString()}>{rWeekLabel(w)}</option>
                      ))}
                    </select>
                    <label style={{ display:"flex", alignItems:"center", gap:7, fontSize:12,
                      color:"var(--text-2)", cursor:"pointer" }}>
                      <input type="checkbox" checked={includeWeekDocs}
                        onChange={e => setIncludeWeekDocs(e.target.checked)} />
                      Use this week's documents & logged updates (incl. Microsoft 365) as context
                    
                      {projDocs && (() => {
                        const ws = new Date(reportWeek).getTime()
                        const we = ws + 7*86400000
                        const n = projDocs.filter((d:any) => {
                          const t = new Date(d.weekOf || d.createdAt).getTime()
                          return t >= ws && t < we
                        }).length
                        return (
                          <span style={{ color: n ? "var(--steel)" : "#B45309", fontWeight:600 }}>
                            {" "}· {n} document{n===1?"":"s"} found this week
                          </span>
                        )
                      })()}
                    </label>

                    {/* Explicit document selection + Microsoft 365 import */}
                    <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid var(--border)" }}>
                      <label style={{ display:"flex", alignItems:"center", gap:7, fontSize:12,
                        color:"var(--text-2)", cursor:"pointer" }}>
                        <input type="checkbox" checked={pickDocs}
                          onChange={e => { setPickDocs(e.target.checked); if (!e.target.checked) setPickedDocIds(new Set()) }} />
                        Or choose specific documents to inform this report
                      </label>

                      {pickDocs && (
                        <div style={{ marginTop:8, border:"1px solid var(--border)", borderRadius:8,
                          padding:"10px 12px", background:"var(--surface,#F8FAFC)" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:"var(--text-3)",
                              textTransform:"uppercase", letterSpacing:".05em" }}>
                              Project documents ({pickedDocIds.size} selected)
                            </span>
                            <button type="button" onClick={() => setM365Open(true)}
                              style={{ marginLeft:"auto", fontSize:11.5, fontWeight:600, color:"var(--steel)",
                                background:"#fff", border:"1px solid var(--border)", borderRadius:6,
                                padding:"4px 10px", cursor:"pointer", fontFamily:"var(--font)" }}>
                              Import from 365
                            </button>
                          </div>
                          <div style={{ maxHeight:190, overflowY:"auto" }}>
                            {(!projDocs || projDocs.length === 0) && (
                              <div style={{ fontSize:12, color:"var(--text-3)" }}>
                                No documents yet — upload them in the Docs tab or import from Microsoft 365.
                              </div>
                            )}
                            {(projDocs || []).map((d:any) => (
                              <label key={d.id} style={{ display:"flex", alignItems:"center", gap:8,
                                padding:"4px 0", fontSize:12.5, color:"var(--text)", cursor:"pointer" }}>
                                <input type="checkbox" checked={pickedDocIds.has(d.id)}
                                  onChange={() => setPickedDocIds(p => {
                                    const n = new Set(p); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n })} />
                                <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis",
                                  whiteSpace:"nowrap" }}>📄 {d.name}</span>
                                <span style={{ fontSize:10.5, color:"var(--text-4)", fontFamily:"monospace" }}>
                                  {new Date(d.weekOf || d.createdAt).toLocaleDateString("en-US",
                                    { month:"short", day:"numeric", timeZone:"UTC" })}
                                </span>
                              </label>
                            ))}
                          </div>
                          {pickedDocIds.size > 0 && (
                            <div style={{ fontSize:11, color:"var(--steel)", marginTop:6 }}>
                              These {pickedDocIds.size} document{pickedDocIds.size===1?"":"s"} will be read as
                              evidence instead of the reporting week's set.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Microsoft 365 activity as evidence */}
                    <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid var(--border)" }}>
                      <label style={{ display:"flex", alignItems:"center", gap:7, fontSize:12,
                        color:"var(--text-2)", cursor:"pointer" }}>
                        <input type="checkbox" checked={useM365}
                          onChange={e => {
                            setUseM365(e.target.checked)
                            if (e.target.checked && !m365Items) loadM365()
                            if (!e.target.checked) setPickedM365(new Set())
                          }} />
                        Include Microsoft 365 activity — email, Teams meetings & mentions
                      </label>

                      {useM365 && (
                        <div style={{ marginTop:8, border:"1px solid var(--border)", borderRadius:8,
                          padding:"10px 12px", background:"var(--surface,#F8FAFC)" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:"var(--text-3)",
                              textTransform:"uppercase", letterSpacing:".05em" }}>
                              Detected activity ({pickedM365.size} selected)
                            </span>
                            <button type="button" onClick={loadM365} disabled={m365Loading}
                              style={{ marginLeft:"auto", fontSize:11.5, fontWeight:600, color:"var(--steel)",
                                background:"#fff", border:"1px solid var(--border)", borderRadius:6,
                                padding:"4px 10px", cursor:m365Loading?"wait":"pointer", fontFamily:"var(--font)" }}>
                              {m365Loading ? "Syncing…" : "↻ Sync now"}
                            </button>
                          </div>
                          {m365Err && (
                            <div style={{ fontSize:12, color:"#B45309", lineHeight:1.55 }}>{m365Err}</div>
                          )}
                          {!m365Err && m365Loading && !m365Items && (
                            <div style={{ fontSize:12, color:"var(--text-3)" }}>Reading your inbox and calendar…</div>
                          )}
                          {!m365Err && m365Items && m365Items.length === 0 && (
                            <div style={{ fontSize:12, color:"var(--text-3)" }}>
                              Nothing project-related detected. Detection matches the subject against your
                              project name or code.
                            </div>
                          )}
                          <div style={{ maxHeight:210, overflowY:"auto" }}>
                            {(m365Items || []).map((i:any) => (
                              <label key={i.key} style={{ display:"flex", alignItems:"flex-start", gap:8,
                                padding:"5px 0", borderTop:"1px solid var(--surface-1,#F1F5F9)",
                                fontSize:12.5, cursor:"pointer" }}>
                                <input type="checkbox" checked={pickedM365.has(i.key)} style={{ marginTop:3 }}
                                  onChange={() => setPickedM365(p => {
                                    const n = new Set(p); n.has(i.key) ? n.delete(i.key) : n.add(i.key); return n })} />
                                <span style={{ flex:1, minWidth:0 }}>
                                  <span style={{ display:"flex", alignItems:"center", gap:6 }}>
                                    <span>{i.kind === "email" ? "✉️" : i.kind === "meeting" ? "📅" : "💬"}</span>
                                    <span style={{ fontWeight:600, color:"var(--text)", overflow:"hidden",
                                      textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{i.subject}</span>
                                    <span style={{ marginLeft:"auto", fontSize:10.5, color:"var(--text-4)",
                                      fontFamily:"monospace", flexShrink:0 }}>
                                      {i.date ? new Date(i.date).toLocaleDateString("en-US",{ month:"short", day:"numeric" }) : ""}
                                    </span>
                                  </span>
                                  {(i.from || i.snippet) && (
                                    <span style={{ display:"block", fontSize:11, color:"var(--text-3)",
                                      lineHeight:1.5, marginTop:1 }}>
                                      {i.from ? `${i.from} — ` : ""}{(i.snippet || "").slice(0, 110)}
                                    </span>
                                  )}
                                </span>
                              </label>
                            ))}
                          </div>
                          {pickedM365.size > 0 && (
                            <div style={{ fontSize:11, color:"var(--steel)", marginTop:6 }}>
                              The AI will cite these {pickedM365.size} item{pickedM365.size===1?"":"s"} as
                              first-hand evidence, attributed by sender and date.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom:20 }}>
                <label style={{ display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
                  textTransform:"uppercase", letterSpacing:".05em", marginBottom:5 }}>
                  Additional context (optional)
                </label>
                <textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)}
                  placeholder="Add any specific points to include..."
                  style={{...inp, resize:"vertical", lineHeight:1.6}} />
              </div>

              {genError && (
                <div style={{ background:"#FEF2F2", border:"1px solid #FECACA",
                  borderRadius:"var(--radius)", padding:"10px 14px",
                  fontSize:12, color:"var(--red)", marginBottom:14 }}>✗ {genError}</div>
              )}

              <button onClick={generateReport} disabled={generating}
                style={{ padding:"11px 24px", background:"#059669", color:"#fff",
                  border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:600,
                  cursor:generating?"wait":"pointer", fontFamily:"var(--font)", width:"100%" }}>
                {generating ? "⏳ Analyzing and generating report…" : `✨ Generate ${tr((selectedType?.label||'') as any)}`}
              </button>
            </div>
          </div>
        )}

        {/* GENERATED RESULT */}
        {view==="result" && generatedReport && (
          <div style={{ maxWidth:800, margin:"0 auto" }}>
            <div style={{ display:"flex", gap:10, marginBottom:14 }}>
              <button onClick={()=>{ setEditingReport(false); setView(resultOrigin) }}
                style={{ padding:"6px 12px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>
                ← Back
              </button>
              {!editingReport ? (
                <>
                <button onClick={enterEditMode}
                  style={{ padding:"6px 12px", background:"#fff", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                    fontFamily:"var(--font)", color:"var(--text-2)" }}>
                  ✏️ Edit report
                </button>
                <button onClick={saveReportToHistory} disabled={savingToHistory || savedToHistory}
                  style={{ padding:"6px 12px",
                    background: savedToHistory ? "#ECFDF5" : "var(--steel)",
                    color: savedToHistory ? "#059669" : "#fff",
                    border: savedToHistory ? "1px solid #A7F3D0" : "none",
                    borderRadius:"var(--radius)", fontSize:12, fontWeight:500,
                    cursor: savingToHistory || savedToHistory ? "default" : "pointer",
                    fontFamily:"var(--font)" }}>
                  {savedToHistory ? "✓ Saved to History" : savingToHistory ? "Saving…" : "📌 Save to History"}
                </button>
                {historyError && (
                  <span style={{ alignSelf:"center", fontSize:11, color:"#B91C1C" }}>✗ {historyError}</span>
                )}
                </>
              ) : (
                <>
                  <button onClick={saveReportEdits}
                    style={{ padding:"6px 14px", background:"var(--steel)", color:"#fff",
                      border:"none", borderRadius:"var(--radius)", fontSize:12, fontWeight:500,
                      cursor:"pointer", fontFamily:"var(--font)" }}>
                    💾 Save
                  </button>
                  <button onClick={()=>setEditingReport(false)}
                    style={{ padding:"6px 12px", background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                      fontFamily:"var(--font)", color:"var(--text-2)" }}>
                    Cancel
                  </button>
                </>
              )}
            </div>
            {editingReport ? (
              <div style={{ background:"#fff", border:"1px solid var(--border)",
                borderRadius:8, padding:20, display:"flex", flexDirection:"column", gap:14 }}>
                <div style={{ fontSize:11, color:"var(--text-3)" }}>
                  Edit the report content below. For list sections, put one bullet per line. Save applies your changes to the report and to the Word download.
                </div>
                {Object.keys(editDraft).map(k => (
                  <div key={k}>
                    <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                      letterSpacing:".05em", color:"var(--text-3)", marginBottom:5 }}>
                      {labelFor(k)}{editKinds[k]==="lines" ? " (one per line)" : ""}
                    </div>
                    {editKinds[k]==="health" ? (
                      <select value={editDraft[k]}
                        onChange={e=>setEditDraft(d=>({ ...d, [k]: e.target.value }))}
                        style={{ padding:"8px 12px", border:"1px solid var(--border)",
                          borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)", color:"var(--text)" }}>
                        {["GREEN","YELLOW","RED","ON_HOLD"].map(h=><option key={h} value={h}>{h}</option>)}
                      </select>
                    ) : (
                      <textarea value={editDraft[k]}
                        onChange={e=>setEditDraft(d=>({ ...d, [k]: e.target.value }))}
                        rows={editKinds[k]==="lines" ? 5 : (editDraft[k]||"").length > 200 ? 5 : 2}
                        style={{ width:"100%", padding:"10px 12px", border:"1px solid var(--border)",
                          borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
                          lineHeight:1.6, resize:"vertical", outline:"none", color:"var(--text)" }} />
                    )}
                  </div>
                ))}
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={saveReportEdits}
                    style={{ padding:"8px 18px", background:"var(--steel)", color:"#fff",
                      border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                      cursor:"pointer", fontFamily:"var(--font)" }}>
                    💾 Save changes
                  </button>
                  <button onClick={()=>setEditingReport(false)}
                    style={{ padding:"8px 14px", background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", fontSize:13, cursor:"pointer",
                      fontFamily:"var(--font)", color:"var(--text-2)" }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
            <ReportView accent={accent} accent2={accent2} snapshot={snapshot}
              report={generatedReport}
              reportType={reportType}
              audience={audience}
              generatedAt={generatedAt}
              project={project}
              workspaceName={workspaceName}
              workspaceLogo={workspaceLogo}
              onDownload={downloadDocx}
              downloading={downloading}
              onDownloadPdf={downloadPdf}
              onEmail={() => { setEmailSel(new Set()); setEmailMsg(""); setEmailOpen(true) }}
              downloadingPdf={downloadingPdf}
            />
            )}

            {emailOpen && (
              <div onClick={() => !emailBusy && setEmailOpen(false)}
                style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.45)", zIndex:80,
                  display:"grid", placeItems:"center" }}>
                <div onClick={e => e.stopPropagation()}
                  style={{ width:"min(520px, 92vw)", background:"#fff", borderRadius:12,
                    padding:"20px 22px", boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}>
                  <div style={{ fontSize:15, fontWeight:800, color:"var(--text)", marginBottom:2 }}>
                    ✉️ Email this report
                  </div>
                  <div style={{ fontSize:11.5, color:"var(--text-3)", marginBottom:12 }}>
                    Sends an email summary{emailPdf ? " with the PDF attached" : ""}. Replies go to your address.
                  </div>
                  {(() => {
                    const EXEC = new Set(["SPONSOR","EXECUTIVE_SPONSOR","STEERING_COMMITTEE","STAKEHOLDER","CLIENT"])
                    const PMOG = new Set(["PMO","PMO_DIRECTOR","PROGRAM_MANAGER","PM"])
                    const withEmail = (members||[]).filter((m:any)=>m.user?.email)
                    const groups = [
                      { label:"Executive & governance", list: withEmail.filter((m:any)=>EXEC.has(String(m.role))) },
                      { label:"PMO & management",       list: withEmail.filter((m:any)=>PMOG.has(String(m.role))) },
                      { label:"Team",                   list: withEmail.filter((m:any)=>!EXEC.has(String(m.role)) && !PMOG.has(String(m.role))) },
                    ].filter(g => g.list.length)
                    const roleLabel = (r:string) => r ? r.replace(/_/g," ").toLowerCase()
                      .replace(/\b\w/g, (c:string)=>c.toUpperCase()) : ""
                    return (
                      <div style={{ maxHeight:210, overflowY:"auto", border:"1px solid var(--border)",
                        borderRadius:8, padding:"6px 10px", marginBottom:10 }}>
                        {groups.map(g => {
                          const emails = g.list.map((m:any)=>m.user.email)
                          const allOn = emails.every((e:string)=>emailSel.has(e))
                          return (
                            <div key={g.label} style={{ marginBottom:6 }}>
                              <label style={{ display:"flex", gap:8, alignItems:"center", fontSize:11,
                                fontWeight:700, color:"var(--text-2)", textTransform:"uppercase",
                                letterSpacing:".05em", padding:"4px 0", cursor:"pointer" }}>
                                <input type="checkbox" checked={allOn}
                                  onChange={() => { const n = new Set(emailSel);
                                    allOn ? emails.forEach((e:string)=>n.delete(e)) : emails.forEach((e:string)=>n.add(e));
                                    setEmailSel(n) }} />
                                {g.label}
                              </label>
                              {g.list.map((m:any) => (
                                <label key={m.id} style={{ display:"flex", gap:8, alignItems:"center",
                                  fontSize:12.5, padding:"3px 0 3px 20px", cursor:"pointer" }}>
                                  <input type="checkbox" checked={emailSel.has(m.user.email)}
                                    onChange={() => { const n = new Set(emailSel);
                                      n.has(m.user.email) ? n.delete(m.user.email) : n.add(m.user.email); setEmailSel(n) }} />
                                  <span style={{ color:"var(--text)" }}>{m.user?.name || m.user.email}</span>
                                  <span style={{ color:"var(--text-3)", fontSize:10.5 }}>{roleLabel(String(m.role||""))}</span>
                                  <span style={{ color:"var(--text-3)", fontSize:10.5, marginLeft:"auto" }}>{m.user.email}</span>
                                </label>
                              ))}
                            </div>
                          )
                        })}
                        {!withEmail.length && (
                          <div style={{ fontSize:11.5, color:"var(--text-3)", padding:"4px 0" }}>No team members with emails.</div>
                        )}
                      </div>
                    )
                  })()}
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--text-2)", marginBottom:4 }}>
                    Other recipients <span style={{ fontWeight:400, color:"var(--text-3)" }}>(comma-separated)</span>
                  </div>
                  <input value={emailExtra} onChange={e => setEmailExtra(e.target.value)}
                    placeholder="sponsor@client.com, pmo@client.com"
                    style={{ width:"100%", padding:"8px 10px", border:"1px solid var(--border)",
                      borderRadius:8, fontSize:12.5, marginBottom:10, fontFamily:"var(--font)" }} />
                  <textarea value={emailNote} onChange={e => setEmailNote(e.target.value)}
                    placeholder="Optional note shown at the top of the email…" rows={2}
                    style={{ width:"100%", padding:"8px 10px", border:"1px solid var(--border)",
                      borderRadius:8, fontSize:12.5, marginBottom:8, fontFamily:"var(--font)", resize:"vertical" }} />
                  <label style={{ display:"flex", gap:8, alignItems:"center", fontSize:12.5,
                    color:"var(--text-2)", marginBottom:12, cursor:"pointer" }}>
                    <input type="checkbox" checked={emailPdf} onChange={e => setEmailPdf(e.target.checked)} />
                    Attach PDF
                  </label>
                  {emailMsg && <div style={{ fontSize:12, color: emailMsg.startsWith("Sent") ? "#047857" : "#B91C1C",
                    marginBottom:10 }}>{emailMsg}</div>}
                  <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                    <button onClick={() => setEmailOpen(false)} disabled={emailBusy}
                      style={{ padding:"8px 16px", background:"#fff", border:"1px solid var(--border)",
                        borderRadius:8, fontSize:12.5, cursor:"pointer", fontFamily:"var(--font)" }}>Cancel</button>
                    <button onClick={sendReportEmail} disabled={emailBusy}
                      style={{ padding:"8px 18px", background: emailBusy ? "#94A3B8" : "var(--steel,#1B6CA8)",
                        color:"#fff", border:"none", borderRadius:8, fontSize:12.5, fontWeight:700,
                        cursor:"pointer", fontFamily:"var(--font)" }}>
                      {emailBusy ? "Sending…" : "Send"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* HISTORY */}
        {view==="list" && (
          <>
            {/* Project Brief — routes to the AI report type that carries
                preview, email, print, PDF and Word (the old docx-only export
                had none of those). */}
            <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE",
              borderRadius:"var(--radius)", padding:"12px 16px", marginBottom:14,
              display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:"var(--steel)" }}>📄 Project Brief</div>
                <div style={{ fontSize:11, color:"var(--text-3)", lineHeight:1.5 }}>
                  Onboarding document built from your project data and selected documents —
                  preview it, email it, print it, or export to PDF/Word.
                </div>
              </div>
              <button onClick={() => { setReportType("BRIEF"); setView("generate") }}
                style={{ padding:"7px 14px", background:"var(--steel)", color:"#fff",
                  border:"none", borderRadius:"var(--radius)", fontSize:12, fontWeight:600,
                  cursor:"pointer", fontFamily:"var(--font)", flexShrink:0 }}>
                Generate Brief →
              </button>
            </div>

            {/* Manual status form */}
            {showStatusForm && (
              <div style={{ background:"#fff", border:"1px solid var(--border)",
                borderRadius:"var(--radius)", padding:20, marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>New Status Update</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12, marginBottom:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", display:"block", marginBottom:4 }}>Period start</label>
                    <DateField  style={inp} value={statusForm.periodStart}
                      onChange={e=>setStatusForm(f=>({...f,periodStart:e.target.value}))} />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", display:"block", marginBottom:4 }}>Period end</label>
                    <DateField  style={inp} value={statusForm.periodEnd}
                      onChange={e=>setStatusForm(f=>({...f,periodEnd:e.target.value}))} />
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", display:"block", marginBottom:4 }}>Summary *</label>
                  <textarea rows={3} style={{...inp,resize:"vertical"}} value={statusForm.summary}
                    onChange={e=>setStatusForm(f=>({...f,summary:e.target.value}))}
                    placeholder="Overall project status this period…" />
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={saveStatusUpdate} disabled={savingStatus||!statusForm.summary.trim()}
                    style={{ padding:"8px 18px", background:"var(--steel)", color:"#fff",
                      border:"none", borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                      fontFamily:"var(--font)", opacity:!statusForm.summary.trim()?0.5:1 }}>
                    {savingStatus?"Saving…":"Save update"}
                  </button>
                  <button onClick={()=>setShowStatusForm(false)}
                    style={{ padding:"8px 14px", background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                      fontFamily:"var(--font)", color:"var(--text-2)" }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Status list */}
            {statusUpdates.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px" }}>
                <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
                <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>No reports yet</div>
                <div style={{ fontSize:13, color:"var(--text-3)", maxWidth:400, margin:"0 auto 20px" }}>
                  Use AI Generate Report to create a report from live project data.
                </div>
                <button onClick={()=>setView("generate")}
                  style={{ padding:"10px 20px", background:"#059669", color:"#fff",
                    border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                    cursor:"pointer", fontFamily:"var(--font)" }}>
                  ✨ Generate first report
                </button>
              </div>
            ) : statusUpdates.map(su => (
              <div key={su.id} style={{ background:"#fff", border:"1px solid var(--border)",
                borderRadius:"var(--radius)", padding:"14px 18px", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                  <span style={{ padding:"2px 8px", borderRadius:8, fontSize:10, fontWeight:700,
                    background:(HEALTH_COLOR[su.health]||"#059669")+"15",
                    color:HEALTH_COLOR[su.health]||"#059669" }}>
                    {HEALTH_LABEL[su.health]||su.health}
                  </span>
                  <span style={{ fontSize:11, color:"var(--text-3)" }}>{fmtDate(su.createdAt)}</span>
                  <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
                    <button onClick={()=>viewHistoryEntry(su)}
                      style={{ padding:"4px 10px", background:"#fff", border:"1px solid var(--border)",
                        borderRadius:"var(--radius)", fontSize:11, cursor:"pointer",
                        fontFamily:"var(--font)", color:"var(--text-2)" }}>
                      👁 View
                    </button>
                    <button onClick={()=>downloadHistoryEntry(su)} disabled={historyDownloadingId===su.id}
                      style={{ padding:"4px 10px", background:"#fff", border:"1px solid var(--border)",
                        borderRadius:"var(--radius)", fontSize:11,
                        cursor: historyDownloadingId===su.id ? "wait" : "pointer",
                        fontFamily:"var(--font)", color:"var(--text-2)" }}>
                      {historyDownloadingId===su.id ? "…" : "📄 Word"}
                    </button>
                    <button
                      onClick={async () => {
                        const { report: r } = reportFromEntry(su)
                        if (!r) return
                        const res = await fetch(`/api/projects/${projectId}/export-pdf`, {
                          method:"POST", headers:{"Content-Type":"application/json"},
                          body: JSON.stringify({ reportData: toDocxShape(r) }),
                        })
                        if (!res.ok) { alert("PDF download failed"); return }
                        const blob = await res.blob()
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement("a")
                        a.href = url; a.download = `${project?.code}_Report.pdf`; a.click()
                        URL.revokeObjectURL(url)
                      }}
                      style={{ padding:"5px 10px", background:"#fff", border:"1px solid var(--border)",
                        borderRadius:"var(--radius)", fontSize:11, cursor:"pointer",
                        fontFamily:"var(--font)", color:"var(--text-2)" }}>
                      📕 PDF
                    </button>
                  </div>
                </div>
                {su.summary && (
                  <p style={{ fontSize:13, color:"var(--text-2)", margin:0, lineHeight:1.6 }}>{su.summary}</p>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
