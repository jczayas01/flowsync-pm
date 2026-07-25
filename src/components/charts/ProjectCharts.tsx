"use client"
import type { ReactNode } from "react"
// src/components/charts/ProjectCharts.tsx
// Performance charts for the project dashboard. Loaded via next/dynamic
// (ssr:false) so recharts never blocks first paint or the server bundle.

import {
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Line,
  Tooltip, Legend, ReferenceLine, PieChart, Pie, Cell, AreaChart, Area, ComposedChart,
} from "recharts"
import { CARD, cardTitle, TOOLTIP, GRID, AXIS, INK, ChartDefs, ChartStyle, beaconDot } from "./theme"
import { buildSCurveSeries, buildBurnupSeries } from "@/lib/evm-series"

const NAVY = "#0D1B2A", STEEL = "#1B6CA8", AMBER = "#F59E0B"
const GREEN = "#059669", RED = "#DC2626", SLATE = "#94A3B8", LINE = "#E2E8F0"

const money = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K`
  : `$${Math.round(n)}`

const card = CARD
const Title = ({ accent, children }: { accent: string; children: ReactNode }) => {
  const [row, dot, text] = cardTitle(accent)
  return <div style={row}><span style={dot} /><span style={text}>{children}</span></div>
}

// ── S-curve ──────────────────────────────────────────────────────────────
function SCurve({ series, brand, brand2, labels }: {
  series: ReturnType<typeof buildSCurveSeries>
  brand: string; brand2: string
  labels: { title: string; pv: string; ev: string; ac: string; today: string }
}) {
  if (series.length < 2) return null
  const now = Date.now()
  const showToday = now >= series[0].t && now <= series[series.length - 1].t
  const last = series.length - 1
  return (
    <div style={card as any}>
      <ChartStyle />
      <Title accent={brand}>{labels.title}</Title>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={series} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}
          style={{ ["--fsq-a" as any]: `${brand}55`, ["--fsq-b" as any]: `${brand2}55` }}>
          <ChartDefs p="sc" brand={brand} brand2={brand2} />
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={30} dy={4} />
          <YAxis tickFormatter={money} tick={AXIS} tickLine={false} axisLine={false} width={50} />
          <Tooltip formatter={(v: number) => money(v)} labelStyle={{ fontWeight: 700, color: "#0F172A" }}
            contentStyle={TOOLTIP} cursor={{ stroke: "rgba(100,116,139,.25)", strokeDasharray: "3 4" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
          {showToday && (
            <ReferenceLine x={series.reduce((best, p) => Math.abs(p.t - now) < Math.abs(best.t - now) ? p : best).label}
              stroke="#0D1B2A" strokeOpacity={.35} strokeDasharray="3 4"
              label={{ value: labels.today, position: "top", fontSize: 10, fill: "#0D1B2A" }} />
          )}
          <Area name={labels.pv} dataKey="pv" stroke="#94A3B8" strokeWidth={1.5}
            strokeDasharray="5 5" fill="url(#sc-slate)" dot={false} animationDuration={900} />
          <Area name={labels.ev} dataKey="ev" stroke={brand} strokeWidth={2.5}
            strokeLinecap="round" className="fsq-glow-a" fill="url(#sc-brand)"
            dot={beaconDot(brand, last)} animationDuration={1100} />
          <Line name={labels.ac} dataKey="ac" stroke={brand2} strokeWidth={2.5}
            strokeLinecap="round" className="fsq-glow-b"
            dot={beaconDot(brand2, last)} animationDuration={1300} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Burnup ───────────────────────────────────────────────────────────────
function Burnup({ series, brand, labels }: {
  series: ReturnType<typeof buildBurnupSeries>
  brand: string
  labels: { title: string; done: string; scope: string; ideal: string }
}) {
  if (series.length < 2) return null
  const last = series.length - 1
  return (
    <div style={card as any}>
      <Title accent={brand}>{labels.title}</Title>
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
          style={{ ["--fsq-a" as any]: `${brand}55` }}>
          <ChartDefs p="bu" brand={brand} brand2="#059669" />
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={30} dy={4} />
          <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={32} />
          <Tooltip contentStyle={TOOLTIP} labelStyle={{ fontWeight: 700, color: "#0F172A" }}
            cursor={{ stroke: "rgba(100,116,139,.25)", strokeDasharray: "3 4" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
          <Area name={labels.scope} dataKey="scope" stroke="#94A3B8" strokeWidth={1.2}
            fill="url(#bu-slate)" dot={false} animationDuration={900} />
          <Line name={labels.ideal} dataKey="ideal" stroke="#059669" strokeWidth={1.5}
            strokeDasharray="5 5" className="fsq-glow-g" dot={false} animationDuration={1000} />
          <Area name={labels.done} dataKey="done" stroke={brand} strokeWidth={2.5}
            strokeLinecap="round" className="fsq-glow-a" fill="url(#bu-brand)"
            dot={beaconDot(brand, last)} animationDuration={1200} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Task status donut ────────────────────────────────────────────────────
const STATUS_META: [string, string, string][] = [
  ["DONE",        "Done",        GREEN],
  ["IN_PROGRESS", "In progress", STEEL],
  ["IN_REVIEW",   "In review",   "#7C3AED"],
  ["BLOCKED",     "Blocked",     RED],
  ["TODO",        "To do",       SLATE],
]

function StatusDonut({ tasks, title, t }: { tasks: any[]; title: string; t: (k: string) => string }) {
  const data = STATUS_META
    .map(([key, name, color]) => ({ name: t(name), color, value: tasks.filter(x => x.status === key).length }))
    .filter(s => s.value > 0)
  if (!data.length) return null
  return (
    <div style={card as any}>
      <Title accent={STEEL}>{title}</Title>
      <div style={{ position: "relative" }}>
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            {/* recessed track */}
            <Pie data={[{ value: 1 }]} dataKey="value" innerRadius={62} outerRadius={88}
              fill="rgba(148,163,184,.12)" stroke="none" isAnimationActive={false} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88}
              paddingAngle={2.5} cornerRadius={7} strokeWidth={0} animationDuration={900}>
              {data.map(s => (
                <Cell key={s.name} fill={s.color}
                  style={{ filter: `drop-shadow(0 2px 6px ${s.color}33)` }} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", top: 84, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: INK, letterSpacing: "-.02em" }}>{tasks.length}</div>
          <div style={{ fontSize: 10, color: "#94A3B8", letterSpacing: ".12em", fontWeight: 600 }}>{t("TASKS")}</div>
        </div>
      </div>
    </div>
  )
}

// ── Budget bullet ────────────────────────────────────────────────────────
function BudgetBullet({ bac, ac, eac, title, labels }: {
  bac: number; ac: number; eac: number; title: string
  labels: { spent: string; eac: string; budget: string }
}) {
  if (bac <= 0) return null
  const max = Math.max(bac, eac, ac) * 1.05
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`
  const over = eac > bac
  const barColor = over ? RED : STEEL
  return (
    <div style={{ ...(card as any), paddingBottom: 16 }}>
      <Title accent={over ? RED : GREEN}>{title}</Title>
      <div style={{ padding: "28px 4px 6px" }}>
        <div style={{ position: "relative", height: 28,
          background: "linear-gradient(180deg, rgba(148,163,184,.14), rgba(148,163,184,.08))",
          borderRadius: 9, boxShadow: "inset 0 1px 3px rgba(13,27,42,.08)" }}>
          {/* AC bar */}
          <div style={{ position: "absolute", inset: "5px auto 5px 5px", width: `calc(${pct(ac)} - 5px)`,
            background: `linear-gradient(90deg, ${barColor}CC, ${barColor})`,
            borderRadius: 6, transition: "width .5s cubic-bezier(.2,.7,.3,1)",
            boxShadow: `0 0 12px ${barColor}44` }} />
          {/* EAC marker */}
          <div style={{ position: "absolute", top: -6, bottom: -6, left: pct(eac), width: 2.5,
            background: over ? RED : GREEN, borderRadius: 2,
            boxShadow: `0 0 8px ${over ? RED : GREEN}88` }}>
            <span style={{ position: "absolute", top: -17, left: "50%", transform: "translateX(-50%)",
              fontSize: 10, fontWeight: 700, color: over ? RED : GREEN, whiteSpace: "nowrap" }}>
              {labels.eac} {money(eac)}
            </span>
          </div>
          {/* BAC marker */}
          <div style={{ position: "absolute", top: -6, bottom: -6, left: pct(bac), width: 2.5,
            background: NAVY, borderRadius: 2 }}>
            <span style={{ position: "absolute", bottom: -17, left: "50%", transform: "translateX(-50%)",
              fontSize: 10, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>
              {labels.budget} {money(bac)}
            </span>
          </div>
        </div>
        <div style={{ marginTop: 26, fontSize: 12, color: "#94A3B8" }}>
          {labels.spent}: <b style={{ color: INK }}>{money(ac)}</b>
          <span style={{ margin: "0 6px" }}>·</span>
          {Math.round((ac / bac) * 100)}%
        </div>
      </div>
    </div>
  )
}

// ── Public section ───────────────────────────────────────────────────────
export default function ProjectPerformanceCharts({
  tasks, budgetItems, project, brandColor, brandColor2, t,
}: {
  tasks: any[]
  budgetItems: any[]
  project: any
  brandColor?: string | null
  brandColor2?: string | null
  t: (k: string) => string
}) {
  const brand  = brandColor  || STEEL
  const brand2 = brandColor2 || AMBER

  const budgetTotal = Number(project?.budgetTotal ?? 0) ||
    budgetItems.reduce((s, b) => s + (Number(b.plannedCost) || 0), 0)
  const ac = budgetItems.reduce((s, b) => s + (Number(b.actualCost) || 0), 0)
  const evAbs = budgetItems.reduce((s, b) => s + (Number(b.earnedValue) || 0), 0)
  const cpi = ac > 0 && evAbs > 0 ? evAbs / ac : 1
  const eac = cpi > 0 ? budgetTotal / cpi : budgetTotal

  const series = buildSCurveSeries({
    tasks, budgetItems, budgetTotal,
    projectStart: project?.startDate, projectEnd: project?.endDate,
  })

  const hasCurve  = series.length >= 2
  const hasBudget = budgetTotal > 0
  if (!hasCurve && !tasks.length && !hasBudget) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
      {hasCurve && (
        <SCurve series={series} brand={brand} brand2={brand2}
          labels={{ title: t("Earned value S-curve"), pv: t("Planned value"),
            ev: t("Earned value"), ac: t("Actual cost"), today: t("Today") }} />
      )}
      <div style={{ display: "grid", gap: 14,
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {tasks.length > 0 && (() => {
          const bs = buildBurnupSeries({ tasks, projectStart: project?.startDate, projectEnd: project?.endDate })
          return bs.length >= 2 ? (
            <Burnup series={bs} brand={brand}
              labels={{ title: t("Burnup — scope vs completed"), done: t("Completed"),
                scope: t("Total scope"), ideal: t("Ideal pace") }} />
          ) : null
        })()}
        <StatusDonut tasks={tasks} title={t("Tasks by status")} t={t} />
        {hasBudget && (
          <BudgetBullet bac={budgetTotal} ac={ac} eac={eac} title={t("Budget performance")}
            labels={{ spent: t("Spent"), eac: "EAC", budget: t("Budget") }} />
        )}
      </div>
    </div>
  )
}
