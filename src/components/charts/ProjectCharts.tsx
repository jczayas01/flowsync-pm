"use client"
// src/components/charts/ProjectCharts.tsx
// Performance charts for the project dashboard. Loaded via next/dynamic
// (ssr:false) so recharts never blocks first paint or the server bundle.

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts"
import { buildSCurveSeries, buildBurnupSeries } from "@/lib/evm-series"

const NAVY = "#0D1B2A", STEEL = "#1B6CA8", AMBER = "#F59E0B"
const GREEN = "#059669", RED = "#DC2626", SLATE = "#94A3B8", LINE = "#E2E8F0"

const money = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K`
  : `$${Math.round(n)}`

const card: React.CSSProperties = {
  background: "var(--bg-1,#fff)", border: `1px solid var(--border,${LINE})`,
  borderRadius: 12, padding: "16px 16px 8px",
}
const cardTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
  color: "var(--text-3,#64748B)", marginBottom: 10,
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
  return (
    <div style={card}>
      <div style={cardTitle}>{labels.title}</div>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={series} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={LINE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={{ stroke: LINE }} minTickGap={28} />
          <YAxis tickFormatter={money} tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false} width={52} />
          <Tooltip formatter={(v: number) => money(v)} labelStyle={{ fontWeight: 600 }}
            contentStyle={{ borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
          {showToday && (
            <ReferenceLine x={series.reduce((best, p) => Math.abs(p.t - now) < Math.abs(best.t - now) ? p : best).label}
              stroke={NAVY} strokeDasharray="4 3"
              label={{ value: labels.today, position: "top", fontSize: 10, fill: NAVY }} />
          )}
          <Line name={labels.pv} dataKey="pv" stroke={SLATE} strokeWidth={2} strokeDasharray="6 4" dot={false} />
          <Line name={labels.ev} dataKey="ev" stroke={brand}  strokeWidth={2.5} dot={false} />
          <Line name={labels.ac} dataKey="ac" stroke={brand2} strokeWidth={2.5} dot={false} />
        </LineChart>
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
  return (
    <div style={card}>
      <div style={cardTitle}>{labels.title}</div>
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={series} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={LINE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: SLATE }} tickLine={false}
            axisLine={{ stroke: LINE }} minTickGap={28} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: SLATE }} tickLine={false}
            axisLine={false} width={34} />
          <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
          <Area name={labels.scope} dataKey="scope" stroke={SLATE} strokeWidth={1.5}
            fill={SLATE} fillOpacity={0.06} dot={false} />
          <Area name={labels.done} dataKey="done" stroke={brand} strokeWidth={2.5}
            fill={brand} fillOpacity={0.14} dot={false} />
          <Line name={labels.ideal} dataKey="ideal" stroke={GREEN} strokeWidth={1.5}
            strokeDasharray="6 4" dot={false} />
        </AreaChart>
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
    <div style={card}>
      <div style={cardTitle}>{title}</div>
      <div style={{ position: "relative" }}>
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88}
              paddingAngle={2} strokeWidth={0}>
              {data.map(s => <Cell key={s.name} fill={s.color} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", top: 88, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-1,#0F172A)" }}>{tasks.length}</div>
          <div style={{ fontSize: 10.5, color: SLATE, letterSpacing: ".05em" }}>{t("TASKS")}</div>
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
  return (
    <div style={{ ...card, paddingBottom: 16 }}>
      <div style={cardTitle}>{title}</div>
      <div style={{ padding: "26px 4px 6px" }}>
        <div style={{ position: "relative", height: 26, background: "var(--bg-2,#F1F5F9)",
          borderRadius: 7, overflow: "visible" }}>
          {/* AC bar */}
          <div style={{ position: "absolute", inset: "5px auto 5px 0", width: pct(ac),
            background: over ? RED : STEEL, borderRadius: 5, transition: "width .4s ease" }} />
          {/* EAC marker */}
          <div style={{ position: "absolute", top: -5, bottom: -5, left: pct(eac), width: 2.5,
            background: over ? RED : GREEN, borderRadius: 2 }}>
            <span style={{ position: "absolute", top: -17, left: "50%", transform: "translateX(-50%)",
              fontSize: 10, fontWeight: 700, color: over ? RED : GREEN, whiteSpace: "nowrap" }}>
              {labels.eac} {money(eac)}
            </span>
          </div>
          {/* BAC marker */}
          <div style={{ position: "absolute", top: -5, bottom: -5, left: pct(bac), width: 2.5,
            background: NAVY, borderRadius: 2 }}>
            <span style={{ position: "absolute", bottom: -17, left: "50%", transform: "translateX(-50%)",
              fontSize: 10, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>
              {labels.budget} {money(bac)}
            </span>
          </div>
        </div>
        <div style={{ marginTop: 24, fontSize: 12, color: SLATE }}>
          {labels.spent}: <b style={{ color: "var(--text-1,#0F172A)" }}>{money(ac)}</b>
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
