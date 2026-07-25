"use client"
// src/components/charts/ExecutiveCharts.tsx
// Portfolio-level charts for the Executive dashboard.
// Loaded via next/dynamic (ssr:false).

import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, ReferenceLine, ReferenceArea,
  AreaChart, Area,
} from "recharts"
import { buildPortfolioBurnSeries } from "@/lib/evm-series"

const NAVY = "#0D1B2A", GREEN = "#059669", AMBER = "#F59E0B", RED = "#DC2626"
const SLATE = "#94A3B8", LINE = "#E2E8F0"

const card: React.CSSProperties = {
  background: "var(--bg-1,#fff)", border: `1px solid var(--border,${LINE})`,
  borderRadius: 12, padding: "16px 16px 8px",
}
const cardTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
  color: "var(--text-3,#64748B)", marginBottom: 10,
}

// ── Portfolio health donut ───────────────────────────────────────────────
function HealthDonut({ counts, total, t }: {
  counts: { GREEN: number; AMBER: number; RED: number }
  total: number
  t: (k: string) => string
}) {
  const data = [
    { name: t("On track"),  value: counts.GREEN, color: GREEN },
    { name: t("At risk"),   value: counts.AMBER, color: AMBER },
    { name: t("Off track"), value: counts.RED,   color: RED },
  ].filter(s => s.value > 0)
  if (!data.length) return null
  return (
    <div style={card}>
      <div style={cardTitle}>{t("Portfolio health")}</div>
      <div style={{ position: "relative" }}>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84}
              paddingAngle={2} strokeWidth={0}>
              {data.map(s => <Cell key={s.name} fill={s.color} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", top: 82, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-1,#0F172A)" }}>{total}</div>
          <div style={{ fontSize: 10, color: SLATE, letterSpacing: ".05em" }}>{t("PROJECTS").toUpperCase()}</div>
        </div>
      </div>
    </div>
  )
}

// ── CPI × SPI scatter ────────────────────────────────────────────────────
const HEALTH_DOT: Record<string, string> = { GREEN, AMBER, RED, YELLOW: AMBER }
const clamp = (v: number) => Math.min(1.5, Math.max(0.5, v))

function CpiSpiScatter({ points, t }: {
  points: { name: string; code?: string; cpi: number; spi: number; health?: string }[]
  t: (k: string) => string
}) {
  const data = points.map(p => ({
    ...p, x: clamp(p.spi), y: clamp(p.cpi),
    fill: HEALTH_DOT[p.health || ""] || "#1B6CA8",
  }))
  if (!data.length) return null
  return (
    <div style={card}>
      <div style={cardTitle}>{t("Cost vs schedule performance")}</div>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 8, right: 14, left: 0, bottom: 4 }}>
          {/* trouble quadrant tint: behind schedule + over cost */}
          <ReferenceArea x1={0.5} x2={1} y1={0.5} y2={1} fill={RED} fillOpacity={0.05} />
          <CartesianGrid stroke={LINE} strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name="SPI" domain={[0.5, 1.5]}
            tickCount={5} tick={{ fontSize: 11, fill: SLATE }} tickLine={false}
            axisLine={{ stroke: LINE }}
            label={{ value: "SPI →", position: "insideBottomRight", offset: -2, fontSize: 11, fill: SLATE }} />
          <YAxis type="number" dataKey="y" name="CPI" domain={[0.5, 1.5]}
            tickCount={5} tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false} width={34}
            label={{ value: "CPI →", angle: -90, position: "insideLeft", fontSize: 11, fill: SLATE }} />
          <ReferenceLine x={1} stroke={NAVY} strokeDasharray="4 3" />
          <ReferenceLine y={1} stroke={NAVY} strokeDasharray="4 3" />
          <Tooltip cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 12 }}
            formatter={(v: number, name: string) => [v.toFixed(2), name]}
            labelFormatter={() => ""}
            content={({ payload }) => {
              const p = payload?.[0]?.payload
              if (!p) return null
              return (
                <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8,
                  padding: "8px 10px", fontSize: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{p.code ? `${p.code} · ` : ""}{p.name}</div>
                  <div>CPI {p.cpi.toFixed(2)} · SPI {p.spi.toFixed(2)}</div>
                </div>
              )
            }} />
          <Scatter data={data} shape={(props: any) => (
            <circle cx={props.cx} cy={props.cy} r={7} fill={props.payload.fill}
              fillOpacity={0.85} stroke="#fff" strokeWidth={1.5} />
          )} />
        </ScatterChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 11, color: SLATE, padding: "2px 4px 8px" }}>
        {t("Top-right = under budget and ahead of schedule. Values clamped to 0.5–1.5.")}
      </div>
    </div>
  )
}


const money = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K`
  : `$${Math.round(n)}`

// ── Portfolio budget burn ────────────────────────────────────────────────
function PortfolioBurn({ budgetItems, t }: { budgetItems: any[]; t: (k: string) => string }) {
  const series = buildPortfolioBurnSeries(budgetItems)
  if (series.length < 2) return null
  return (
    <div style={{ ...card, gridColumn: "1 / -1" }}>
      <div style={cardTitle}>{t("Portfolio budget burn")}</div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={series} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={LINE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: SLATE }} tickLine={false}
            axisLine={{ stroke: LINE }} minTickGap={28} />
          <YAxis tickFormatter={money} tick={{ fontSize: 11, fill: SLATE }} tickLine={false}
            axisLine={false} width={52} />
          <Tooltip formatter={(v: number) => money(v)}
            contentStyle={{ borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
          <Area name={t("Planned")} dataKey="planned" stroke={SLATE} strokeWidth={1.5}
            strokeDasharray="6 4" fill={SLATE} fillOpacity={0.05} dot={false} />
          <Area name={t("Actual")} dataKey="actual" stroke={AMBER} strokeWidth={2.5}
            fill={AMBER} fillOpacity={0.14} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Milestone timeline ───────────────────────────────────────────────────
const MS_COLOR: Record<string, string> = {
  UPCOMING: "#1B6CA8", AT_RISK: AMBER, ACHIEVED: GREEN, MISSED: RED,
}

function MilestoneTimeline({ milestones, windowDays, t }: {
  milestones: any[]; windowDays: number; t: (k: string) => string
}) {
  const now = Date.now()
  const end = now + windowDays * 864e5
  const items = milestones
    .filter(m => m.dueDate)
    .map(m => ({ ...m, tt: new Date(m.dueDate).getTime() }))
    .filter(m => m.tt >= now - 864e5 && m.tt <= end)
    .sort((a, b) => a.tt - b.tt)
  if (!items.length) return null
  const data = items.map(m => ({
    x: m.tt, y: 1,
    name: m.name, code: m.project?.code || m.projectCode || "",
    fill: MS_COLOR[m.status] || SLATE,
    date: new Date(m.tt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
  }))
  const fmtTick = (v: number) =>
    new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
  return (
    <div style={{ ...card, gridColumn: "1 / -1", paddingBottom: 2 }}>
      <div style={cardTitle}>{t("Milestones ahead")} · {windowDays}d</div>
      <ResponsiveContainer width="100%" height={110}>
        <ScatterChart margin={{ top: 12, right: 20, left: 8, bottom: 4 }}>
          <XAxis type="number" dataKey="x" domain={[now, end]} tickFormatter={fmtTick}
            tickCount={6} tick={{ fontSize: 11, fill: SLATE }} tickLine={false}
            axisLine={{ stroke: LINE }} />
          <YAxis type="number" dataKey="y" hide domain={[0, 2]} />
          <ReferenceLine x={now} stroke={NAVY} strokeDasharray="4 3"
            label={{ value: t("Today"), position: "top", fontSize: 10, fill: NAVY }} />
          <Tooltip cursor={false}
            content={({ payload }) => {
              const p = payload?.[0]?.payload
              if (!p) return null
              return (
                <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8,
                  padding: "8px 10px", fontSize: 12 }}>
                  <div style={{ fontWeight: 700 }}>{p.code ? `${p.code} · ` : ""}{p.name}</div>
                  <div style={{ color: SLATE }}>{p.date}</div>
                </div>
              )
            }} />
          <Scatter data={data} shape={(props: any) => (
            <g>
              <line x1={props.cx} x2={props.cx} y1={props.cy + 8} y2={props.cy + 22}
                stroke={props.payload.fill} strokeWidth={1.5} />
              <circle cx={props.cx} cy={props.cy} r={7} fill={props.payload.fill}
                stroke="#fff" strokeWidth={1.5} />
            </g>
          )} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Portfolio bubble ─────────────────────────────────────────────────────
function PortfolioBubble({ points, t }: {
  points: { name: string; code?: string; budget: number; pct: number; riskExposure: number; health?: string }[]
  t: (k: string) => string
}) {
  const data = points
    .filter(p => p.budget > 0 || p.pct > 0)
    .map(p => ({
      ...p, x: p.budget, y: Math.min(100, Math.max(0, p.pct)),
      z: Math.max(4, p.riskExposure),
      fill: HEALTH_DOT[p.health || ""] || "#1B6CA8",
    }))
  if (data.length < 2) return null
  return (
    <div style={card}>
      <div style={cardTitle}>{t("Projects — budget vs progress (bubble = risk)")}</div>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={LINE} strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name="Budget" tickFormatter={money}
            tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={{ stroke: LINE }} />
          <YAxis type="number" dataKey="y" name="%" domain={[0, 100]} unit="%"
            tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false} width={40} />
          <ZAxis type="number" dataKey="z" range={[60, 420]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              const p = payload?.[0]?.payload
              if (!p) return null
              return (
                <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8,
                  padding: "8px 10px", fontSize: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{p.code ? `${p.code} · ` : ""}{p.name}</div>
                  <div>{money(p.x)} · {p.y}% · {t("risk")} {p.riskExposure}</div>
                </div>
              )
            }} />
          <Scatter data={data} shape={(props: any) => (
            <circle cx={props.cx} cy={props.cy} r={props.size ? Math.sqrt(props.size) / 2 : 9}
              fill={props.payload.fill} fillOpacity={0.55} stroke={props.payload.fill} strokeWidth={1.5} />
          )} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Public section ───────────────────────────────────────────────────────
export default function ExecutivePerformanceCharts({
  healthCounts, totalProjects, scatter, bubbles, budgetItems, milestones, milestoneWindow, t,
}: {
  healthCounts: { GREEN: number; AMBER: number; RED: number }
  totalProjects: number
  scatter: { name: string; code?: string; cpi: number; spi: number; health?: string }[]
  bubbles?: { name: string; code?: string; budget: number; pct: number; riskExposure: number; health?: string }[]
  budgetItems?: any[]
  milestones?: any[]
  milestoneWindow?: number
  t: (k: string) => string
}) {
  return (
    <div style={{ display: "grid", gap: 14, marginBottom: 18,
      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
      <HealthDonut counts={healthCounts} total={totalProjects} t={t} />
      <CpiSpiScatter points={scatter} t={t} />
      {bubbles && <PortfolioBubble points={bubbles} t={t} />}
      {budgetItems && budgetItems.length > 0 && <PortfolioBurn budgetItems={budgetItems} t={t} />}
      {milestones && milestones.length > 0 && (
        <MilestoneTimeline milestones={milestones} windowDays={milestoneWindow || 90} t={t} />
      )}
    </div>
  )
}
