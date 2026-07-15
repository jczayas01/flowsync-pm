"use client"
// src/components/projects/tabs/ProjectBudgetTab.tsx
import { useTranslations } from "next-intl"
import { useState } from "react"
import { usePermissions } from "@/lib/rbac/usePermissions"
import { useRouter } from "next/navigation"
import { DocScanPicker } from "@/components/shared/DocScanPicker"
import { Badge } from "@/components/ui"

function fmt(n: number, currency = "USD") {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`
  return new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:0}).format(n)
}

export function ProjectBudgetTab({ projectId, project, budgetItems, timeEntries, workspaceId }: {
  projectId:string; project:any; budgetItems:any[]; timeEntries:any[]; workspaceId?:string
}) {
  const t = useTranslations("budget")
  const { can } = usePermissions()
  const router = useRouter()

  // ── AI document scan → budget item candidates ──
  const [scanOpen, setScanOpen]       = useState(false)
  const [scanning, setScanning]       = useState(false)
  const [scanError, setScanError]     = useState("")
  const [candidates, setCandidates]   = useState<any[]|null>(null)
  const [scanSkipped, setScanSkipped] = useState<{name:string;reason:string}[]>([])
  const [pickedCands, setPickedCands] = useState<Set<number>>(new Set())
  const [committing, setCommitting]   = useState(false)

  async function runScan(documentIds: string[]) {
    setScanning(true); setScanError(""); setCandidates(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/budget/scan?workspaceId=${workspaceId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) { setScanError(d?.error || `Scan failed (${res.status})`); return }
      const c = d?.data?.candidates || []
      setScanSkipped(d?.data?.skippedDocs || [])
      setCandidates(c)
      setPickedCands(new Set(c.map((_: any, i: number) => i)))
    } catch { setScanError("Connection lost — try again") }
    finally { setScanning(false) }
  }

  async function commitCandidates() {
    if (!candidates || committing) return
    const chosen = candidates.filter((_, i) => pickedCands.has(i))
    if (!chosen.length) return
    setCommitting(true); setScanError("")
    try {
      const CATS = ["LABOR","MATERIALS","EQUIPMENT","SOFTWARE","CONSULTING","TRAVEL","CONTINGENCY","OTHER"]
      const results = await Promise.all(chosen.map(c =>
        fetch(`/api/projects/${projectId}/budget`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: String(c.description || "").slice(0, 200),
            category: CATS.includes(c.category) ? c.category : "OTHER",
            plannedAmount: Math.max(0, Number(c.plannedAmount) || 0),
            actualAmount: 0,
          }),
        })
      ))
      const failed = results.filter(r => !r.ok).length
      if (failed) setScanError(`${failed} item(s) could not be added`)
      setCandidates(null); setScanOpen(false)
      router.refresh()
    } catch { setScanError("Connection lost — try again") }
    finally { setCommitting(false) }
  }
  const [editId,   setEditId]   = useState<string|null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving,   setSaving]   = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [newItem,  setNewItem]  = useState({ description:"", category:"LABOR", plannedAmount:"", notes:"" })

  async function saveEdit(itemId: string) {
    setSaving(true)
    try {
      await fetch(`/api/projects/${projectId}/budget/${itemId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          description:   editForm.description,
          plannedAmount: Number(editForm.plannedAmount)||0,
          actualAmount:  Number(editForm.actualAmount)||0,
          category:      editForm.category,
          notes:         editForm.notes||null,
        }),
      })
      setEditId(null); router.refresh()
    } finally { setSaving(false) }
  }

  async function addItem() {
    if (!newItem.description.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/budget`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          description:   newItem.description,
          category:      newItem.category,
          plannedAmount: Number(newItem.plannedAmount)||0,
          actualAmount:  0,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        alert(d?.error || `Could not add item (${res.status})`)
        return
      }
      setAddingItem(false)
      setNewItem({ description:"", category:"LABOR", plannedAmount:"", notes:"" })
      router.refresh()
    } finally { setSaving(false) }
  }

  async function deleteItem(itemId: string) {
    if (!confirm("Delete this budget item?")) return
    await fetch(`/api/projects/${projectId}/budget/${itemId}`, { method:"DELETE" })
    router.refresh()
  }

  const inpS: React.CSSProperties = {
    padding:"4px 8px", fontSize:12, border:"1px solid var(--border)",
    borderRadius:4, fontFamily:"var(--font)", color:"var(--text)",
    background:"#fff", outline:"none", width:"100%",
  }
  const CATEGORIES = ["LABOR","MATERIALS","EQUIPMENT","SOFTWARE","CONSULTING","TRAVEL","CONTINGENCY","OTHER"]

  const budgetTotal = Number(project?.budgetTotal || 0)
  const budgetSpent = Number(project?.budgetSpent || 0)
  const pct = budgetTotal > 0 ? Math.round(budgetSpent/budgetTotal*100) : 0

  // ── Full PM Standard EVM calculations ──────────────────────────────
  const pctComplete = (project?.percentComplete || 0) / 100

  // Planned % — time-phased from the schedule (start → end vs today).
  // Falls back to actual % when dates are missing, keeping SPI neutral.
  const plannedPct = (() => {
    const st = project?.startDate ? new Date(project.startDate).getTime() : null
    const en = project?.endDate   ? new Date(project.endDate).getTime()   : null
    if (!st || !en || en <= st) return pctComplete
    const now = Date.now()
    return Math.min(1, Math.max(0, (now - st) / (en - st)))
  })()

  const BAC = budgetTotal                       // Budget At Completion
  const AC  = budgetSpent                       // Actual Cost
  const EV  = BAC * pctComplete                 // Earned Value = BAC × actual % complete
  const PV  = BAC * plannedPct                  // Planned Value = BAC × scheduled % to date
  const CV  = EV - AC                           // Cost Variance (+ = under budget)
  const SV  = EV - PV                           // Schedule Variance (simplified)
  const CPI = AC > 0 ? EV / AC : 1             // Cost Performance Index
  const SPI = PV > 0 ? EV / PV : 1             // Schedule Performance Index
  const EAC = CPI > 0 ? BAC / CPI : BAC        // Estimate At Completion
  const ETC = EAC - AC                          // Estimate To Complete
  const VAC = BAC - EAC                         // Variance At Completion
  const TCPI = (BAC - EV) > 0 ? (BAC - EV) / (BAC - AC) : 1  // To-Complete Performance Index

  const currency = project?.currency || "USD"

  const card: React.CSSProperties = {
    background:"#fff", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", padding:"14px 16px"
  }

  return (
    <div style={{ padding:16, overflowY:"auto" }}>
      {/* ── Full EVM Dashboard ── */}
      <div style={{ ...card, marginBottom:16, padding:0, overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)",
          background:"var(--steel)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>
              Earned Value Management (EVM)
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.6)", marginTop:1 }}>
              PM Best Practices — Measurement Performance Domain
            </div>
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,.7)" }}>
            {project?.percentComplete || 0}% complete
          </div>
        </div>

        {/* Row 1: Core values */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)",
          borderBottom:"1px solid var(--border)" }}>
          {[
            { label:t("Budget at Completion (BAC)"), value:fmt(BAC,currency), sub:t("Total project budget"),
              color:"var(--text)", tip:"The total authorized budget for the project" },
            { label:t("Earned Value (EV)"), value:fmt(EV,currency), sub:`${pct}% ${t("work done")}`,
              color:"var(--steel)", tip:"Value of work actually performed" },
            { label:t("Actual Cost (AC)"), value:fmt(AC,currency), sub:t("Spent to date"),
              color:AC>EV?"var(--red)":"var(--text)", tip:"Total costs incurred for work performed" },
            { label:t("Planned Value (PV)"), value:fmt(PV,currency), sub:t("Scheduled work to date"),
              color:"var(--text-2)", tip:"Authorized budget assigned to scheduled work" },
          ].map((k,i) => (
            <div key={k.label} style={{ padding:"14px 16px",
              borderRight:i<3?"1px solid var(--border)":"none" }}>
              <div style={{ fontSize:10, fontWeight:600, color:"var(--text-3)",
                textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 }}>
                {k.label}
              </div>
              <div style={{ fontSize:20, fontWeight:700, color:k.color, lineHeight:1 }}>
                {k.value}
              </div>
              <div style={{ fontSize:10, color:"var(--text-4)", marginTop:3 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Row 2: Performance indices */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)",
          borderBottom:"1px solid var(--border)" }}>
          {[
            { label:t("Cost Performance Index (CPI)"), value:CPI.toFixed(2),
              sub:CPI>1?"Under budget":CPI<1?t("Over budget"):t("On budget"),
              color:CPI>=1?"var(--green)":"var(--red)",
              tip:"CPI = EV/AC. >1 = under budget, <1 = over budget" },
            { label:t("Schedule Performance Index (SPI)"), value:SPI.toFixed(2),
              sub:SPI>1?t("Ahead of schedule"):SPI<1?t("Behind schedule"):t("On schedule"),
              color:SPI>=1?"var(--green)":"var(--amber)",
              tip:"SPI = EV/PV. >1 = ahead, <1 = behind" },
            { label:"Cost Variance (CV)", value:(CV>=0?"+":"")+fmt(Math.abs(CV),currency),
              sub:CV>=0?"Favorable":"Unfavorable",
              color:CV>=0?"var(--green)":"var(--red)",
              tip:"CV = EV - AC. Positive = under budget" },
            { label:"To-Complete Performance Index (TCPI)", value:TCPI.toFixed(2),
              sub:TCPI>1?t("Needs improvement"):TCPI<=1?t("On track"):"",
              color:TCPI>1.1?"var(--red)":TCPI>1?"var(--amber)":"var(--green)",
              tip:"Efficiency needed to complete on budget" },
          ].map((k,i) => (
            <div key={k.label} style={{ padding:"14px 16px",
              borderRight:i<3?"1px solid var(--border)":"none" }}>
              <div style={{ fontSize:10, fontWeight:600, color:"var(--text-3)",
                textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 }}>
                {k.label}
              </div>
              <div style={{ fontSize:20, fontWeight:700, color:k.color, lineHeight:1 }}>
                {k.value}
              </div>
              <div style={{ fontSize:10, color:k.color, marginTop:3, opacity:.8 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Row 3: Forecasts */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)" }}>
          {[
            { label:t("Estimate at Completion (EAC)"), value:fmt(EAC,currency),
              sub:`${EAC>BAC?"⚠ Over":"✓ Within"} budget forecast`,
              color:EAC>BAC?"var(--red)":"var(--green)",
              tip:"EAC = BAC/CPI. Forecast of total project cost" },
            { label:"Estimate to Complete (ETC)", value:fmt(ETC,currency),
              sub:t("Remaining cost needed"),
              color:"var(--text)",
              tip:"ETC = EAC - AC. Expected cost to finish" },
            { label:t("Variance at Completion (VAC)"), value:(VAC>=0?"+":"")+fmt(Math.abs(VAC),currency),
              sub:VAC>=0?t("Projected savings"):t("Projected overrun"),
              color:VAC>=0?"var(--green)":"var(--red)",
              tip:"VAC = BAC - EAC. Positive = projected savings" },
          ].map((k,i) => (
            <div key={k.label} style={{ padding:"14px 16px",
              borderRight:i<2?"1px solid var(--border)":"none" }}>
              <div style={{ fontSize:10, fontWeight:600, color:"var(--text-3)",
                textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 }}>
                {k.label}
              </div>
              <div style={{ fontSize:20, fontWeight:700, color:k.color, lineHeight:1 }}>
                {k.value}
              </div>
              <div style={{ fontSize:10, color:k.color, marginTop:3, opacity:.8 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Spend bar */}
      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:8 }}>
          <span style={{ fontWeight:500, color:"var(--text)" }}>Budget utilization</span>
          <span style={{ color:pct>90?"var(--red)":pct>75?"var(--amber)":"var(--text-3)" }}>
            {fmt(AC,currency)} of {fmt(BAC,currency)} ({pct}%)
          </span>
        </div>
        <div style={{ height:10, background:"var(--border)", borderRadius:5, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${Math.min(pct,100)}%`,
            background:pct>90?"var(--red)":pct>75?"var(--amber)":"var(--steel)",
            borderRadius:5, transition:"width .5s" }} />
        </div>
        {pct > 100 && (
          <div style={{ fontSize:11, color:"var(--red)", marginTop:6, fontWeight:500 }}>
            ⚠ Budget exceeded by {fmt(AC-BAC,currency)}
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
          {can("budget:edit") && (
          <div style={{ display:"flex", gap:8 }}>
          <button
            title="AI-scan project documents for cost line items"
            style={{ padding:"6px 12px", background:"#fff", color:"var(--text-2)",
              border:"1px solid var(--border)", borderRadius:"var(--radius)", fontSize:11,
              fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}
            onClick={() => { setScanOpen(o => !o); setCandidates(null); setScanError("") }}>
            🤖 Scan documents
          </button>
          <button
            style={{ padding:"6px 12px", background:"var(--steel)", color:"#fff", border:"none",
              borderRadius:"var(--radius)", fontSize:11, fontWeight:500, cursor:"pointer",
              fontFamily:"var(--font)" }}
            onClick={() => setAddingItem(true)}>
            + Add item
          </button>
          </div>
          )}
        </div>
        {scanOpen && (
          <div style={{ margin:"12px 16px", padding:14, border:"1px solid var(--border)",
            borderRadius:"var(--radius)", background:"var(--surface)" }}>
            {!candidates ? (
              <DocScanPicker projectId={projectId} workspaceId={workspaceId || ""}
                scanning={scanning} onScan={runScan} />
            ) : (
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--text)", marginBottom:8 }}>
                  {candidates.length ? `Found ${candidates.length} cost item${candidates.length===1?"":"s"} — review and add:` : "No cost items with amounts found in the selected documents."}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:300, overflowY:"auto" }}>
                  {candidates.map((c: any, i: number) => (
                    <label key={i} style={{ display:"flex", gap:10, alignItems:"flex-start",
                      padding:"10px 12px", background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", cursor:"pointer" }}>
                      <input type="checkbox" checked={pickedCands.has(i)} style={{ marginTop:3 }}
                        onChange={() => setPickedCands(prev => {
                          const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n
                        })} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:2, flexWrap:"wrap" }}>
                          <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{c.description}</span>
                          <span style={{ fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:4,
                            background:"var(--surface)", color:"var(--text-3)", border:"1px solid var(--border)" }}>
                            {c.category || "OTHER"}
                          </span>
                          <span style={{ fontSize:12, fontWeight:700, color:"var(--steel)" }}>
                            {fmt(Number(c.plannedAmount)||0, currency)}
                          </span>
                        </div>
                        {c.evidence && (
                          <div style={{ fontSize:11, color:"var(--text-3)", fontStyle:"italic" }}>
                            "{c.evidence}" — {c.sourceDoc}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8, marginTop:10, alignItems:"center" }}>
                  {candidates.length > 0 && (
                  <button onClick={commitCandidates} disabled={committing || pickedCands.size === 0}
                    style={{ padding:"7px 16px", background:"var(--steel)", color:"#fff", border:"none",
                      borderRadius:"var(--radius)", fontSize:12, fontWeight:500, fontFamily:"var(--font)",
                      cursor: committing || pickedCands.size === 0 ? "not-allowed" : "pointer",
                      opacity: committing || pickedCands.size === 0 ? 0.6 : 1 }}>
                    {committing ? "Adding…" : `＋ Add ${pickedCands.size} to budget`}
                  </button>
                  )}
                  <button onClick={() => setCandidates(null)}
                    style={{ padding:"7px 12px", background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                      fontFamily:"var(--font)", color:"var(--text-2)" }}>
                    ← Pick different documents
                  </button>
                </div>
              </div>
            )}
            {scanSkipped.length > 0 && candidates && (
              <div style={{ fontSize:11, color:"#B45309", marginTop:8 }}>
                ⚠ Skipped: {scanSkipped.map(x => `${x.name} (${x.reason})`).join(" · ")}
              </div>
            )}
            {scanError && <div style={{ fontSize:12, color:"#B91C1C", marginTop:8 }}>✗ {scanError}</div>}
          </div>
        )}
        {budgetItems.length === 0 && !addingItem ? (
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
                const planned  = Number(item.plannedCost||item.plannedAmount||0)
                const actual   = Number(item.actualCost||item.actualAmount||0)
                const variance = planned - actual
                const isEditing = editId === item.id
                return (
                  <tr key={item.id} style={{ borderBottom:"1px solid var(--surface-1,#F1F5F9)",
                    background: isEditing ? "#EFF6FF" : "transparent" }}>
                    {isEditing ? (
                      <>
                        <td style={{ padding:"6px 10px" }}>
                          <input style={inpS} value={editForm.description}
                            onChange={e=>setEditForm((f:any)=>({...f,description:e.target.value}))} />
                        </td>
                        <td style={{ padding:"6px 10px" }}>
                          <select style={{...inpS,cursor:"pointer"}} value={editForm.category}
                            onChange={e=>setEditForm((f:any)=>({...f,category:e.target.value}))}>
                            {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td style={{ padding:"6px 10px" }}>
                          <input type="number" style={inpS} value={editForm.plannedAmount}
                            onChange={e=>setEditForm((f:any)=>({...f,plannedAmount:e.target.value}))} />
                        </td>
                        <td style={{ padding:"6px 10px" }}>
                          <input type="number" style={inpS} value={editForm.actualAmount}
                            onChange={e=>setEditForm((f:any)=>({...f,actualAmount:e.target.value}))} />
                        </td>
                        <td style={{ padding:"6px 10px", fontSize:12, fontFamily:"monospace",
                          color:(Number(editForm.plannedAmount||0)-Number(editForm.actualAmount||0))>=0?"var(--green)":"var(--red)" }}>
                          {fmt(Number(editForm.plannedAmount||0)-Number(editForm.actualAmount||0),currency)}
                        </td>
                        <td style={{ padding:"6px 10px" }}>
                          <div style={{ display:"flex", gap:4 }}>
                            <button onClick={()=>saveEdit(item.id)} disabled={saving}
                              style={{ padding:"4px 10px", background:"var(--steel)", color:"#fff",
                                border:"none", borderRadius:4, fontSize:11, cursor:"pointer",
                                fontFamily:"var(--font)" }}>
                              {saving?"…":"Save"}
                            </button>
                            <button onClick={()=>setEditId(null)}
                              style={{ padding:"4px 8px", background:"none", border:"1px solid var(--border)",
                                borderRadius:4, fontSize:11, cursor:"pointer", fontFamily:"var(--font)",
                                color:"var(--text-3)" }}>
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding:"10px 14px", fontSize:13, color:"var(--text)", fontWeight:500 }}>
                          {item.name||item.description}
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
                          <div style={{ display:"flex", gap:6 }}>
                            {can("budget:edit") ? (<>
                            <button onClick={() => {
                              setEditId(item.id)
                              setEditForm({
                                description:   item.description||"",
                                category:      item.category||"OTHER",
                                plannedAmount: planned,
                                actualAmount:  actual,
                                notes:         item.notes||"",
                              })
                            }} style={{ fontSize:11, color:"var(--steel)", background:"none",
                              border:"1px solid var(--border)", borderRadius:4,
                              cursor:"pointer", fontFamily:"var(--font)", padding:"3px 10px" }}>
                              Edit
                            </button>
                            <button onClick={()=>deleteItem(item.id)}
                              style={{ fontSize:11, color:"var(--red)", background:"none",
                                border:"1px solid #FECACA", borderRadius:4,
                                cursor:"pointer", fontFamily:"var(--font)", padding:"3px 8px" }}>
                              ✕
                            </button>
                            </>) : <span style={{ fontSize:11, color:"var(--text-4)" }}>—</span>}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
              {/* Add new item row */}
              {addingItem && (
                <tr style={{ background:"#ECFDF5", borderBottom:"1px solid var(--border)" }}>
                  <td style={{ padding:"6px 10px" }}>
                    <input style={inpS} value={newItem.description} autoFocus
                      placeholder={t("Budget item name…")}
                      onChange={e=>setNewItem(f=>({...f,description:e.target.value}))} />
                  </td>
                  <td style={{ padding:"6px 10px" }}>
                    <select style={{...inpS,cursor:"pointer"}} value={newItem.category}
                      onChange={e=>setNewItem(f=>({...f,category:e.target.value}))}>
                      {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td style={{ padding:"6px 10px" }}>
                    <input type="number" style={inpS} value={newItem.plannedAmount}
                      placeholder="0"
                      onChange={e=>setNewItem(f=>({...f,plannedAmount:e.target.value}))} />
                  </td>
                  <td style={{ padding:"6px 10px" }}>
                    <span style={{ fontSize:12, color:"var(--text-4)" }}>$0</span>
                  </td>
                  <td />
                  <td style={{ padding:"6px 10px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <button onClick={addItem} disabled={saving||!newItem.description.trim()}
                        style={{ padding:"4px 10px", background:"var(--green,#059669)", color:"#fff",
                          border:"none", borderRadius:4, fontSize:11, cursor:"pointer",
                          fontFamily:"var(--font)", opacity:!newItem.description.trim()?0.5:1 }}>
                        {saving?"…":"Add"}
                      </button>
                      <button onClick={()=>setAddingItem(false)}
                        style={{ padding:"4px 8px", background:"none", border:"1px solid var(--border)",
                          borderRadius:4, fontSize:11, cursor:"pointer", fontFamily:"var(--font)",
                          color:"var(--text-3)" }}>
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}
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
                    {new Date(te.date).toLocaleDateString("en-US", {month:"short",day:"numeric", timeZone:"UTC" })}
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
