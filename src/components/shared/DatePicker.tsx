"use client"
// src/components/shared/DatePicker.tsx — branded calendar popover (replaces native date inputs)
// Deterministic behavior: browsing never closes; picking a day commits immediately.
import { useEffect, useRef, useState } from "react"

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DOW = ["Su","Mo","Tu","We","Th","Fr","Sa"]

const pad = (n: number) => String(n).padStart(2, "0")
const toStr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

export function DatePickerPopover({ value, onSelect, onClear, onClose }: {
  value?: string | null                 // "yyyy-mm-dd"
  onSelect: (dateStr: string) => void   // commits + caller closes
  onClear?: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const init = /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? (value as string) : null
  const today = new Date()
  const [y, setY] = useState(init ? +init.slice(0, 4) : today.getFullYear())
  const [m, setM] = useState(init ? +init.slice(5, 7) - 1 : today.getMonth())

  // Outside-click / Escape close — our DOM, fully reliable
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey) }
  }, [onClose])

  const firstDow = new Date(y, m, 1).getDay()
  const daysIn = new Date(y, m + 1, 0).getDate()
  const daysPrev = new Date(y, m, 0).getDate()
  const cells: { d: number; cm: -1 | 0 | 1 }[] = []
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ d: daysPrev - i, cm: -1 })
  for (let d = 1; d <= daysIn; d++) cells.push({ d, cm: 0 })
  while (cells.length % 7 !== 0 || cells.length < 42) cells.push({ d: cells.length - (firstDow + daysIn) + 1, cm: 1 })

  const nav = (delta: number) => {
    const nm = m + delta
    setY(y + Math.floor(nm / 12) - (nm < 0 ? (nm % 12 === 0 ? 0 : 1) : 0))
    setM(((nm % 12) + 12) % 12)
    if (delta === 12) { setY(y + 1); setM(m) }
    if (delta === -12) { setY(y - 1); setM(m) }
  }

  const isSel = (d: number, cm: number) => cm === 0 && init === toStr(y, m, d)
  const isToday = (d: number, cm: number) =>
    cm === 0 && d === today.getDate() && m === today.getMonth() && y === today.getFullYear()

  const navBtn: React.CSSProperties = {
    width: 26, height: 26, border: "1px solid var(--border)", background: "#fff",
    borderRadius: 6, cursor: "pointer", fontSize: 13, color: "var(--text-2)",
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)",
  }

  return (
    <div ref={ref} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}
      style={{ position: "absolute", top: "100%", left: 0, zIndex: 300, marginTop: 4,
        width: 252, background: "#fff", border: "1px solid var(--border)", borderRadius: 10,
        boxShadow: "0 12px 32px rgba(13,27,42,.18)", padding: 10, fontFamily: "var(--font)" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <button style={navBtn} title="Previous year" onClick={() => nav(-12)}>«</button>
        <button style={navBtn} title="Previous month" onClick={() => nav(-1)}>‹</button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          {MONTHS[m]} {y}
        </div>
        <button style={navBtn} title="Next month" onClick={() => nav(1)}>›</button>
        <button style={navBtn} title="Next year" onClick={() => nav(12)}>»</button>
      </div>

      {/* Weekdays */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 2 }}>
        {DOW.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700,
            color: "var(--text-4)", padding: "3px 0" }}>{d}</div>
        ))}
      </div>

      {/* Days */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {cells.slice(0, 42).map((c, i) => {
          const sel = isSel(c.d, c.cm)
          const tdy = isToday(c.d, c.cm)
          return (
            <button key={i}
              onClick={() => {
                let yy = y, mm = m
                if (c.cm === -1) { mm = m - 1; if (mm < 0) { mm = 11; yy-- } }
                if (c.cm === 1)  { mm = m + 1; if (mm > 11) { mm = 0; yy++ } }
                onSelect(toStr(yy, mm, c.d))
              }}
              style={{ height: 28, border: "none", borderRadius: 6, cursor: "pointer",
                fontSize: 12, fontFamily: "var(--font)",
                background: sel ? "var(--steel)" : "transparent",
                color: sel ? "#fff" : c.cm !== 0 ? "#CBD5E1" : "var(--text)",
                fontWeight: sel || tdy ? 700 : 400,
                outline: tdy && !sel ? "1.5px solid var(--steel)" : "none",
                outlineOffset: -1.5 }}>
              {c.d}
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8,
        paddingTop: 8, borderTop: "1px solid var(--border)" }}>
        {onClear
          ? <button onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: "var(--text-3)", fontFamily: "var(--font)" }}>Clear</button>
          : <span />}
        <button onClick={() => onSelect(toStr(today.getFullYear(), today.getMonth(), today.getDate()))}
          style={{ background: "none", border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600, color: "var(--steel)", fontFamily: "var(--font)" }}>
          Today
        </button>
      </div>
    </div>
  )
}


// ── Drop-in replacement for native date inputs ─────────────────────────────
// Same contract: value is "yyyy-mm-dd" | "", onChange receives { target: { value } }.
export function DateField({ value, onChange, style, placeholder, disabled, ...rest }: {
  value?: string | null
  onChange: (e: { target: { value: string } }) => void
  style?: React.CSSProperties
  placeholder?: string
  disabled?: boolean
  [key: string]: any
}) {
  const [open, setOpen] = useState(false)
  const val = /^\d{4}-\d{2}-\d{2}/.test(String(value || "")) ? String(value).slice(0, 10) : ""
  return (
    <div style={{ position: "relative", display: "inline-block", width: (style as any)?.width }}>
      <button type="button" disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{ textAlign: "left", cursor: disabled ? "default" : "pointer",
          background: "#fff", display: "flex", alignItems: "center", gap: 8,
          fontFamily: "var(--font)", ...style, width: "100%" }}>
        <span style={{ flex: 1, color: val ? undefined : "var(--text-4)" }}>
          {val || placeholder || "Select date"}
        </span>
        <span aria-hidden style={{ fontSize: 12, color: "var(--text-4)", flexShrink: 0 }}>📅</span>
      </button>
      {open && (
        <DatePickerPopover
          value={val || null}
          onSelect={(d) => { onChange({ target: { value: d } }); setOpen(false) }}
          onClear={() => { onChange({ target: { value: "" } }); setOpen(false) }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
