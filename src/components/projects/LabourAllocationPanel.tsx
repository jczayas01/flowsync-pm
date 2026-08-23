"use client"
// src/components/projects/LabourAllocationPanel.tsx
// Plan labour cost across the whole project in one screen.
//
// Every task with an estimate and rated assignees produces a planned labour
// cost (hours split across assignees × each one's cost rate). Here you choose
// where each task's labour charges — a consolidated Labour Total line, its own
// line, or any existing line — and Sync writes the figures into the budget.
//
// Sync is a SET, never an ADD: each target line's planned cost is recomputed as
// the sum of the tasks pointing at it. Press it as often as you like; change an
// estimate or a rate and press it again. That is what makes it safe to run as
// a routine, unlike incrementing a line by hand.
//
// The destination is stored as task.budgetItemId — the same control account the
// time log and postLaborActuals already use, so planned and actual land on the
// same line by construction.

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"

const TOTAL_LINE = "Labour — Total"          // canonical name of the consolidated line
const ownLineName = (code: string, title: string) =>
  `Labour — ${code || "task"} ${title}`.slice(0, 120).trim()

type Member = { userId: string; name: string; costRate: number | null }
type Task = { id: string; code?: string | null; title: string; estimatedHours?: any
  percentComplete?: number | null; budgetItemId?: string | null
  assignees?: { userId: string }[] }
type Line = { id: string; name: string; category?: string; plannedCost?: number }

export function LabourAllocationPanel({ projectId, workspaceId, canEdit, onChanged }: {
  projectId: string; workspaceId?: string; canEdit: boolean; onChanged?: () => void
}) {
  const t = useTranslations("labourAlloc")
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [dest, setDest] = useState<Record<string, string>>({})   // taskId → destination token
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const hdr = (): Record<string, string> => (workspaceId ? { "x-workspace-id": workspaceId } : {})
  const H = (): Record<string, string> => ({ "Content-Type": "application/json", ...hdr() })

  async function load() {
    setLoading(true)
    try {
      const [tr, mr, br] = await Promise.all([
        fetch(`/api/tasks?projectId=${projectId}&perPage=200`, { headers: hdr(), cache: "no-store" }),
        fetch(`/api/users?perPage=100`, { headers: hdr(), cache: "no-store" }),
        fetch(`/api/projects/${projectId}/budget`, { headers: hdr(), cache: "no-store" }),
      ])
      const td = await tr.json().catch(() => ({}))
      const md = await mr.json().catch(() => ({}))
      const bd = await br.json().catch(() => ({}))
      const tks: Task[] = td?.data?.items || td?.data || td?.items || []
      const mem: Member[] = (md?.data || md?.items || []).map((m: any) => ({
        userId: m.userId || m.user?.id, name: m.user?.name || m.name,
        costRate: m.costRate == null ? null : Number(m.costRate),
      })).filter((m: Member) => m.userId)
      const bls: Line[] = (bd?.data?.items || bd?.data || bd?.items || []).map((b: any) => ({
        id: b.id, name: b.name, category: b.category,
        plannedCost: Number(b.plannedCost || 0),
      }))
      setTasks(tks); setMembers(mem); setLines(bls)

      // Destination is inferred from where the task already points — that IS
      // the stored choice, so no extra column is needed to remember it.
      const seed: Record<string, string> = {}
      for (const tk of tks) {
        if (!tk.budgetItemId) { seed[tk.id] = ""; continue }
        const line = bls.find(b => b.id === tk.budgetItemId)
        if (!line) { seed[tk.id] = "" }
        else if (line.name === TOTAL_LINE) seed[tk.id] = "TOTAL"
        else if (line.name === ownLineName(tk.code || "", tk.title)) seed[tk.id] = "OWN"
        else seed[tk.id] = line.id
      }
      setDest(seed)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId])

  /** Planned labour for a task: estimate split across assignees, each at their
   *  own cost rate. Assignees without a rate contribute nothing and are flagged. */
  const plannedFor = (tk: Task) => {
    const est = Number(tk.estimatedHours || 0)
    const ass = tk.assignees || []
    if (!est || !ass.length) return { cost: 0, hours: est, missing: ass.length ? 0 : 1, detail: "" }
    const share = est / ass.length
    let cost = 0, missing = 0
    const parts: string[] = []
    for (const a of ass) {
      const m = members.find(x => x.userId === a.userId)
      if (m?.costRate == null) { missing++; continue }
      cost += share * m.costRate
      parts.push(`${share.toFixed(1)}h × $${m.costRate}`)
    }
    return { cost, hours: est, missing, detail: parts.join(" + ") }
  }

  const rows = useMemo(() => tasks
    .map(tk => ({ tk, ...plannedFor(tk) }))
    .filter(r => r.hours > 0)
    .sort((a, b) => b.cost - a.cost), [tasks, members])

  // Manual LABOR lines that Sync does not own would sit alongside the synced
  // figure and count the same work twice. The classic case: a hand-entered
  // "Internal project labour" line plus a synced Labour Total. Adopting the
  // manual line (renaming it to the canonical name) keeps the approved number
  // and the detailed calculation in the same place, so baseline variance still
  // tells you whether the detail broke the approved budget.
  const managedName = (n: string) => n === TOTAL_LINE || n.startsWith("Labour — ")
  const orphanLabourLines = useMemo(() =>
    lines.filter(b => String(b.category || "").toUpperCase() === "LABOR" && !managedName(b.name)),
    [lines])
  const hasTotalTarget = rows.some(r => dest[r.tk.id] === "TOTAL")
  const totalLineExists = lines.some(b => b.name === TOTAL_LINE)

  // Two different totals, and the difference matters. Charged labour becomes
  // budget (part of BAC, drives EVM). Tracked-only labour is real cost the
  // organization absorbs elsewhere — salaried staff whose time never hits the
  // project's approved budget. Hiding it would understate what delivery
  // actually costs; folding it into the budget would overstate BAC. So it is
  // reported beside the budget, never inside it.
  const selectedTotal = rows.reduce((s, r) => s + (dest[r.tk.id] ? r.cost : 0), 0)
  const trackedOnly   = rows.reduce((s, r) => s + (dest[r.tk.id] ? 0 : r.cost), 0)
  const grandTotal = rows.reduce((s, r) => s + r.cost, 0)
  const unassigned = rows.filter(r => r.cost > 0 && !dest[r.tk.id]).length
  const noRate = rows.filter(r => r.missing > 0).length

  /** Adopt a manual labour line: rename it to the canonical name so Sync
   *  maintains it from here on. Its approved planned figure stays until the
   *  first Sync overwrites it with the calculated total — and the baseline
   *  keeps the original for variance. */
  async function adopt(line: Line) {
    if (!confirm(t("adoptConfirm", { name: line.name,
      planned: Number(line.plannedCost || 0).toLocaleString("en-US"),
      calculated: selectedTotal.toLocaleString("en-US", { maximumFractionDigits: 0 }) }))) return
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(`/api/projects/${projectId}/budget/${line.id}`, {
        method: "PATCH", headers: H(),
        body: JSON.stringify({ description: TOTAL_LINE, category: "LABOR" }) })
      if (!r.ok) { setMsg({ ok: false, text: t("adoptFailed") }); return }
      // Point every unallocated task at the consolidated line — adopting is a
      // statement that this line holds the project's labour.
      const next = { ...dest }
      for (const row of rows) if (!next[row.tk.id] && row.cost > 0) next[row.tk.id] = "TOTAL"
      setDest(next)
      await load()
      setMsg({ ok: true, text: t("adopted", { name: line.name }) })
    } finally { setBusy(false) }
  }

  /** Sync: create any missing target lines, then SET each target's planned cost
   *  to the sum of the tasks pointing at it. Idempotent by construction. */
  async function sync() {
    if (!canEdit || busy) return
    if (orphanLabourLines.length > 0 && hasTotalTarget &&
        !confirm(t("syncAnywayConfirm", { n: orphanLabourLines.length }))) return
    setBusy(true); setMsg(null)
    try {
      let current = [...lines]
      const ensureLine = async (name: string, note: string): Promise<string | null> => {
        const found = current.find(b => b.name === name)
        if (found) return found.id
        const r = await fetch(`/api/projects/${projectId}/budget`, {
          method: "POST", headers: H(),
          body: JSON.stringify({ description: name, category: "LABOR", plannedAmount: 0, notes: note }),
        })
        const d = await r.json().catch(() => ({}))
        const id = d?.data?.id
        if (id) current.push({ id, name, plannedCost: 0 })
        return id || null
      }

      // 1. Resolve every task's target line id, creating lines as needed.
      const targetOf: Record<string, string> = {}
      for (const r of rows) {
        const choice = dest[r.tk.id]
        if (!choice) continue
        if (choice === "TOTAL") {
          const id = await ensureLine(TOTAL_LINE, t("totalLineNote"))
          if (id) targetOf[r.tk.id] = id
        } else if (choice === "OWN") {
          const id = await ensureLine(ownLineName(r.tk.code || "", r.tk.title), t("ownLineNote"))
          if (id) targetOf[r.tk.id] = id
        } else {
          targetOf[r.tk.id] = choice
        }
      }

      // 2. Point each task at its line — planned and actual then share a line.
      for (const r of rows) {
        const want = targetOf[r.tk.id] || null
        if ((r.tk.budgetItemId || null) === want) continue
        await fetch(`/api/tasks/${r.tk.id}`, { method: "PATCH", headers: H(),
          body: JSON.stringify({ budgetItemId: want }) }).catch(() => {})
      }

      // 3. Set each labour target's planned cost to the sum of its tasks.
      const sums: Record<string, number> = {}
      for (const r of rows) {
        const id = targetOf[r.tk.id]
        if (!id) continue
        sums[id] = (sums[id] || 0) + r.cost
      }
      let written = 0
      for (const [lineId, amount] of Object.entries(sums)) {
        const line = current.find(b => b.id === lineId)
        // Only overwrite lines this panel owns. A vendor line keeps its own
        // planned figure; pointing labour at it records the charge target
        // without silently rewriting a number somebody negotiated.
        const owned = line && (line.name === TOTAL_LINE || line.name.startsWith("Labour — "))
        if (!owned) continue
        const r = await fetch(`/api/projects/${projectId}/budget/${lineId}`, {
          method: "PATCH", headers: H(),
          body: JSON.stringify({ plannedAmount: Math.round(amount * 100) / 100 }),
        })
        if (r.ok) written++
      }
      setMsg({ ok: true, text: t("synced", { n: written, amount: selectedTotal.toLocaleString("en-US", { maximumFractionDigits: 0 }) }) })
      await load(); onChanged?.()
      setTimeout(() => setMsg(null), 8000)
    } finally { setBusy(false) }
  }

  const th: React.CSSProperties = { padding: "8px 10px", fontSize: 10, fontWeight: 700,
    color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em",
    borderBottom: "1.5px solid var(--border)", whiteSpace: "nowrap" }
  const td: React.CSSProperties = { padding: "7px 10px", fontSize: 12.5,
    borderBottom: "1px solid var(--surface-1,#F1F5F9)", verticalAlign: "middle" }
  const num: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }

  if (loading) return <div style={{ padding: 16, fontSize: 13, color: "var(--text-3)" }}>…</div>

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{t("title")}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{t("intro")}</div>
        </div>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {unassigned > 0 && <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{t("trackedCount", { n: unassigned })}</span>}
          {noRate > 0 && <span style={{ fontSize: 11.5, color: "#B45309" }}>{t("noRate", { n: noRate })}</span>}
          <button onClick={sync} disabled={!canEdit || busy}
            style={{ padding: "8px 16px", fontSize: 12.5, fontWeight: 700, borderRadius: 6,
              border: "none", background: "var(--steel)", color: "#fff",
              cursor: busy ? "wait" : "pointer", fontFamily: "var(--font)" }}>
            {busy ? "…" : t("sync")}
          </button>
        </span>
      </div>

      {orphanLabourLines.length > 0 && (hasTotalTarget || totalLineExists) && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 8,
          padding: "11px 13px", marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>
            ⚠ {t("dupTitle")}
          </div>
          <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.6, marginBottom: 8 }}>
            {t("dupBody")}
          </div>
          {orphanLabourLines.map(b => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "6px 0", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "#78350F", fontWeight: 600 }}>{b.name}</span>
              <span style={{ fontSize: 12, color: "#92400E", fontVariantNumeric: "tabular-nums" }}>
                ${Number(b.plannedCost || 0).toLocaleString("en-US")}
              </span>
              {canEdit && (
                <button onClick={() => adopt(b)} disabled={busy}
                  title={t("adoptTitle")}
                  style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, padding: "4px 11px",
                    borderRadius: 6, border: "1px solid #B45309", background: "#fff", color: "#B45309",
                    cursor: busy ? "wait" : "pointer", fontFamily: "var(--font)" }}>
                  {t("adopt")}
                </button>
              )}
            </div>
          ))}
          <div style={{ fontSize: 11, color: "#92400E", marginTop: 6, lineHeight: 1.6 }}>{t("dupHint")}</div>
        </div>
      )}

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
          <thead><tr style={{ background: "var(--surface,#F8FAFC)" }}>
            <th style={{ ...th, textAlign: "left" }}>{t("task")}</th>
            <th style={{ ...th, textAlign: "right" }}>{t("hours")}</th>
            <th style={{ ...th, textAlign: "right" }}>{t("cost")}</th>
            <th style={{ ...th, textAlign: "left", minWidth: 230 }}>{t("chargeTo")}</th>
            <th style={{ ...th, textAlign: "left" }}>{t("currentLine")}</th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const line = lines.find(b => b.id === r.tk.budgetItemId)
              return (
                <tr key={r.tk.id}>
                  <td style={td}>
                    <div style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap", maxWidth: 300 }}>{r.tk.title}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                      {r.tk.code}{r.detail ? ` · ${r.detail}` : ""}
                      {r.missing > 0 && <span style={{ color: "#B45309" }}> · {t("missingRate", { n: r.missing })}</span>}
                    </div>
                  </td>
                  <td style={num}>{Number(r.hours).toFixed(0)} h</td>
                  <td style={{ ...num, fontWeight: 700, color: r.cost > 0 ? "var(--text)" : "var(--text-3)" }}>
                    {r.cost > 0 ? `$${r.cost.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
                  </td>
                  <td style={td}>
                    <select value={dest[r.tk.id] || ""} disabled={!canEdit}
                      onChange={e => setDest({ ...dest, [r.tk.id]: e.target.value })}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 12,
                        border: "1px solid var(--border)", borderRadius: 5, background: "#fff",
                        fontFamily: "var(--font)", cursor: canEdit ? "pointer" : "default" }}>
                      <option value="">{t("destTrackOnly")}</option>
                      <option value="TOTAL">{t("destTotal")}</option>
                      <option value="OWN">{t("destOwn")}</option>
                      {lines.filter(b => b.name !== TOTAL_LINE && !b.name.startsWith("Labour — ")).map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ ...td, fontSize: 11.5, color: line ? "var(--text-2)" : "var(--text-3)" }}>
                    {line ? line.name : t("none")}
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: "center", color: "var(--text-3)", fontSize: 12.5 }}>
                {t("empty")}</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--surface,#F8FAFC)" }}>
              <td style={{ ...td, fontWeight: 700, borderBottom: "none" }}>{t("chargedRow")}</td>
              <td style={{ ...num, borderBottom: "none" }} />
              <td style={{ ...num, fontWeight: 800, fontSize: 14, borderBottom: "none" }}>
                ${selectedTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </td>
              <td colSpan={2} style={{ ...td, fontSize: 11, color: "var(--text-3)", borderBottom: "none" }}>
                {t("chargedHint")}
              </td>
            </tr>
            {trackedOnly > 0 && (
              <tr style={{ background: "#FFFBEB" }}>
                <td style={{ ...td, fontWeight: 700, color: "#92400E", borderBottom: "none" }}>
                  {t("trackedRow")}</td>
                <td style={{ ...num, borderBottom: "none" }} />
                <td style={{ ...num, fontWeight: 800, fontSize: 14, color: "#B45309", borderBottom: "none" }}>
                  ${trackedOnly.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
                <td colSpan={2} style={{ ...td, fontSize: 11, color: "#92400E", borderBottom: "none" }}>
                  {t("trackedHint")}
                </td>
              </tr>
            )}
            {trackedOnly > 0 && (
              <tr style={{ background: "var(--surface,#F8FAFC)", borderTop: "2px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 700, borderBottom: "none" }}>{t("trueCostRow")}</td>
                <td style={{ ...num, borderBottom: "none" }} />
                <td style={{ ...num, fontWeight: 800, fontSize: 14, borderBottom: "none" }}>
                  ${grandTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
                <td colSpan={2} style={{ ...td, fontSize: 11, color: "var(--text-3)", borderBottom: "none" }}>
                  {t("trueCostHint")}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {msg && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600,
        color: msg.ok ? "var(--green,#059669)" : "var(--red,#DC2626)" }}>{msg.ok ? "✓ " : "✗ "}{msg.text}</div>}

      <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 10, lineHeight: 1.7 }}>
        {t("note1")}<br />{t("note2")}
      </div>
    </div>
  )
}
