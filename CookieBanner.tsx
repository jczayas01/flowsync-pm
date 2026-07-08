"use client"
// src/components/projects/tabs/ProjectBudgetTab.tsx
import { Badge } from "@/components/ui"

function fmt(n: number, currency = "USD") {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`
  return new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:0}).format(n)
}

export function ProjectBudgetTab({ projectId, project, budgetItems, timeEntries }: {
  projectId:string; project:any; budgetItems:any[]; timeEntries:any[]
}) {
  const budgetTotal = Number(project?.budgetTotal || 0)
  const budgetSpent = Number(project?.budgetSpent || 0)
  const pct = budgetTotal > 0 ? Math.round(budgetSpent/budgetTotal*100) : 0

  // EVM calculations
  const ev   = budgetTotal * ((project?.percentComplete || 0) / 100)
  const cpi  = budgetSpent > 0 ? ev / budgetSpent : 1
  const eac  = cpi > 0 ? budgetTotal / cpi : budgetTotal
  const vac  = budgetTotal - eac

  const currency = project?.currency || "USD"

  const card: React.CSSProperties = {
    background:"#fff", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", padding:"14px 16px"
  }

  return (
    <div style={{ padding:16, overflowY:"auto" }}>
      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:16 }}>
        {[
          { label:"Total budget (BAC)", value:fmt(budgetTotal,currency), sub:"", color:"var(--text)" },
          { label:"Actual cost (AC)",   value:fmt(budgetSpent,currency), sub:`${pct}% spent`,
            color:pct>90?"var(--red)":pct>75?"var(--amber)":"var(--text)" },
          { label:"Earned value (EV)",  value:fmt(ev,currency), sub:"", color:"var(--text)" },
          { label:"CPI", value:cpi.toFixed(2),
            sub:cpi>=1?"Under budget":"Over budget",
            color:cpi>=1?"var(--green)":"var(--red)" },
          { label:"EAC forecast", value:fmt(eac,currency),
            sub:vac>=0?`$${fmt(Math.abs(vac))} under`:`$${fmt(Math.abs(vac))} over`,
            color:vac>=0?"var(--green)":"var(--red)" },
        ].map(kpi => (
          <div key={kpi.label} style={card}>
            <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:6,
              textTransform:"uppercase", letterSpacing:".05em", fontWeight:500 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize:20, fontWeight:700, color:kpi.color, lineHeight:1 }}>
              {kpi.value}
            </div>
            {kpi.sub && (
              <div style={{ fontSize:11, color:kpi.color, marginTop:4, opacity:.8 }}>{kpi.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* Spend bar */}
      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:8 }}>
          <span style={{ fontWeight:500, color:"var(--text)" }}>Budget utilization</span>
          <span style={{ color:pct>90?"var(--red)":pct>75?"var(--amber)":"var(--text-3)" }}>
            {fmt(budgetSpent,currency)} of {fmt(budgetTotal,currency)} ({pct}%)
          </span>
        </div>
        <div style={{ height:10, background:"var(--border)", borderRadius:5, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${Math.min(pct,100)}%`,
            background:pct>90?"var(--red)":pct>75?"var(--amber)":"var(--steel)",
            borderRadius:5, transition:"width .5s" }} />
        </div>
        {pct > 100 && (
          <div style={{ fontSize:11, color:"var(--red)", marginTop:6, fontWeight:500 }}>
            ⚠ Budget exceeded by {fmt(budgetSpent-budgetTotal,currency)}
          </div>
        )}
      </div>

      {/* Budget items table */}
      <div style={{ ...card, marginBottom:16, overflow:"hidden", padding:0 }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>
            Budget line items ({budgetItems.length})
          </span>
          <button
            style={{ padding:"6px 12px", background:"var(--steel)", color:"#fff", border:"none",
              borderRadius:"var(--radius)", fontSize:11, fontWeight:500, cursor:"pointer",
              fontFamily:"var(--font)" }}>
            + Add item
          </button>
        </div>
        {budgetItems.length === 0 ? (
          <div style={{ padding:"24px 16px", textAlign:"center", fontSize:13, color:"var(--text-3)" }}>
            No budget line items yet
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"var(--surface)" }}>
                {["Description","Category","Planned","Actual","Variance",""].map(h => (
                  <th key={h} style={{ padding:"8px 14px", textAlign:"left", fontSize:10,
                    fontWeight:600, color:"var(--text-3)", letterSpacing:".05em",
                    textTransform:"uppercase", borderBottom:"1px solid var(--border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {budgetItems.map(item => {
                const planned  = Number(item.plannedAmount||0)
                const actual   = Number(item.actualAmount||0)
                const variance = planned - actual
                return (
                  <tr key={item.id} style={{ borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}>
                    <td style={{ padding:"10px 14px", fontSize:13, color:"var(--text)", fontWeight:500 }}>
                      {item.description}
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <Badge variant="gray">{item.category || "—"}</Badge>
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:13, color:"var(--text-2)", fontFamily:"monospace" }}>
                      {fmt(planned,currency)}
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:13, color:"var(--text-2)", fontFamily:"monospace" }}>
                      {fmt(actual,currency)}
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:13, fontFamily:"monospace",
                      color:variance>=0?"var(--green)":"var(--red)", fontWeight:500 }}>
                      {variance>=0?"+":""}{fmt(variance,currency)}
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <button style={{ fontSize:11, color:"var(--steel)", background:"none",
                        border:"none", cursor:"pointer", fontFamily:"var(--font)" }}>Edit</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Time entries */}
      {timeEntries.length > 0 && (
        <div style={{ ...card, overflow:"hidden", padding:0 }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)",
            fontSize:13, fontWeight:600, color:"var(--text)" }}>
            Billable time entries ({timeEntries.length})
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"var(--surface)" }}>
                {["Date","Person","Hours","Rate","Amount",""].map(h => (
                  <th key={h} style={{ padding:"7px 14px", textAlign:"left", fontSize:10,
                    fontWeight:600, color:"var(--text-3)", letterSpacing:".05em",
                    textTransform:"uppercase", borderBottom:"1px solid var(--border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeEntries.slice(0,10).map(te => (
                <tr key={te.id} style={{ borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}>
                  <td style={{ padding:"8px 14px", fontSize:12, color:"var(--text-3)" }}>
                    {new Date(te.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                  </td>
                  <td style={{ padding:"8px 14px", fontSize:12, color:"var(--text-2)" }}>
                    {te.user?.name || "—"}
                  </td>
                  <td style={{ padding:"8px 14px", fontSize:12, fontFamily:"monospace" }}>
                    {Number(te.hours).toFixed(1)}h
                  </td>
                  <td style={{ padding:"8px 14px", fontSize:12, fontFamily:"monospace", color:"var(--text-3)" }}>
                    {te.hourlyRate ? `$${Number(te.hourlyRate).toFixed(0)}/hr` : "—"}
                  </td>
                  <td style={{ padding:"8px 14px", fontSize:12, fontFamily:"monospace", fontWeight:500 }}>
                    {te.amount ? fmt(Number(te.amount),currency) : "—"}
                  </td>
                  <td style={{ padding:"8px 14px" }}>
                    <Badge variant="green">Billable</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
