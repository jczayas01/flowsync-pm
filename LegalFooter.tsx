"use client"
// src/components/projects/tabs/ProjectReportsTab.tsx
import { useState } from "react"
import { Badge, EmptyState, Avatar } from "@/components/ui"

export function ProjectReportsTab({ projectId, reports }: {
  projectId:string; reports:any[]
}) {
  const [generating, setGenerating] = useState(false)
  const [selected,   setSelected]   = useState<string|null>(
    reports.length > 0 ? reports[0].id : null
  )

  async function generateReport() {
    setGenerating(true)
    try {
      await fetch(`/api/projects/${projectId}/ai`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"generate_status_report" })
      })
    } finally { setGenerating(false) }
  }

  const selectedReport = reports.find(r => r.id === selected)
  const HEALTH_COLORS: Record<string,string> = {
    GREEN:"var(--green)", AMBER:"var(--amber)", RED:"var(--red)"
  }

  return (
    <div style={{ display:"flex", height:"100%" }}>
      {/* Sidebar list */}
      <div style={{ width:240, borderRight:"1px solid var(--border)",
        display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:12, fontWeight:600, color:"var(--text)" }}>Status reports</span>
          <button onClick={generateReport} disabled={generating}
            style={{ fontSize:11, fontWeight:500, padding:"4px 9px",
              background:generating?"var(--surface)":"var(--steel)", color:generating?"var(--text-3)":"#fff",
              border:"none", borderRadius:5, cursor:generating?"wait":"pointer",
              fontFamily:"var(--font)", whiteSpace:"nowrap" }}>
            {generating ? "Generating…" : "⚡ AI generate"}
          </button>
        </div>
        <div style={{ flex:1, overflowY:"auto" }}>
          {reports.length === 0 ? (
            <div style={{ padding:"24px 14px", textAlign:"center" }}>
              <div style={{ fontSize:24, marginBottom:8 }}>📝</div>
              <div style={{ fontSize:12, color:"var(--text-3)", lineHeight:1.5 }}>
                No reports yet. Generate your first AI status report.
              </div>
            </div>
          ) : reports.map(r => (
            <div key={r.id} onClick={() => setSelected(r.id)}
              style={{ padding:"10px 14px", borderBottom:"1px solid var(--surface-1,#F1F5F9)",
                cursor:"pointer", transition:"background .1s",
                background:selected===r.id?"var(--steel-pale,#EFF6FF)":"transparent",
                borderLeft:selected===r.id?"3px solid var(--steel)":"3px solid transparent" }}>
              <div style={{ fontSize:12, fontWeight:500, color:"var(--text)", marginBottom:3 }}>
                {r.type?.replace("_"," ") || "Status Report"}
              </div>
              <div style={{ fontSize:11, color:"var(--text-3)" }}>
                {new Date(r.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
              </div>
              {r.health && (
                <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%",
                    background:HEALTH_COLORS[r.health]||"var(--text-3)" }}/>
                  <span style={{ fontSize:10, color:HEALTH_COLORS[r.health]||"var(--text-3)", fontWeight:500 }}>
                    {r.health==="GREEN"?"On track":r.health==="AMBER"?"At risk":"Off track"}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Report body */}
      <div style={{ flex:1, overflowY:"auto", padding:20 }}>
        {!selectedReport ? (
          <EmptyState icon="📊" title="Select a report"
            description="Choose a report from the list or generate a new AI status report." />
        ) : (
          <div style={{ maxWidth:700 }}>
            {/* Header */}
            <div style={{ marginBottom:24, paddingBottom:20,
              borderBottom:"1px solid var(--border)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <h2 style={{ fontSize:18, fontWeight:600, color:"var(--text)", flex:1 }}>
                  {selectedReport.type?.replace("_"," ") || "Status Report"}
                </h2>
                <button style={{ padding:"6px 12px", background:"var(--steel)", color:"#fff",
                  border:"none", borderRadius:"var(--radius)", fontSize:11, fontWeight:500,
                  cursor:"pointer", fontFamily:"var(--font)" }}>
                  ⬇ Export PDF
                </button>
              </div>
              <div style={{ display:"flex", gap:14, fontSize:12, color:"var(--text-3)" }}>
                <span>
                  {new Date(selectedReport.createdAt).toLocaleDateString("en-US",
                    { dateStyle:"long" })}
                </span>
                {selectedReport.createdBy && (
                  <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <Avatar name={selectedReport.createdBy.name}
                      avatarUrl={selectedReport.createdBy.avatarUrl} size={16} />
                    {selectedReport.createdBy.name}
                  </span>
                )}
                {selectedReport.aiGenerated && (
                  <span style={{ display:"flex", alignItems:"center", gap:4,
                    color:"var(--steel)", fontWeight:500 }}>
                    ⚡ AI generated
                  </span>
                )}
              </div>
            </div>

            {/* Summary */}
            {selectedReport.summary && (
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
                borderRadius:"var(--radius)", padding:16, marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--text-3)",
                  letterSpacing:".06em", textTransform:"uppercase", marginBottom:8 }}>
                  Executive summary
                </div>
                <p style={{ fontSize:14, color:"var(--text-2)", lineHeight:1.7, margin:0 }}>
                  {selectedReport.summary}
                </p>
              </div>
            )}

            {/* KPIs */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)",
              gap:10, marginBottom:20 }}>
              {[
                { label:"Overall health", value:selectedReport.health==="GREEN"?"On track":
                    selectedReport.health==="AMBER"?"At risk":"Off track",
                  color:HEALTH_COLORS[selectedReport.health]||"var(--text)" },
                { label:"Progress", value:`${selectedReport.percentComplete||0}%`,
                  color:"var(--text)" },
                { label:"Budget", value:selectedReport.budgetActual
                    ? `$${Number(selectedReport.budgetActual).toLocaleString()} spent`
                    : "—",
                  color:"var(--text)" },
              ].map(kpi => (
                <div key={kpi.label} style={{ background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", padding:"12px 14px", textAlign:"center" }}>
                  <div style={{ fontSize:20, fontWeight:700, color:kpi.color, marginBottom:4 }}>
                    {kpi.value}
                  </div>
                  <div style={{ fontSize:11, color:"var(--text-3)" }}>{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Sections */}
            {["accomplishments","issuesAndRisks","nextSteps"].map(field => {
              const val = selectedReport[field]
              if (!val) return null
              const labels: Record<string,string> = {
                accomplishments:"Accomplishments",
                issuesAndRisks:"Issues & Risks",
                nextSteps:"Next Steps"
              }
              return (
                <div key={field} style={{ marginBottom:20 }}>
                  <h3 style={{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:8 }}>
                    {labels[field]}
                  </h3>
                  <div style={{ background:"#fff", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", padding:14 }}>
                    <p style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.7, margin:0 }}>
                      {val}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
