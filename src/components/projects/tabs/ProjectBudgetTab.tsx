"use client"
import React from "react"
import { plannedValueAt } from "@/lib/evm-phasing"
// src/components/projects/tabs/ProjectBudgetTab.tsx
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
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
  // Budget automation #1: Auto earned value toggle (Project.autoEv)
  const [autoEv, setAutoEv] = useState<boolean>(project?.autoEv !== false)
  const [recalcing, setRecalcing] = useState(false)

  // Stored earned value only updates when a task changes. Linking a task to a
  // line without touching its progress leaves the figure behind, so there has to
  // be a way to bring it current without editing something at random.
  async function recomputeEv() {
    setRecalcing(true)
    try {
      let res = await fetch(`/api/projects/${projectId}/budget/recompute-ev`, { method: "POST" })
      if (res.status === 409) {
        const d = await res.json().catch(() => null)
        if (!confirm(`${d?.error || "Auto EV is off."}\n\nRecalculate anyway and overwrite them?`)) return
        res = await fetch(`/api/projects/${projectId}/budget/recompute-ev?force=1`, { method: "POST" })
      }
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        alert(d?.error || `Could not recalculate (${res.status})`)
        return
      }
      router.refresh()
    } finally { setRecalcing(false) }
  }
  // Budget automation #5: scan a receipt photo → AI drafts the expense
  const [receiptBusyId, setReceiptBusyId] = useState<string | null>(null)
  const [receiptMsg, setReceiptMsg] = useState("")
  // An invoice covering two budget lines is normal — one for the robot, one for
  // the integration parts. Preview the document's own lines and let the PM map
  // them, rather than making them post the same paper twice and hope the two
  // halves stay associated.
  const [split, setSplit] = useState<null | {
    itemId: string; file: File; vendor: string; total: number
    rows: { budgetItemId: string; amount: number; note?: string }[]
  }>(null)

  async function scanReceipt(itemId: string, file: File, force = false,
                             rows?: { budgetItemId: string; amount: number; note?: string }[]) {
    setReceiptBusyId(itemId); setReceiptMsg("")
    try {
      const fd = new FormData(); fd.append("file", file)
      if (rows?.length) fd.append("split", JSON.stringify(rows))
      const res = await fetch(`/api/projects/${projectId}/budget/${itemId}/receipt${force ? "?force=1" : ""}`, {
        method: "POST",
        headers: workspaceId ? { "x-workspace-id": workspaceId } : {},
        body: fd,
      })
      const d = await res.json().catch(() => ({}))
      if (res.status === 409) {
        if (confirm(`${d?.error || "Possible duplicate receipt."}\n\nPost it anyway?`)) {
          setReceiptBusyId(null)
          return scanReceipt(itemId, file, true)
        }
        return
      }
      if (!res.ok) { setReceiptMsg(d?.error || `Scan failed (${res.status})`); return }
      const r = d.data
      // Itemised document, no split chosen yet: offer the mapping instead of
      // dropping the whole total on the line that happened to be clicked.
      if (!rows?.length && Array.isArray(r.lines) && r.lines.length > 1) {
        setSplit({
          itemId, file, vendor: r.vendor || "Invoice", total: Number(r.amount) || 0,
          rows: r.lines.map((l: any) => ({
            budgetItemId: itemId, amount: Number(l.amount) || 0, note: l.description,
          })),
        })
        setReceiptMsg("")
        return
      }
      setReceiptMsg(`✓ ${r.vendor} — ${r.amount ? `$${Number(r.amount).toLocaleString()}` : "amount not detected, edit the expense"} posted${r.date ? ` (${r.date})` : ""}`)
      window.location.reload()
    } catch { setReceiptMsg("Scan failed — network error") }
    finally { setReceiptBusyId(null) }
  }

  // Committed (open POs): ACTIVE agreements linked to budget lines. True
  // exposure = Spent + Committed — the classic "signed but not yet invoiced".
  const [committedBy, setCommittedBy] = useState<Record<string, number>>({})
  useEffect(() => {
    fetch(`/api/projects/${projectId}/procurement`,
      { headers: workspaceId ? { "x-workspace-id": workspaceId } : {} })
      .then(r => r.json()).catch(() => null)
      .then(d => {
        const its = d?.data?.items || []
        const map: Record<string, number> = {}
        for (const it of its) {
          if (it.status !== "ACTIVE") continue
          // A split PO commits per allocation; an unsplit one commits its whole
          // value to the single linked line.
          const allocs = it.allocations || []
          if (allocs.length) {
            for (const a of allocs) {
              if (!a.budgetItemId) continue
              map[a.budgetItemId] = (map[a.budgetItemId] || 0) + Number(a.amount || 0)
            }
          } else if (it.budgetItemId && it.value) {
            map[it.budgetItemId] = (map[it.budgetItemId] || 0) + Number(it.value)
          }
        }
        setCommittedBy(map)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])
  // A signed $59K contract with $18K already paid still exposes $59K in total,
  // not $77K. Money paid against a purchase order is a drawdown of that
  // commitment, so the amount still owed is what remains — otherwise every
  // staged payment counts twice and lines with normal progress payments read as
  // over plan when they're exactly on it.
  const remainingCommitment = (lineId: string) => {
    const committed = committedBy[lineId] || 0
    if (committed <= 0) return 0
    const line = budgetItems.find((b: any) => b.id === lineId)
    const paid = Number(line?.actualCost ?? line?.actualAmount ?? 0)
    return Math.max(0, committed - paid)
  }
  const committedTotal = Object.keys(committedBy)
    .reduce((a, id) => a + remainingCommitment(id), 0)

  // Control accounts: tasks linked to each budget line drive that line's
  // earned value, so the PM should see whose work is behind each number.
  const [lineTasks, setLineTasks] = useState<Record<string, { pct: number; count: number; names: string[] }>>({})
  const [phasingTasks, setPhasingTasks] = useState<any[]>([])
  useEffect(() => {
    fetch(`/api/projects/${projectId}/tasks?limit=500`,
      { headers: workspaceId ? { "x-workspace-id": workspaceId } : {} })
      .then(r => r.json()).catch(() => null)
      .then(d => {
        const rows = d?.data?.items || d?.data || []
        if (!Array.isArray(rows)) return
        setPhasingTasks(rows)
        const acc: Record<string, { weighted: number; weight: number; count: number; names: string[] }> = {}
        for (const t of rows) {
          if (t.status === "CANCELLED") continue
          // A task can consume several lines; its effort divides across them so
          // one task never counts at full weight on two accounts.
          const links = (t.budgetLines?.length
            ? t.budgetLines
            : (t.budgetItemId ? [{ budgetItemId: t.budgetItemId, share: null }] : []))
            .filter((l: any) => l?.budgetItemId)
          if (!links.length) continue
          const shares = links.map((l: any) => {
            const n = Number(l.share)
            return Number.isFinite(n) && n > 0 ? n : 0
          })
          const given = shares.reduce((x: number, y: number) => x + y, 0)
          const base  = Number(t.estimatedHours) || 1
          links.forEach((l: any, i: number) => {
            const portion = given > 0 ? shares[i] / given : 1 / links.length
            const w = base * portion
            const a = acc[l.budgetItemId] || { weighted: 0, weight: 0, count: 0, names: [] as string[] }
            a.weighted += (t.percentComplete || 0) * w
            a.weight   += w
            a.count    += 1
            // Which tasks, not just how many: "1 linked task · 0% complete" is
            // impossible to argue with until you can see whose task it is.
            if (a.names.length < 8) a.names.push(`${t.code || ""} ${t.title || ""}`.trim() + ` — ${t.percentComplete || 0}%`)
            acc[l.budgetItemId] = a
          })
        }
        const out: Record<string, { pct: number; count: number; names: string[] }> = {}
        for (const [id, a] of Object.entries(acc)) {
          out[id] = { pct: a.weight ? Math.round(a.weighted / a.weight) : 0, count: a.count, names: a.names }
        }
        setLineTasks(out)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Expenses behind a line's Actual — visible, auditable, deletable.
  const [expOpenId, setExpOpenId] = useState<string | null>(null)
  const [expList, setExpList] = useState<any[] | null>(null)
  const [expBusy, setExpBusy] = useState(false)
  async function toggleExpenses(itemId: string) {
    if (expOpenId === itemId) { setExpOpenId(null); setExpList(null); return }
    setExpOpenId(itemId); setExpList(null); setExpBusy(true)
    const res = await fetch(`/api/projects/${projectId}/budget/${itemId}/expenses`,
      { headers: workspaceId ? { "x-workspace-id": workspaceId } : {} }).catch(() => null)
    setExpBusy(false)
    const d = await res?.json().catch(() => null)
    setExpList(d?.data?.expenses || [])
  }
  async function deleteExpense(itemId: string, expenseId: string, amount: number) {
    if (!confirm(`Delete this $${Number(amount).toLocaleString()} expense? The line's Actual decreases by that amount.`)) return
    setExpBusy(true)
    await fetch(`/api/projects/${projectId}/budget/${itemId}/expenses?expenseId=${expenseId}`,
      { method: "DELETE", headers: workspaceId ? { "x-workspace-id": workspaceId } : {} }).catch(() => null)
    setExpBusy(false)
    setExpList(l => (l || []).filter(e => e.id !== expenseId))
    router.refresh()
  }

  async function toggleAutoEv(next: boolean) {
    setAutoEv(next)
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(workspaceId ? { "x-workspace-id": workspaceId } : {}) },
      body: JSON.stringify({ autoEv: next }),
    }).catch(() => null)
    if (!res || !res.ok) setAutoEv(!next)
  }
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
      setPickedCands(new Set(c.map((x: any, i: number) => x.dupOf ? -1 : i).filter((i: number) => i >= 0)))
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
  const [newItem,  setNewItem]  = useState({ description:"", category:"LABOR", plannedAmount:"", notes:"", recurrence:false })

  async function saveEdit(itemId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/budget/${itemId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          // An empty description must not take the amounts down with it.
          description:   editForm.description?.trim() ? editForm.description.trim() : undefined,
          plannedAmount: Number(editForm.plannedAmount)||0,
          actualAmount:  Number(editForm.actualAmount)||0,
          category:      editForm.category,
          notes:         editForm.notes||null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        alert(d?.error || `Could not save this line (HTTP ${res.status}).`)
        return
      }
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
          recurrence:    newItem.recurrence ? "MONTHLY" : null,
          actualAmount:  0,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        alert(d?.error || `Could not add item (${res.status})`)
        return
      }
      setAddingItem(false)
      setNewItem({ description:"", category:"LABOR", plannedAmount:"", notes:"", recurrence:false })
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
  // Earned value comes from the lines themselves — each control account earns
  // from its own tasks. The old BAC × project.percentComplete disagreed with the
  // per-line Earned column and went to zero whenever the project rollup was
  // stale (a bulk Excel import never refreshed it).
  const lineEV = budgetItems.reduce((s2, b: any) => s2 + Number(b.earnedValue || 0), 0)
  const EV  = lineEV > 0 ? lineEV : BAC * pctComplete
  const evPct = BAC > 0 ? Math.round((EV / BAC) * 100) : 0
  // Planned Value, time-phased: every dollar rides on the work that consumes it
  // (control accounts first, project window for money with no task). Same
  // function the S-curve uses, so the KPI and the chart can't disagree.
  const PV = phasingTasks.length
    ? plannedValueAt({
        tasks: phasingTasks, lines: budgetItems as any, bac: BAC,
        projectStart: project?.startDate, projectEnd: project?.endDate,
      })
    : BAC * plannedPct                          // no tasks yet → elapsed-time fallback
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
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer",
              fontSize:11, color:"rgba(255,255,255,.85)" }}
              title="When on, earned value on every budget line is recalculated automatically from task progress. Turn off to enter EV manually.">
              <input type="checkbox" checked={autoEv}
                onChange={e => toggleAutoEv(e.target.checked)}
                style={{ accentColor:"#F59E0B", width:14, height:14, cursor:"pointer" }} />
              Auto EV
            </label>
            <button onClick={recomputeEv} disabled={recalcing}
              title="Recalculate earned value on every line from current task progress"
              style={{ padding:"4px 10px", borderRadius:6, cursor:recalcing?"wait":"pointer",
                fontSize:11, fontWeight:600, fontFamily:"var(--font)",
                background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.25)",
                color:"#fff" }}>
              {recalcing ? "Recalculating…" : "↻ Recalculate EV"}
            </button>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.7)" }}>
            <span title="Share of tasks complete, weighted by estimated hours. The earned value card shows the share of budget earned — the two differ when expensive work and time-consuming work aren't the same work.">
              {project?.percentComplete || 0}% of tasks
            </span>
          </div>
          </div>
        </div>

        {/* Row 1: Core values */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)",
          borderBottom:"1px solid var(--border)" }}>
          {[
            { label:t("Budget at Completion (BAC)"), value:fmt(BAC,currency), sub:t("Total project budget"),
              color:"var(--text)", tip:"The total authorized budget for the project" },
            { label:t("Earned Value (EV)"), value:fmt(EV,currency), sub:`${evPct}% of budget earned`,
              color:"var(--steel)", tip:"Value of work actually performed" },
            { label:t("Actual Cost (AC)"), value:fmt(AC,currency), sub:t("Spent to date"),
              color:AC>EV?"var(--red)":"var(--text)", tip:"Total costs incurred for work performed" },
            { label:t("Planned Value (PV)"), value:fmt(PV,currency),
              sub: phasingTasks.length ? t("Scheduled work to date") : t("Scheduled work to date (by calendar)"),
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
            { label:t("Cost Performance Index (CPI)"), value:EV<=0?"—":CPI.toFixed(2),
              sub:EV<=0?"No earned value yet":CPI>1?"Under budget":CPI<1?t("Over budget"):t("On budget"),
              color:EV<=0?"var(--text-3)":CPI>=1?"var(--green)":"var(--red)",
              tip:"CPI = EV/AC. >1 = under budget, <1 = over budget" },
            { label:t("Schedule Performance Index (SPI)"), value:EV<=0?"—":SPI.toFixed(2),
              sub:EV<=0?"No earned value yet":SPI>1?t("Ahead of schedule"):SPI<1?t("Behind schedule"):t("On schedule"),
              color:EV<=0?"var(--text-3)":SPI>=1?"var(--green)":"var(--amber)",
              tip:"SPI = EV/PV. >1 = ahead, <1 = behind" },
            { label:"Cost Variance (CV)", value:(CV>=0?"+":"")+fmt(Math.abs(CV),currency),
              sub:CV>=0?"Favorable":"Unfavorable",
              color:CV>=0?"var(--green)":"var(--red)",
              tip:"CV = EV - AC. Positive = under budget" },
            { label:"To-Complete Performance Index (TCPI)", value:TCPI.toFixed(2),
              sub:EV<=0?"No earned value yet":TCPI>1?t("Needs improvement"):t("On track"),
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
        <div style={{ height:10, background:"var(--border)", borderRadius:5, overflow:"hidden",
          display:"flex" }}>
          <div style={{ height:"100%", width:`${Math.min(pct,100)}%`,
            background:pct>90?"var(--red)":pct>75?"var(--amber)":"var(--steel)",
            transition:"width .5s" }} />
          {committedTotal > 0 && BAC > 0 && (
            <div title="Still committed — the part of signed POs you haven't paid yet"
              style={{ height:"100%", width:`${Math.min((committedTotal/BAC)*100, 100-Math.min(pct,100))}%`,
                background:"repeating-linear-gradient(45deg, var(--amber), var(--amber) 4px, transparent 4px, transparent 8px)",
                opacity:.75, transition:"width .5s" }} />
          )}
        </div>
        {committedTotal > 0 && (
          <div style={{ fontSize:11.5, color:"var(--text-3)", marginTop:6 }}>
            Still committed (open POs, net of payments made):{" "}
            <strong style={{ color:"var(--amber)" }}>{fmt(committedTotal,currency)}</strong>
            {" · "}True exposure (spent + still committed):{" "}
            <strong style={{ color:"var(--text)" }}>{fmt(AC+committedTotal,currency)}</strong> of {fmt(BAC,currency)}
            {" "}({BAC>0 ? Math.round(((AC+committedTotal)/BAC)*100) : 0}%)
          </div>
        )}
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
            {receiptMsg && <span style={{ marginLeft:10, fontSize:11, fontWeight:500,
              color: receiptMsg.startsWith("✓") ? "var(--green)" : "var(--red)" }}>{receiptMsg}</span>}
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
                  {(() => {
                    if (!candidates.length) {
                      return "No cost items with amounts found in the selected documents. If your budget already " +
                             "covers what's in them, that's expected — the scan only proposes what it can read as a cost."
                    }
                    const dup = candidates.filter((c: any) => c.dupOf).length
                    const fresh = candidates.length - dup
                    if (dup && !fresh) {
                      return `Found ${candidates.length} cost item${candidates.length===1?"":"s"} — all of them already appear in your budget. Review below; nothing is pre-selected.`
                    }
                    if (dup) {
                      return `Found ${candidates.length} cost items — ${fresh} new, ${dup} already in your budget (unchecked below):`
                    }
                    return `Found ${candidates.length} cost item${candidates.length===1?"":"s"} — review and add:`
                  })()}
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
                        {c.dupOf && (
                          <div style={{ fontSize:11, color:"#B45309", marginBottom:2 }}>
                            ⚠ Likely a detail of existing "{c.dupOf}" — adding it would double-count.
                          </div>
                        )}
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
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
      {/* Map an itemised invoice onto budget lines */}
      {split && (
        <div style={{ position:"fixed", inset:0, background:"rgba(13,27,42,.45)", zIndex:200,
          display:"grid", placeItems:"center", padding:20 }}
          onClick={() => setSplit(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:"#fff", borderRadius:14, padding:22, width:"min(640px,100%)",
              maxHeight:"85vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(13,27,42,.28)" }}>
            <div style={{ fontSize:15, fontWeight:800, color:"var(--text)", marginBottom:4 }}>
              Split this invoice across budget lines
            </div>
            <div style={{ fontSize:12.5, color:"var(--text-3)", lineHeight:1.6, marginBottom:14 }}>
              {split.vendor} · {fmt(split.total, currency)} — the document lists {split.rows.length} charges.
              Assign each to the line it belongs to. One expense posts per line, all linked to this same document.
            </div>

            {split.rows.map((r, i) => (
              <div key={i} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11.5, color:"var(--text-3)", marginBottom:3 }}>
                    {r.note || `Line ${i+1}`}
                  </div>
                  <select value={r.budgetItemId}
                    onChange={e => setSplit(sp => sp && ({ ...sp,
                      rows: sp.rows.map((x,j) => j===i ? { ...x, budgetItemId: e.target.value } : x) }))}
                    style={{ width:"100%", padding:"7px 9px", fontSize:12.5, borderRadius:6,
                      border:"1px solid var(--border)", fontFamily:"var(--font)" }}>
                    {budgetItems.map((b:any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ width:120 }}>
                  <div style={{ fontSize:11.5, color:"var(--text-3)", marginBottom:3 }}>Amount</div>
                  <input type="number" step="0.01" min={0} value={r.amount}
                    onChange={e => setSplit(sp => sp && ({ ...sp,
                      rows: sp.rows.map((x,j) => j===i ? { ...x, amount: Number(e.target.value)||0 } : x) }))}
                    style={{ width:"100%", padding:"7px 9px", fontSize:12.5, borderRadius:6,
                      border:"1px solid var(--border)", fontFamily:"var(--font)" }} />
                </div>
                <button onClick={() => setSplit(sp => sp && ({ ...sp, rows: sp.rows.filter((_,j)=>j!==i) }))}
                  title="Remove this charge"
                  style={{ marginTop:20, border:"1px solid #FECACA", background:"none", color:"var(--red)",
                    borderRadius:6, cursor:"pointer", padding:"6px 9px", fontFamily:"var(--font)" }}>✕</button>
              </div>
            ))}

            {(() => {
              const sum = split.rows.reduce((a,b) => a + (Number(b.amount)||0), 0)
              const diff = Math.round((split.total - sum) * 100) / 100
              const ok = Math.abs(diff) < 0.5
              return (
                <>
                  <div style={{ fontSize:12.5, fontWeight:700, marginTop:6,
                    color: ok ? "var(--green)" : "var(--amber)" }}>
                    Assigned {fmt(sum, currency)} of {fmt(split.total, currency)}
                    {ok ? " — balanced ✓" : diff > 0
                      ? ` — ${fmt(diff, currency)} unassigned`
                      : ` — over by ${fmt(Math.abs(diff), currency)}`}
                  </div>
                  <div style={{ display:"flex", gap:8, marginTop:16 }}>
                    <button disabled={!ok || receiptBusyId !== null}
                      onClick={() => { const sp = split; setSplit(null); scanReceipt(sp.itemId, sp.file, true, sp.rows) }}
                      style={{ flex:1, padding:"10px 0", background: ok ? "var(--steel)" : "var(--border)",
                        color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:700,
                        cursor: ok ? "pointer" : "not-allowed", fontFamily:"var(--font)" }}>
                      Post {split.rows.length} expense{split.rows.length===1?"":"s"}
                    </button>
                    <button onClick={() => { const sp = split; setSplit(null); scanReceipt(sp.itemId, sp.file, true) }}
                      style={{ padding:"10px 16px", background:"none", border:"1px solid var(--border)",
                        borderRadius:8, fontSize:13, cursor:"pointer", color:"var(--text-2)",
                        fontFamily:"var(--font)" }}>
                      Post all to one line
                    </button>
                    <button onClick={() => setSplit(null)}
                      style={{ padding:"10px 14px", background:"none", border:"none",
                        fontSize:13, cursor:"pointer", color:"var(--text-3)",
                        fontFamily:"var(--font)" }}>Cancel</button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

          <table style={{ width:"100%", borderCollapse:"collapse" , minWidth:680 }}>
            <thead>
              <tr style={{ background:"var(--surface)" }}>
                {["Description","Category","Planned","Earned","Actual","Variance",""].map(h => (
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
                const earned   = Number(item.earnedValue||0)
                const approved = item.approvedCost == null ? null : Number(item.approvedCost)
                const revised  = approved != null && Math.abs(approved - planned) > 0.5
                const committed = remainingCommitment(item.id)
                // Cost performance for this line alone. Paying ahead of delivered
                // value isn't a mistake — a contractual advance is normal — but it
                // is exposure: if the vendor fails now, the gap is money out with
                // nothing received for it. The project-level CPI hides this inside
                // an average, so a single bad line never surfaces.
                const lineCPI  = actual > 0 ? earned / actual : null
                const aheadBy  = actual - earned
                const gapWorthShowing = actual > 100 && aheadBy > Math.max(500, actual * 0.05)
                // The same gap means two different things depending on whether the
                // work is finished. Mid-delivery it's an advance — timing that will
                // close. Once the line has earned its full plan, nothing is coming
                // to close it: that is an overrun, and calling it "ahead of value"
                // would tell a PM to wait for something that will never arrive.
                // "Delivered" is a claim about work, and the only evidence of work
                // is a task. Without linked tasks the earned value is either a
                // manual entry or the project-wide proportional fallback — telling
                // a PM a line is "delivered under plan" on that basis is the system
                // asserting something nobody measured.
                const taskEvidence  = lineTasks[item.id]?.count || 0
                const tasksComplete = taskEvidence > 0 && (lineTasks[item.id]?.pct ?? 0) >= 99
                const workDelivered = tasksComplete
                // Payment-vs-value warnings need task evidence too: a line with no
                // tasks has no measured value to be ahead of.
                const paidAhead  = gapWorthShowing && taskEvidence > 0 && !workDelivered
                const overspent  = gapWorthShowing && workDelivered
                // The mirror case: delivered, but paid less than the value earned.
                // That is either a genuine saving or an invoice that hasn't arrived
                // — and the difference matters, because one is money you keep and
                // the other is a liability sitting outside the budget. An open
                // commitment on the line is the tell; without one, the PM is the
                // only person who can confirm the invoices are all in.
                const underBy    = earned - actual
                const underspent = workDelivered && underBy > Math.max(500, earned * 0.03)
                // Over-commitment is a governance signal, not a footnote: a line
                // with $3K planned and $42K in signed POs must read as a problem.
                const exposure = actual + committed
                const overCommitted = planned > 0 && exposure > planned
                const variance = planned - actual
                const isEditing = editId === item.id
                return (<React.Fragment key={item.id}>
                  <tr style={{ borderBottom:"1px solid var(--surface-1,#F1F5F9)",
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
                        <td style={{ padding:"6px 10px", fontSize:12, fontFamily:"monospace",
                          color:"var(--text-4)" }}>{fmt(Number(item.earnedValue||0),currency)}</td>
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
                          {overCommitted && (
                            <span style={{ fontSize:10, fontWeight:800, color:"var(--red)",
                              background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:6,
                              padding:"1px 6px", marginLeft:8, verticalAlign:"middle" }}>
                              OVER PLAN
                            </span>
                          )}
                          {lineTasks[item.id] && (
                            <div style={{ fontSize:10.5, color:"var(--text-4)", marginTop:2 }}>
                              <span title={lineTasks[item.id].names.join("\n")}
                                style={{ borderBottom:"1px dotted var(--border)", cursor:"help" }}>
                                {lineTasks[item.id].count} linked task{lineTasks[item.id].count === 1 ? "" : "s"}
                              </span>
                              {" · "}
                              <span style={{ color: lineTasks[item.id].pct >= 100 ? "var(--green)" : "var(--steel)",
                                fontWeight:600 }}>{lineTasks[item.id].pct}% complete</span>
                              {/* Stored earned value disagreeing with live task
                                  progress means the figure is stale, not wrong. */}
                              {(() => {
                                const planned = Number(item.plannedCost||item.plannedAmount||0)
                                const ev = Number(item.earnedValue||0)
                                const evPct = planned > 0 ? Math.round((ev/planned)*100) : 0
                                return Math.abs(evPct - lineTasks[item.id].pct) > 2 ? (
                                  <span title={`Earned value on this line is ${evPct}% of plan but its tasks are ${lineTasks[item.id].pct}% complete. Recalculate to bring them in line.`}
                                    style={{ color:"var(--amber)", fontWeight:700, marginLeft:6 }}>⚠ stale</span>
                                ) : null
                              })()}
                            </div>
                          )}
                        </td>
                        <td style={{ padding:"10px 14px" }}>
                          <Badge variant="gray">{item.category || "—"}</Badge>
                        </td>
                        <td style={{ padding:"10px 14px", fontSize:13, color:"var(--text-2)", fontFamily:"monospace" }}>
                          {fmt(planned,currency)}
                          {revised && (
                            <div style={{ fontSize:10, color:"var(--text-4)", marginTop:2 }}
                              title="The figure the sponsor approved. The current plan has moved since — usually through an approved change request.">
                              approved {fmt(approved!,currency)}
                              <span style={{ color: planned > approved! ? "var(--amber)" : "var(--green)", fontWeight:600 }}>
                                {" "}({planned > approved! ? "+" : "−"}{fmt(Math.abs(planned - approved!),currency)})
                              </span>
                            </div>
                          )}
                        </td>
                        {/* Earned: value of work done. Not money out — that's Actual.
                            Showing only Planned/Actual made a 30%-complete line with
                            no invoice yet look like nothing had happened. */}
                        <td style={{ padding:"10px 14px", fontSize:13, fontFamily:"monospace",
                          color: earned > 0 ? "var(--steel)" : "var(--text-4)" }}
                          title="Earned value — the value of work completed on this line. It moves with task progress, not with payments.">
                          {fmt(earned,currency)}
                        </td>
                        <td style={{ padding:"10px 14px", fontSize:13, color:"var(--text-2)", fontFamily:"monospace" }}>
                          <button onClick={() => toggleExpenses(item.id)}
                            title="View the expenses behind this amount"
                            style={{ background:"none", border:"none", cursor:"pointer", padding:0,
                              fontSize:13, fontFamily:"monospace",
                              color: actual > 0 ? "var(--steel)" : "var(--text-2)",
                              textDecoration: actual > 0 ? "underline dotted" : "none",
                              textUnderlineOffset:3 }}>
                            {fmt(actual,currency)} {expOpenId === item.id ? "▴" : "▾"}
                          </button>
                          {paidAhead && (
                            <div title={`Paid ${fmt(aheadBy,currency)} more than the value delivered so far on this line. CPI ${lineCPI!.toFixed(2)}. Normal for a contractual advance — the gap closes as the work is delivered. Worth watching if delivery slips.`}
                              style={{ fontSize:10.5, fontWeight:700, marginTop:2, color:"var(--amber)" }}>
                              ⚠ paid {fmt(aheadBy,currency)} ahead of value · CPI {lineCPI!.toFixed(2)}
                            </div>
                          )}
                          {taskEvidence === 0 && earned > 0 && (
                            <div title="No task is linked to this line, so its earned value comes from the project-wide proportional split or from a manual entry — not from measured progress. Link the tasks that consume this line to make the figure mean something."
                              style={{ fontSize:10.5, color:"var(--text-4)", marginTop:2 }}>
                              earned value not measured — no linked tasks
                            </div>
                          )}
                          {underspent && (
                            <div title={committed > 0
                              ? `This line is fully delivered but ${fmt(underBy,currency)} of its value is unpaid, and ${fmt(committed,currency)} is still committed on an open purchase order. That points to an unpaid balance — a final payment or retainage — rather than a saving.`
                              : `This line is fully delivered and cost ${fmt(underBy,currency)} less than the value earned. That is a saving only if every invoice has been received. Confirm nothing is outstanding before counting it.`}
                              style={{ fontSize:10.5, fontWeight:700, marginTop:2,
                                color: committed > 0 ? "var(--amber)" : "var(--green)" }}>
                              {committed > 0
                                ? `⚠ ${fmt(underBy,currency)} delivered but unpaid — likely an outstanding balance`
                                : `✓ delivered ${fmt(underBy,currency)} under plan — confirm no invoices are outstanding`}
                            </div>
                          )}
                          {overspent && (
                            <div title={`This line is fully delivered — it has earned its whole planned value — and cost ${fmt(aheadBy,currency)} more than planned. CPI ${lineCPI!.toFixed(2)}. Unlike an advance, this gap will not close: it is a cost overrun on completed work.`}
                              style={{ fontSize:10.5, fontWeight:700, marginTop:2, color:"var(--red)" }}>
                              ⚠ overspent by {fmt(aheadBy,currency)} on delivered work · CPI {lineCPI!.toFixed(2)}
                            </div>
                          )}
                          {committed > 0 && (
                            <div title={overCommitted
                              ? `Spent + committed is ${Math.round((exposure/planned)*100)}% of this line's plan — the obligation already exceeds the budget.`
                              : "Committed — signed POs on this line, not yet completed"}
                              style={{ fontSize:10.5, fontWeight:700, marginTop:2,
                                color: overCommitted ? "var(--red)" : "var(--amber)" }}>
                              {overCommitted ? "⚠ " : "+"}{fmt(committed,currency)} still committed
                              {overCommitted && planned > 0 && (
                                <span style={{ fontWeight:600 }}>
                                  {" · "}{Math.round((exposure / planned) * 100)}% of plan
                                </span>
                              )}
                            </div>
                          )}
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
                                // Lines created by import or scan carry `name`
                                // only — reading `description` left the field
                                // blank, and saving a blank one failed silently.
                                description:   item.name || item.description || "",
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
                            <label title={t("Scan a receipt or invoice (PDF or photo) — AI posts the expense on this line")}
                              style={{ fontSize:11, color:"var(--text-2)", background:"none",
                                border:"1px solid var(--border)", borderRadius:4,
                                cursor: receiptBusyId ? "wait" : "pointer",
                                fontFamily:"var(--font)", padding:"3px 8px" }}>
                              {receiptBusyId === item.id ? "…" : "🧾"}
                              <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp"
                                style={{ display:"none" }} disabled={!!receiptBusyId}
                                onChange={e => { const f = e.target.files?.[0]
                                  if (f) scanReceipt(item.id, f); e.target.value = "" }} />
                            </label>
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
                  {expOpenId === item.id && (
                    <tr>
                      <td colSpan={6} style={{ padding:"0 14px 12px", background:"var(--surface,#F8FAFC)" }}>
                        <div style={{ border:"1px solid var(--border)", borderRadius:8, padding:"8px 12px",
                          background:"#fff" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"var(--text-3)",
                            textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>
                            Expenses on this line
                          </div>
                          {expBusy && !expList && <div style={{ fontSize:12, color:"var(--text-3)" }}>Loading…</div>}
                          {expList && expList.length === 0 && (
                            <div style={{ fontSize:12, color:"var(--text-3)" }}>
                              No expense records — this Actual was entered manually.
                            </div>
                          )}
                          {(expList || []).map(ex => (
                            <div key={ex.id} style={{ display:"flex", alignItems:"flex-start", gap:10,
                              padding:"6px 0", borderTop:"1px solid var(--surface-1,#F1F5F9)", fontSize:12.5 }}>
                              <span style={{ color:"var(--text-3)", width:78, flexShrink:0 }}>
                                {ex.date ? new Date(ex.date).toLocaleDateString("en-US",{ month:"short", day:"numeric", timeZone:"UTC" }) : "—"}
                              </span>
                              <span style={{ flex:1, minWidth:0, whiteSpace:"normal",
                                overflowWrap:"anywhere", lineHeight:1.45 }}>{ex.description}</span>
                              {ex.receiptUrl && (
                                <a href={ex.receiptUrl} target="_blank" rel="noreferrer"
                                  style={{ fontSize:11.5, color:"var(--steel)" }}>receipt</a>
                              )}
                              <span style={{ fontFamily:"monospace", fontWeight:600 }}>
                                {fmt(ex.amount, currency)}
                              </span>
                              {can("budget:edit") && (
                                <button onClick={() => deleteExpense(item.id, ex.id, ex.amount)}
                                  disabled={expBusy}
                                  title="Delete this expense"
                                  style={{ border:"1px solid #FECACA", background:"none", color:"var(--red)",
                                    borderRadius:4, fontSize:11, cursor:"pointer", padding:"2px 7px",
                                    fontFamily:"var(--font)" }}>✕</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>)
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
                    <label title="Post this amount as an expense automatically every month"
                      style={{ display:"flex", alignItems:"center", gap:5, fontSize:11,
                        color:"var(--text-3)", cursor:"pointer", whiteSpace:"nowrap" }}>
                      <input type="checkbox" checked={newItem.recurrence}
                        onChange={e=>setNewItem(f=>({...f,recurrence:e.target.checked}))} />
                      {t("Monthly")}
                    </label>
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
          </div>
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
