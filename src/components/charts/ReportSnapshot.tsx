"use client"
// src/components/charts/ReportSnapshot.tsx
// The report view's Performance Snapshot — same data as the PDF section,
// rendered live with the instrument-glass treatment, tuned to sit inside the
// report's paper layout (respects the report's --r-accent theming).
// Loaded via next/dynamic (ssr:false) from ProjectReportsTab.

import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts"
import { TOOLTIP, GRID, AXIS, ChartDefs, ChartStyle, beaconDot } from "./theme"

const money = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K`
  : `$${Math.round(n)}`

export interface ReportSnapshotData {
  scurve?: { label: string; pv: number; ev: number; ac: number }[]
  statusCounts?: { label: string; count: number; hex: string }[]
  budget?: { bac: number; ac: number; eac: number }
}

export default function ReportSnapshot({ data, accent, accent2 }: {
  data: ReportSnapshotData
  accent: string
  accent2: string
}) {
  const { scurve, statusCounts, budget } = data
  const hasCurve = !!scurve && scurve.length >= 2
  if (!hasCurve && !statusCounts?.length && !budget) return null
  const last = (scurve?.length || 1) - 1
  const total = (statusCounts || []).reduce((s, c) => s + c.count, 0)
  const over = budget ? budget.eac > budget.bac : false
  const max = budget ? Math.max(budget.bac, budget.eac, budget.ac) * 1.05 : 1
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`

  return (
    <div>
      <ChartStyle />
      {hasCurve && (
        <ResponsiveContainer width="100%" height={190}>
          <ComposedChart data={scurve} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}
            style={{ ["--fsq-a" as any]: `${accent}55`, ["--fsq-b" as any]: `${accent2}55` }}>
            <ChartDefs p="rs" brand={accent} brand2={accent2} />
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={34} dy={4} />
            <YAxis tickFormatter={money} tick={AXIS} tickLine={false} axisLine={false} width={46} />
            <Tooltip formatter={(v: number) => money(v)} contentStyle={TOOLTIP}
              labelStyle={{ fontWeight: 700, color: "#0F172A" }}
              cursor={{ stroke: "rgba(100,116,139,.25)", strokeDasharray: "3 4" }} />
            <Legend wrapperStyle={{ fontSize: 11.5 }} iconType="plainline" />
            <Area name="Planned value" dataKey="pv" stroke="#94A3B8" strokeWidth={1.4}
              strokeDasharray="5 5" fill="url(#rs-slate)" dot={false} animationDuration={800} />
            <Area name="Earned value" dataKey="ev" stroke={accent} strokeWidth={2.4}
              strokeLinecap="round" className="fsq-glow-a" fill="url(#rs-brand)"
              dot={beaconDot(accent, last)} animationDuration={1000} />
            <Line name="Actual cost" dataKey="ac" stroke={accent2} strokeWidth={2.4}
              strokeLinecap="round" className="fsq-glow-b"
              dot={beaconDot(accent2, last)} animationDuration={1200} />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {!!statusCounts?.length && total > 0 && (
        <div style={{ margin: "14px 0 4px" }}>
          <div style={{ display: "flex", height: 12, borderRadius: 7, overflow: "hidden",
            boxShadow: "inset 0 1px 2px rgba(13,27,42,.08)" }}>
            {statusCounts.map(c => (
              <div key={c.label} title={`${c.label}: ${c.count}`}
                style={{ width: `${(c.count / total) * 100}%`,
                  background: `linear-gradient(180deg, ${c.hex}, ${c.hex}CC)` }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 7 }}>
            {statusCounts.map(c => (
              <span key={c.label} style={{ display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11.5, color: "#475569" }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: c.hex,
                  boxShadow: `0 0 5px ${c.hex}55` }} />
                {c.label} ({c.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {budget && budget.bac > 0 && (
        <div style={{ padding: "26px 2px 4px" }}>
          <div style={{ position: "relative", height: 22,
            background: "linear-gradient(180deg, rgba(148,163,184,.14), rgba(148,163,184,.08))",
            borderRadius: 7, boxShadow: "inset 0 1px 3px rgba(13,27,42,.08)" }}>
            <div style={{ position: "absolute", inset: "4px auto 4px 4px",
              width: `calc(${pct(budget.ac)} - 4px)`,
              background: `linear-gradient(90deg, ${over ? "#DC2626" : accent}CC, ${over ? "#DC2626" : accent})`,
              borderRadius: 5, boxShadow: `0 0 10px ${over ? "#DC2626" : accent}44` }} />
            <div style={{ position: "absolute", top: -5, bottom: -5, left: pct(budget.eac), width: 2.5,
              background: over ? "#DC2626" : "#059669", borderRadius: 2,
              boxShadow: `0 0 7px ${over ? "#DC2626" : "#059669"}88` }}>
              <span style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
                fontSize: 9.5, fontWeight: 700, color: over ? "#DC2626" : "#059669", whiteSpace: "nowrap" }}>
                EAC {money(budget.eac)}
              </span>
            </div>
            <div style={{ position: "absolute", top: -5, bottom: -5, left: pct(budget.bac), width: 2.5,
              background: "#0D1B2A", borderRadius: 2 }}>
              <span style={{ position: "absolute", bottom: -16, left: "50%", transform: "translateX(-50%)",
                fontSize: 9.5, fontWeight: 700, color: "#0D1B2A", whiteSpace: "nowrap" }}>
                Budget {money(budget.bac)}
              </span>
            </div>
          </div>
          <div style={{ marginTop: 22, fontSize: 11.5, color: "#64748B" }}>
            Spent <b style={{ color: "#0F172A" }}>{money(budget.ac)}</b> · {Math.round((budget.ac / budget.bac) * 100)}% of budget
          </div>
        </div>
      )}
    </div>
  )
}
