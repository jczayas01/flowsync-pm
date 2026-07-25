"use client"
import type { CSSProperties } from "react"
// src/components/charts/theme.tsx
// Shared visual system for all dashboard charts — "instrument-grade glass".
// Gradient fills under data lines, soft glow strokes, hairline grids, and the
// signature live beacon on the newest point of every time series.
// Pure SVG/CSS on top of recharts: no new dependencies.

export const INK   = "#0F172A"
export const SLATE = "#94A3B8"
export const GRID  = "rgba(100,116,139,.10)"
export const AXIS  = { fontSize: 10.5, fill: "#94A3B8", fontWeight: 500 } as const

export const CARD: CSSProperties = {
  background: "linear-gradient(180deg, #FFFFFF 0%, #FBFCFE 100%)",
  border: "1px solid rgba(148,163,184,.22)",
  borderRadius: 14,
  padding: "16px 16px 8px",
  boxShadow: "0 1px 2px rgba(13,27,42,.04), 0 12px 32px -18px rgba(13,27,42,.18)",
  position: "relative",
  overflow: "hidden",
}

export const cardTitle = (accent: string): CSSProperties[] => [
  { display: "flex", alignItems: "center", gap: 7, marginBottom: 10 },
  { width: 7, height: 7, borderRadius: 99, background: accent,
    boxShadow: `0 0 8px ${accent}66` },
  { fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase",
    color: "#64748B" },
]

export const TOOLTIP: CSSProperties = {
  background: "rgba(255,255,255,.92)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(148,163,184,.25)",
  borderRadius: 10,
  boxShadow: "0 8px 24px -8px rgba(13,27,42,.25)",
  fontSize: 12,
  padding: "8px 12px",
}

/** SVG defs shared by charts within one card. Give each card a unique prefix. */
export function ChartDefs({ p, brand, brand2 }: { p: string; brand: string; brand2: string }) {
  const fade = (id: string, c: string, a = 0.28) => (
    <linearGradient key={id} id={`${p}-${id}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stopColor={c} stopOpacity={a} />
      <stop offset="70%" stopColor={c} stopOpacity={0.04} />
      <stop offset="100%" stopColor={c} stopOpacity={0} />
    </linearGradient>
  )
  return (
    <defs>
      {fade("brand", brand)}
      {fade("brand2", brand2)}
      {fade("slate", "#94A3B8", 0.14)}
      {fade("green", "#059669")}
      {fade("red", "#DC2626", 0.2)}
      <linearGradient id={`${p}-stem`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={brand} stopOpacity=".9" />
        <stop offset="100%" stopColor={brand} stopOpacity=".15" />
      </linearGradient>
    </defs>
  )
}

/** One-time keyframes + glow classes. Mount once per chart section. */
export function ChartStyle() {
  return (
    <style>{`
      .fsq-glow-a path.recharts-curve { filter: drop-shadow(0 0 5px var(--fsq-a, rgba(27,108,168,.45))); }
      .fsq-glow-b path.recharts-curve { filter: drop-shadow(0 0 5px var(--fsq-b, rgba(245,158,11,.45))); }
      .fsq-glow-g path.recharts-curve { filter: drop-shadow(0 0 4px rgba(5,150,105,.4)); }
      @keyframes fsqPulse {
        0%   { r: 4;  opacity: .9; }
        70%  { r: 11; opacity: 0;  }
        100% { r: 11; opacity: 0;  }
      }
      .fsq-beacon-ring { animation: fsqPulse 2.2s cubic-bezier(.2,.6,.4,1) infinite; transform-box: fill-box; }
      @media (prefers-reduced-motion: reduce) {
        .fsq-beacon-ring { animation: none; opacity: 0; }
      }
    `}</style>
  )
}

/** Signature: pulsing beacon rendered on the last point of a series.
 *  Use as recharts `dot` renderer: dot={beaconDot(color, lastIndex)} */
export function beaconDot(color: string, lastIndex: number) {
  // eslint-disable-next-line react/display-name
  return (props: any) => {
    const { cx, cy, index } = props
    if (index !== lastIndex || cx == null || cy == null) return <g key={`d${index}`} />
    return (
      <g key={`beacon${index}`}>
        <circle className="fsq-beacon-ring" cx={cx} cy={cy} r={4}
          fill="none" stroke={color} strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      </g>
    )
  }
}
