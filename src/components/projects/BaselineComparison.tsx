"use client"
// src/components/projects/BaselineComparison.tsx
// PM Standard — Schedule Variance Analysis (Baseline vs Actual)
// Compares each task's current schedule against the approved baseline snapshot.
// Variance (days): positive = later than baseline (slip), negative = ahead.

import { useMemo, useState } from "react"

function toDate(d: any): Date | null { return d ? new Date(d) : null }
function fmtD(d: any): string {
  return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"
}
function dayVar(orig: any, cur: any): number | null {
  const a = toDate(orig), b = toDate(cur)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
function band(v: number | null): { color: string; bg: string; label: string } {
  if (v === null)  return { color: "#94A3B8", bg: "#F1F5F9", label: "No data" }
  if (v <= 0)      return { color: "#059669", bg: "#DCFCE7", label: v < 0 ? "Ahead" : "On track" }
  if (v <= 7)      return { color: "#B45309", bg: "#FEF3C7", label: "Minor slip" }
  return             { color: "#DC2626", bg: "#FEE2E2", label: "At risk" }
}
function fmtVar(v: number | null): string {
  if (v === null) return "—"
  if (v === 0) return "0d"
  return (v > 0 ? "+" : "") + v + "d"
}

export function BaselineComparison({ baselines, tasks }: { baselines: any[]; tasks: any[] }) {
  const approved = useMemo(() =>
    (baselines || [])
      .filter(b => b.isApproved)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [baselines]
  )

  const [selId, setSelId] = useState<string>(() => {
    const withSnap = approved.find(b => (b.snapshotData as any)?.tasks?.length)
    return (withSnap || approved[0])?.id || ""
  })

  const baseline = approved.find(b => b.id === selId) || approved[0] || null
  const snapTasks: any[] = (baseline?.snapshotData as any)?.tasks || (baseline as any)?.tasks || []
  const liveById = useMemo(() => new Map((tasks || []).map(t => [t.id, t])), [tasks])

  const rows = useMemo(() => snapTasks.map((s: any) => {
    const key = s.taskId || s.id
    const live = liveById.get(key)
    const origStart = s.startDate || s.plannedStart
    const origEnd   = s.dueDate   || s.plannedEnd
    return {
      code:      live?.code || s.code || "—",
      title:     live?.title || s.title || "Untitled task",
      origStart, origEnd,
      curStart:  live?.startDate ?? null,
      curEnd:    live?.dueDate ?? null,
      status:    live?.status,
      startVar:  dayVar(origStart, live?.startDate),
      finishVar: dayVar(origEnd, live?.dueDate),
      missing:   !live,
    }
  }), [snapTasks, liveById])

  const onTrack = rows.filter(r => r.finishVar !== null && r.finishVar <= 0).length
  const minor   = rows.filter(r => r.finishVar !== null && r.finishVar > 0 && r.finishVar <= 7).length
  const atRisk  = rows.filter(r => r.finishVar !== null && r.finishVar > 7).length
  const totalSlip = rows.reduce((sum, r) => sum + (r.finishVar && r.finishVar > 0 ? r.finishVar : 0), 0)

  if (approved.length === 0) {
    return (
      <div style={{ padding: "28px 20px", textAlign: "center", color: "var(--text-3)",
        fontSize: 13, border: "1px dashed var(--border)", borderRadius: "var(--radius)",
        background: "#fff" }}>
        No approved baseline yet. Approve a baseline with task snapshots to compare current
        schedule against it.
      </div>
    )
  }

  const th: React.CSSProperties = {
    padding: "8px 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".04em",
    color: "rgba(255,255,255,.75)", textAlign: "left", whiteSpace: "nowrap",
  }
  const td: React.CSSProperties = {
    padding: "7px 10px", fontSize: 12, color: "var(--text-2)", borderBottom: "1px solid #F1F5F9",
    whiteSpace: "nowrap",
  }

  const summary = [
    { label: "On track / ahead", value: onTrack, color: "#059669", bg: "#DCFCE7" },
    { label: "Minor slip (1–7d)", value: minor, color: "#B45309", bg: "#FEF3C7" },
    { label: "At risk (>7d)",     value: atRisk, color: "#DC2626", bg: "#FEE2E2" },
    { label: "Total schedule slip", value: totalSlip + "d", color: "#1B6CA8", bg: "#DBEAFE" },
  ]

  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", overflow: "hidden" }}>

      {/* Header + baseline selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, padding: "12px 14px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>
          Baseline vs Actual — Schedule Variance
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>Baseline:</span>
          <select value={selId} onChange={e => setSelId(e.target.value)}
            style={{ padding: "5px 8px", fontSize: 12, border: "1px solid var(--border)",
              borderRadius: "var(--radius)", fontFamily: "var(--font)", background: "#fff",
              color: "var(--text-2)" }}>
            {approved.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: "flex", gap: 10, padding: "12px 14px", flexWrap: "wrap",
        borderBottom: "1px solid var(--border)", background: "#FAFBFC" }}>
        {summary.map(s => (
          <div key={s.label} style={{ flex: "1 1 140px", minWidth: 140, background: s.bg,
            borderRadius: "var(--radius)", padding: "10px 12px" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: s.color, opacity: .85, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#1a3a5c" }}>
              <th style={th}>TASK</th>
              <th style={th}>BASELINE START</th>
              <th style={th}>CURRENT START</th>
              <th style={{ ...th, textAlign: "right" }}>Δ START</th>
              <th style={th}>BASELINE FINISH</th>
              <th style={th}>CURRENT FINISH</th>
              <th style={{ ...th, textAlign: "right" }}>Δ FINISH</th>
              <th style={{ ...th, textAlign: "center" }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td style={{ ...td, textAlign: "center", color: "var(--text-3)" }} colSpan={8}>
                This baseline has no task snapshots to compare.
              </td></tr>
            )}
            {rows.map((r, i) => {
              const fb = band(r.finishVar)
              const sb = band(r.startVar)
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                  <td style={td}>
                    <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700,
                      color: "#1B6CA8", background: "#EFF6FF", padding: "1px 6px",
                      borderRadius: 4, marginRight: 6 }}>{r.code}</span>
                    {String(r.title).slice(0, 40)}{String(r.title).length > 40 ? "…" : ""}
                    {r.missing && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: "#DC2626" }}>(removed)</span>
                    )}
                  </td>
                  <td style={td}>{fmtD(r.origStart)}</td>
                  <td style={td}>{fmtD(r.curStart)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600, color: sb.color }}>
                    {fmtVar(r.startVar)}
                  </td>
                  <td style={td}>{fmtD(r.origEnd)}</td>
                  <td style={td}>{fmtD(r.curEnd)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: fb.color }}>
                    {fmtVar(r.finishVar)}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: fb.color,
                      background: fb.bg, padding: "2px 8px", borderRadius: 10 }}>{fb.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
