"use client"
// src/components/projects/tabs/ProjectReportsTab.tsx

import { useState } from "react"
import { useRouter } from "next/navigation"

const REPORT_TYPES = [
  { value:"STATUS",       label:"Weekly Status Report",  icon:"📋",
    desc:"Accomplishments, plans, risks, EVM summary." },
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

const HEALTH_COLOR: Record<string,string> = {
  GREEN:"#059669", AMBER:"#D97706", YELLOW:"#D97706", RED:"#DC2626",
}
const HEALTH_LABEL: Record<string,string> = {
  GREEN:"On track", AMBER:"At risk", YELLOW:"At risk", RED:"Off track",
}

function fmtDate(d:any) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})
}

// ── Report section helpers (top-level, not nested) ──────────────────────────

function ReportSection({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#1E293B", textTransform:"uppercase",
        letterSpacing:".06em", marginBottom:8, paddingBottom:4,
        borderBottom:"2px solid #1B6CA8" }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function ReportBullet({ text }: { text:string }) {
  return (
    <div style={{ display:"flex", gap:8, marginBottom:5 }}>
      <span style={{ color:"#1B6CA8", flexShrink:0, marginTop:1 }}>•</span>
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

function ReportView({ report, reportType, audience, generatedAt, project, workspaceName, workspaceLogo, onDownload, downloading }: {
  report:any; reportType:string; audience:string; generatedAt:string;
  project:any; workspaceName:string; workspaceLogo?:string;
  onDownload:()=>void; downloading:boolean
}) {
  const healthColor = HEALTH_COLOR[report.overallHealth] || "#059669"

  return (
    <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:8, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1a3a5c,#1B6CA8)", padding:"20px 24px", color:"#fff" }}>
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
              {project?.name} ({project?.code}) · Generated {new Date(generatedAt).toLocaleString()} ·
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

        {/* STATUS */}
        {reportType==="STATUS" && (
          <>
            <ReportSection title="Executive Summary">
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
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
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
            <ReportSection title="Executive Summary">
              <p style={{ fontSize:14, lineHeight:1.8, color:"#1E293B", margin:0, fontWeight:500 }}>{report.executiveSummary}</p>
            </ReportSection>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
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
            {report.nextMilestone && <ReportSection title="Next Key Milestone"><p style={{ fontSize:13,color:"#1B6CA8",lineHeight:1.6,margin:0,fontWeight:500 }}>◇ {report.nextMilestone}</p></ReportSection>}
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
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12 }}>
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
                  <ReportMetric label="BAC" value={`$${Number(report.metrics.bac||0).toLocaleString()}`} />
                  <ReportMetric label="EV"  value={`$${Number(report.metrics.ev||0).toLocaleString()}`} />
                  <ReportMetric label="AC"  value={`$${Number(report.metrics.ac||0).toLocaleString()}`} />
                  <ReportMetric label="CPI" value={String(report.metrics.cpi||"—")} color={Number(report.metrics.cpi)<1?"#DC2626":"#059669"} />
                  <ReportMetric label="SPI" value={String(report.metrics.spi||"—")} color={Number(report.metrics.spi)<1?"#D97706":"#059669"} />
                  <ReportMetric label="EAC" value={`$${Number(report.metrics.eac||0).toLocaleString()}`} />
                </div>
              </ReportSection>
            )}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
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
                color:{"CRITICAL":"#DC2626","HIGH":"#D97706","MEDIUM":"#1B6CA8","LOW":"#059669"}[report.overallRiskRating as string]||"#64748B" }}>
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
                  <span style={{ width:20,height:20,borderRadius:"50%",background:"#1B6CA8",
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
            style={{ padding:"8px 18px",background:"#1B6CA8",color:"#fff",border:"none",
              borderRadius:6,fontSize:12,fontWeight:500,cursor:downloading?"wait":"pointer",
              fontFamily:"var(--font)",display:"flex",alignItems:"center",gap:6 }}>
            {downloading ? "Generating…" : "📄 Download Word (.docx)"}
          </button>
          <button onClick={() => window.print()}
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

export function ProjectReportsTab({ project, projectId, workspaceName, workspaceLogo, statusUpdates, members, reportTemplates=[] }: {
  project:any; projectId:string; workspaceName:string; workspaceLogo?:string;
  statusUpdates:any[]; members:any[]; reportTemplates?:any[]
}) {
  const router = useRouter()
  const [view, setView]             = useState<"list"|"generate"|"result">("list")
  const [reportType, setReportType] = useState("STATUS")
  const [audience, setAudience]     = useState("TEAM")
  const [notes, setNotes]           = useState("")
  const [templateId, setTemplateId] = useState("")
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState("")
  const [generatedReport, setGeneratedReport] = useState<any>(null)
  const [generatedAt, setGeneratedAt]         = useState("")
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
        body: JSON.stringify({ reportType, audience, additionalNotes:notes||undefined }),
      })
      const d = await res.json()
      if (!res.ok || !d.success) { setGenError(d.error||"Generation failed"); return }
      setGeneratedReport(d.report)
      setGeneratedAt(d.generatedAt)
      setView("result")
    } catch { setGenError("Network error") }
    finally { setGenerating(false) }
  }

  async function downloadDocx() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/export-docx`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ docType:reportType==="STATUS"?"STATUS_REPORT":"PROJECT_BRIEF", reportData:generatedReport }),
      })
      if (!res.ok) { alert("Download failed"); return }
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
                {generating ? "⏳ Analyzing and generating report…" : `✨ Generate ${selectedType?.label}`}
              </button>
            </div>
          </div>
        )}

        {/* GENERATED RESULT */}
        {view==="result" && generatedReport && (
          <div style={{ maxWidth:800, margin:"0 auto" }}>
            <div style={{ display:"flex", gap:10, marginBottom:14 }}>
              <button onClick={()=>setView("generate")}
                style={{ padding:"6px 12px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>
                ← Back
              </button>
            </div>
            <ReportView
              report={generatedReport}
              reportType={reportType}
              audience={audience}
              generatedAt={generatedAt}
              project={project}
              workspaceName={workspaceName}
              workspaceLogo={workspaceLogo}
              onDownload={downloadDocx}
              downloading={downloading}
            />
          </div>
        )}

        {/* HISTORY */}
        {view==="list" && (
          <>
            {/* Project Brief download */}
            <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE",
              borderRadius:"var(--radius)", padding:"12px 16px", marginBottom:14,
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:"var(--steel)" }}>Project Brief (.docx)</div>
                <div style={{ fontSize:11, color:"var(--text-3)" }}>Download the complete Project Brief as a Word document</div>
              </div>
              <button onClick={async () => {
                setDownloading(true)
                try {
                  const res = await fetch(`/api/projects/${projectId}/export-docx`, {
                    method:"POST", headers:{"Content-Type":"application/json"},
                    body: JSON.stringify({ docType:"PROJECT_BRIEF" }),
                  })
                  if (!res.ok) { alert("Download failed"); return }
                  const blob = await res.blob()
                  const url  = URL.createObjectURL(blob)
                  const a    = document.createElement("a")
                  a.href = url; a.download = `${project?.code}_Project_Brief.docx`; a.click()
                  URL.revokeObjectURL(url)
                } finally { setDownloading(false) }
              }} disabled={downloading}
                style={{ padding:"7px 14px", background:"var(--steel)", color:"#fff",
                  border:"none", borderRadius:"var(--radius)", fontSize:12, fontWeight:500,
                  cursor:"pointer", fontFamily:"var(--font)", flexShrink:0 }}>
                📄 Download Brief
              </button>
            </div>

            {/* Manual status form */}
            {showStatusForm && (
              <div style={{ background:"#fff", border:"1px solid var(--border)",
                borderRadius:"var(--radius)", padding:20, marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>New Status Update</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", display:"block", marginBottom:4 }}>Period start</label>
                    <input type="date" style={inp} value={statusForm.periodStart}
                      onChange={e=>setStatusForm(f=>({...f,periodStart:e.target.value}))} />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", display:"block", marginBottom:4 }}>Period end</label>
                    <input type="date" style={inp} value={statusForm.periodEnd}
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
