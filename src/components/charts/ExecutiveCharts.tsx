"use client"
// src/components/charts/ExecutiveCharts.tsx
// Portfolio-level charts for the Executive dashboard.
// Loaded via next/dynamic (ssr:false).

import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ReferenceLine, ReferenceArea,
} from "recharts"

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

// ── Public section ───────────────────────────────────────────────────────
export default function ExecutivePerformanceCharts({
  healthCounts, totalProjects, scatter, t,
}: {
  healthCounts: { GREEN: number; AMBER: number; RED: number }
  totalProjects: number
  scatter: { name: string; code?: string; cpi: number; spi: number; health?: string }[]
  t: (k: string) => string
}) {
  return (
    <div style={{ display: "grid", gap: 14, marginBottom: 18,
      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
      <HealthDonut counts={healthCounts} total={totalProjects} t={t} />
      <CpiSpiScatter points={scatter} t={t} />
    </div>
  )
}
