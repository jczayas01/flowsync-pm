// src/components/shared/Logo.tsx
// The FlowSync PM mark: three staggered bars — a Gantt chart at 24px.
//
// This exists because the mark was being redrawn by hand in each place that
// needed it (an "F" in a square), which drifted from the real icon.svg. The
// favicon said one thing and the site header said another. One source now.
//
// Keep in sync with src/app/icon.svg — that file is the favicon and cannot
// import this component, so the two must be edited together.

export function LogoMark({ size = 26, radius }: { size?: number; radius?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false"
      style={{ display: "block", flexShrink: 0 }}>
      <rect width="64" height="64" rx={radius ?? 14} fill="#0D1B2A" />
      <rect x="12" y="16" width="28" height="7" rx="3.5" fill="#F59E0B" />
      <rect x="20" y="28" width="32" height="7" rx="3.5" fill="#1B6CA8" />
      <rect x="12" y="40" width="20" height="7" rx="3.5" fill="#E2E8F0" />
    </svg>
  )
}

/**
 * The wordmark: "FlowSync PM" with PM in amber. This is the house style the
 * product already uses — keep it, don't reinvent it per screen.
 * `tone` picks the "FlowSync" colour for dark or light backgrounds.
 */
export function Wordmark({ size = 15, tone = "dark" }: { size?: number; tone?: "dark" | "light" }) {
  return (
    <span style={{
      fontWeight: 700, fontSize: size, letterSpacing: "-.01em", whiteSpace: "nowrap",
      color: tone === "dark" ? "#fff" : "#0D1B2A",
    }}>
      FlowSync <span style={{ color: "#F59E0B" }}>PM</span>
    </span>
  )
}

/** Mark + wordmark together. */
export function Logo({ size = 26, tone = "dark" }: { size?: number; tone?: "dark" | "light" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <LogoMark size={size} />
      <Wordmark size={Math.round(size * 0.58)} tone={tone} />
    </span>
  )
}
