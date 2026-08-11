"use client"
// src/components/admin/ContractsWorkspace.tsx
// CLM module: portfolio command center (cross-contract) ⇄ contract record (single).
// Reads the server-side rollup at /api/admin/contracts/portfolio so money is never
// re-derived on the client. Editing a contract still routes through ContractsPanel's
// modal via the `onEdit` callback, so there is exactly one contract form in the app.
import { useState, useEffect, useMemo, useCallback } from "react"
import { useTranslations } from "next-intl"
import { dateLocale } from "@/lib/date-locale"

const NAVY = "#0F2942", STEEL = "#1B6CA8", GREEN = "#059669", AMBER = "#D97706", RED = "#DC2626"

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "#64748B", ACTIVE: GREEN, EXPIRED: RED, TERMINATED: "#7C3AED", RENEWED: STEEL,
}
const SERVICE_STATUS_COLOR: Record<string, string> = {
  DRAFT: "#64748B", APPROVED: STEEL, INVOICED: GREEN, WRITTEN_OFF: "#94A3B8",
}
const ONB_STATUS_COLOR: Record<string, string> = {
  PENDING: "#64748B", COMPLETED: AMBER, INVOICED: GREEN,
}
const CATEGORIES = ["ONBOARDING", "TRAINING", "SERVICE_REQUEST", "CHANGE_CONFIG"] as const

const money = (n?: number | null, cur = "USD") =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}${cur !== "USD" ? " " + cur : ""}`
const money2 = (n?: number | null, cur = "USD") =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cur !== "USD" ? " " + cur : ""}`
const fmtD = (d?: string | null) => d
  ? new Date(d).toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
  : "—"

const card: React.CSSProperties = {
  background: "#fff", border: "1px solid var(--border,#E2E8F0)", borderRadius: 10, padding: 16,
}
const inp: React.CSSProperties = {
  width: "100%", padding: "7px 9px", border: "1px solid var(--border,#E2E8F0)", borderRadius: 6,
  fontSize: 12.5, fontFamily: "var(--font)", background: "#fff", color: "var(--text-1,#0F172A)",
}
const lbl: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-3,#64748B)", marginBottom: 4,
}
const btn = (primary = false): React.CSSProperties => ({
  padding: "7px 14px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
  border: primary ? "none" : "1px solid var(--border,#E2E8F0)",
  background: primary ? STEEL : "#fff", color: primary ? "#fff" : "var(--text-1,#0F172A)",
  fontFamily: "var(--font)",
})
const miniBtn: React.CSSProperties = {
  padding: "3px 9px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer",
  border: "1px solid var(--border,#E2E8F0)", background: "#fff", fontFamily: "var(--font)",
}
const th: React.CSSProperties = {
  textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "var(--text-3,#64748B)",
  textTransform: "uppercase", letterSpacing: ".05em", padding: "8px 10px",
  borderBottom: "1px solid var(--border,#E2E8F0)", whiteSpace: "nowrap",
}
const td: React.CSSProperties = {
  padding: "9px 10px", fontSize: 12.5, borderBottom: "1px solid #F1F5F9", verticalAlign: "middle",
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
      color, background: `${color}15`, border: `1px solid ${color}30`, whiteSpace: "nowrap" }}>
      {text}
    </span>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Portfolio — the contract term chart is the anchor. A contract is a
// time-bounded instrument, so the portfolio reads as a Gantt of terms on one
// shared calendar axis: you see who ends when, and how close, spatially rather
// than as a number to interpret. The old KPI strip and renewal runway are both
// folded into this plus the action rail; neither earned a card of its own.
const MS_DAY = 864e5
const FLAG_LABEL: Record<string, string> = {
  overdue: "actOverdue", expired: "actExpired", expiring: "actExpiring",
  unbilled: "actUnbilled", readybill: "actReadyBill",
}

function monthTicks(start: number, end: number) {
  const out: { t: number; label: string; first: boolean }[] = []
  const d = new Date(start)
  d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0)
  if (d.getTime() < start) d.setUTCMonth(d.getUTCMonth() + 1)
  while (d.getTime() <= end) {
    const jan = d.getUTCMonth() === 0
    out.push({
      t: d.getTime(),
      label: d.toLocaleDateString(dateLocale(), { month: "short", timeZone: "UTC" }),
      first: jan,
    })
    d.setUTCMonth(d.getUTCMonth() + 1)
  }
  return out
}

function TermChart({ rows, onOpen }: { rows: any[]; onOpen: (id: string) => void }) {
  const cl = useTranslations("clm")
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduce) { setDrawn(true); return }
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const now = Date.now()

  const axis = useMemo(() => {
    if (!rows.length) return null
    const starts = rows.map(r => new Date(r.startDate).getTime())
    const ends   = rows.map(r => new Date(r.endDate).getTime())
    let lo = Math.min(...starts, now)
    let hi = Math.max(...ends, now + 90 * MS_DAY)
    const pad = (hi - lo) * 0.02
    lo -= pad; hi += pad
    return { lo, hi, span: hi - lo }
  }, [rows, now])

  if (!axis) {
    return (
      <div style={{ padding: 24, fontSize: 12.5, color: "rgba(255,255,255,.5)" }}>
        {cl("noTerms")}
      </div>
    )
  }

  const pct = (t: number) => ((t - axis.lo) / axis.span) * 100
  const ticks = monthTicks(axis.lo, axis.hi)
  const todayPct = pct(now)

  return (
    <div>
      {/* month scale */}
      <div style={{ position: "relative", height: 18, marginBottom: 6,
        borderBottom: "1px solid rgba(255,255,255,.10)" }}>
        {ticks.map(tk => (
          <span key={tk.t} style={{
            position: "absolute", left: `${pct(tk.t)}%`, top: 0, transform: "translateX(-50%)",
            fontSize: 9.5, letterSpacing: ".08em", textTransform: "uppercase",
            color: tk.first ? "rgba(255,255,255,.62)" : "rgba(255,255,255,.32)",
            fontWeight: tk.first ? 700 : 500, whiteSpace: "nowrap",
          }}>{tk.label}</span>
        ))}
      </div>

      <div style={{ position: "relative" }}>
        {/* month gridlines */}
        {ticks.map(tk => (
          <span key={tk.t} aria-hidden style={{
            position: "absolute", left: `${pct(tk.t)}%`, top: 0, bottom: 0, width: 1,
            background: tk.first ? "rgba(255,255,255,.13)" : "rgba(255,255,255,.055)",
          }} />
        ))}

        {/* today */}
        {todayPct >= 0 && todayPct <= 100 && (
          <>
            <span aria-hidden style={{
              position: "absolute", left: `${todayPct}%`, top: -4, bottom: -4, width: 2,
              marginLeft: -1, background: AMBER, opacity: drawn ? 1 : 0,
              transition: "opacity .5s ease .35s", zIndex: 2,
            }} />
            <span style={{
              position: "absolute", left: `${todayPct}%`, top: -18, transform: "translateX(-50%)",
              fontSize: 9, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase",
              color: AMBER, opacity: drawn ? 1 : 0, transition: "opacity .5s ease .35s",
              zIndex: 3, whiteSpace: "nowrap", pointerEvents: "none",
            }}>{cl("today")}</span>
          </>
        )}

        {rows.map((r, i) => {
          const s = new Date(r.startDate).getTime()
          const e = new Date(r.endDate).getTime()
          const left = pct(s)
          const width = Math.max(pct(e) - left, 0.6)
          const expired = e < now
          const elapsedEnd = Math.min(now, e)
          const elapsedW = Math.max(pct(elapsedEnd) - left, 0)
          const alertStart = e - r.alertDays * MS_DAY
          const alertLeft = Math.max(pct(alertStart), left)
          const alertW = Math.max(pct(e) - alertLeft, 0)
          const hot = !expired && r.inAlertWindow

          return (
            <button key={r.id} onClick={() => onOpen(r.id)}
              style={{
                position: "relative", display: "block", width: "100%", textAlign: "left",
                background: "none", border: "none", padding: "9px 0", cursor: "pointer",
                fontFamily: "var(--font)",
              }}>
              <span style={{ position: "relative", display: "block", height: 26 }}>
                {/* term bar */}
                <span style={{
                  position: "absolute", left: `${left}%`, width: drawn ? `${width}%` : 0,
                  top: 0, height: 26, borderRadius: 4,
                  background: expired ? "rgba(220,38,38,.20)" : "rgba(255,255,255,.10)",
                  border: `1px solid ${expired ? "rgba(220,38,38,.45)" : "rgba(255,255,255,.16)"}`,
                  overflow: "hidden",
                  transition: `width .55s cubic-bezier(.22,.9,.3,1) ${i * 45}ms`,
                }}>
                  {/* elapsed fill */}
                  <span style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: `${width ? (elapsedW / width) * 100 : 0}%`,
                    background: expired
                      ? "rgba(220,38,38,.34)"
                      : "linear-gradient(90deg, rgba(27,108,168,.75), rgba(27,108,168,.5))",
                  }} />
                  {/* alert window */}
                  {!expired && alertW > 0 && (
                    <span aria-hidden style={{
                      position: "absolute", top: 0, bottom: 0,
                      left: `${width ? ((alertLeft - left) / width) * 100 : 0}%`,
                      width: `${width ? (alertW / width) * 100 : 0}%`,
                      background: `repeating-linear-gradient(115deg, ${AMBER}55 0 5px, transparent 5px 10px)`,
                      borderLeft: `1px solid ${AMBER}88`,
                    }} />
                  )}
                </span>

                {/* label rides just past the bar, or inside when it would overflow */}
                <span style={{
                  position: "absolute", top: 4,
                  left: left + width > 72 ? undefined : `calc(${left + width}% + 9px)`,
                  right: left + width > 72 ? `calc(${100 - left}% + 9px)` : undefined,
                  fontSize: 11.5, whiteSpace: "nowrap", opacity: drawn ? 1 : 0,
                  transition: `opacity .4s ease ${i * 45 + 220}ms`,
                  color: hot ? AMBER : expired ? "#FCA5A5" : "rgba(255,255,255,.88)",
                  fontWeight: hot || expired ? 700 : 600,
                }}>
                  {r.workspace?.name}
                  <span style={{ color: "rgba(255,255,255,.42)", fontWeight: 500, marginLeft: 7,
                    fontVariantNumeric: "tabular-nums" }}>
                    {money(r.acv, r.currency)}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, paddingTop: 10,
        borderTop: "1px solid rgba(255,255,255,.10)", fontSize: 10,
        color: "rgba(255,255,255,.5)", letterSpacing: ".04em" }}>
        {[
          { c: "rgba(27,108,168,.75)", t: cl("legendElapsed") },
          { c: "rgba(255,255,255,.12)", t: cl("legendRemaining") },
          { c: `${AMBER}66`, t: cl("legendAlert") },
          { c: "rgba(220,38,38,.4)", t: cl("legendExpired") },
        ].map(l => (
          <span key={l.t} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 14, height: 8, borderRadius: 2, background: l.c }} />{l.t}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Action rail ──────────────────────────────────────────────────────────────
function ActionRail({ s, onFilter }: { s: any; onFilter: (f: string) => void }) {
  const cl = useTranslations("clm")

  const items = [
    { k: "overdue",  on: s.overdueCount > 0,          label: cl("actOverdue"),
      value: money(s.overdueAmount), meta: String(s.overdueCount), color: RED },
    { k: "expired",  on: s.expiredUnrenewed > 0,      label: cl("actExpired"),
      value: String(s.expiredUnrenewed), meta: "", color: RED },
    { k: "expiring", on: s.renewals30 > 0,            label: cl("actExpiring"),
      value: String(s.renewals30), meta: "", color: AMBER },
    { k: "unbilled", on: s.unbilledAmount > 0,        label: cl("actUnbilled"),
      value: money(s.unbilledAmount), meta: cl("hoursValue", { n: s.unbilledHours }), color: AMBER },
    { k: "readybill", on: s.onboardingReadyToBill > 0, label: cl("actReadyBill"),
      value: money(s.onboardingReadyToBill), meta: "", color: AMBER },
  ].filter(i => i.on)

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase",
        color: "var(--text-3,#64748B)", marginBottom: 10 }}>
        {cl("needsAction")}
      </div>

      {!items.length ? (
        <div style={{ ...card, padding: "14px 14px", fontSize: 12.5, color: GREEN,
          borderColor: "#BBF7D0", background: "#F0FDF4" }}>
          {cl("nothingToDo")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map(i => (
            <button key={i.k} onClick={() => onFilter(i.k)}
              style={{
                display: "flex", alignItems: "baseline", gap: 8, width: "100%", textAlign: "left",
                padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font)",
                background: "#fff", border: "1px solid var(--border,#E2E8F0)",
                borderLeft: `3px solid ${i.color}`,
              }}>
              <span style={{ flex: 1, fontSize: 12, color: "var(--text-2,#334155)" }}>{i.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: i.color,
                fontVariantNumeric: "tabular-nums" }}>{i.value}</span>
              {i.meta && (
                <span style={{ fontSize: 10.5, color: "var(--text-3,#64748B)",
                  fontVariantNumeric: "tabular-nums" }}>{i.meta}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* quiet context — deliberately not competing with the action list */}
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase",
        color: "var(--text-3,#64748B)", margin: "20px 0 10px" }}>
        {cl("ctxHeading")}
      </div>
      <div style={{ ...card, padding: "12px 14px" }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: NAVY, lineHeight: 1.05,
          fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em" }}>
          {money(s.arr)}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3,#64748B)", marginTop: 3, marginBottom: 10 }}>
          {cl("ctxArr")}
        </div>
        {[
          [cl("ctxActive"), String(s.byStatus?.ACTIVE || 0)],
          [cl("ctxTotal"), String(s.total)],
          [cl("ctxHours"), cl("hoursValue", { n: s.unbilledHours })],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10,
            padding: "4px 0", fontSize: 12, borderTop: "1px solid #F1F5F9" }}>
            <span style={{ color: "var(--text-3,#64748B)" }}>{k}</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
export function ContractsWorkspace({ onEdit, onNew, reloadKey }: {
  onEdit: (contractId: string) => void
  onNew: () => void
  reloadKey?: number
}) {
  const cl = useTranslations("clm")
  const [data, setData]     = useState<any>(null)
  const [error, setError]   = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [flag, setFlag]     = useState("")

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/contracts/portfolio", { cache: "no-store" })
      const d = await res.json()
      if (!res.ok) { setError(d?.error || cl("errLoad")); return }
      setData(d.data); setError("")
    } catch { setError(cl("errLoad")) }
  }, [cl])

  useEffect(() => { load() }, [load, reloadKey])

  const contracts: any[] = data?.contracts || []
  const open = openId ? contracts.find(c => c.id === openId) : null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contracts.filter(c => {
      if (flag === "overdue"   && !(c.overdueCount > 0)) return false
      if (flag === "expired"   && !(c.expired && c.status === "ACTIVE")) return false
      if (flag === "expiring"  && !(!c.expired && c.daysToRenewal <= 30)) return false
      if (flag === "unbilled"  && !(c.unbilledAmount > 0)) return false
      if (flag === "readybill" && !(c.onboarding?.readyToBill > 0)) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || (c.workspace?.name || "").toLowerCase().includes(q)
    })
  }, [contracts, search, flag])

  const plotted = useMemo(
    () => contracts.filter(c => c.status === "ACTIVE" || c.status === "RENEWED" || c.expired)
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
      .slice(0, 14),
    [contracts],
  )

  if (error)  return <div style={{ ...card, color: RED, fontSize: 12.5 }}>{error}</div>
  if (!data)  return <div style={{ ...card, color: "var(--text-3,#64748B)", fontSize: 12.5 }}>{cl("Loading…")}</div>

  if (open) {
    return <ContractRecord contract={open} onBack={() => setOpenId(null)}
      onEdit={() => onEdit(open.id)} onChanged={load} />
  }

  const s = data.summary

  return (
    <div>
      {/* ── Anchor: contract terms on a shared calendar axis ── */}
      <div style={{
        background: "linear-gradient(160deg,#0B1F33 0%,#122C46 100%)",
        borderRadius: 12, padding: "18px 22px 16px", marginBottom: 16,
        border: "1px solid rgba(255,255,255,.08)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18,
          flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".14em",
            textTransform: "uppercase", color: "rgba(255,255,255,.55)" }}>
            {cl("termsHeading")}
          </span>
          <span style={{ marginLeft: "auto" }}>
            <button style={{ ...btn(true), padding: "6px 13px" }} onClick={onNew}>
              {cl("+ New contract")}
            </button>
          </span>
        </div>
        <TermChart rows={plotted} onOpen={setOpenId} />
      </div>

      {/* ── Action rail + reference table ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px,280px) 1fr",
        gap: 16, alignItems: "start" }} className="clm-split">
        <ActionRail s={s} onFilter={f => setFlag(flag === f ? "" : f)} />

        <div style={{ ...card, padding: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            padding: "11px 14px", borderBottom: "1px solid var(--border,#E2E8F0)" }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em",
              textTransform: "uppercase", color: "var(--text-3,#64748B)" }}>
              {cl("contractsHeading")}
            </span>
            {flag && (
              <button style={{ ...miniBtn, borderColor: AMBER, color: AMBER }}
                onClick={() => setFlag("")}>
                {cl(FLAG_LABEL[flag] as any)} ✕
              </button>
            )}
            <input style={{ ...inp, width: 190, marginLeft: "auto" }} placeholder={cl("search")}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {!filtered.length ? (
            <div style={{ padding: 28, textAlign: "center", fontSize: 12.5,
              color: "var(--text-3,#64748B)" }}>
              {contracts.length ? cl("noMatch") : cl("noContracts")}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  {["customer", "status", "acv", "renewal", "health"].map(h =>
                    <th key={h} style={th}>{cl(("col_" + h) as any)}</th>)}
                </tr></thead>
                <tbody>
                  {filtered.map(c => {
                    const urgent = (c.expired && c.status === "ACTIVE") || c.overdueCount > 0
                    const warn = !urgent && (c.inAlertWindow || c.unbilledAmount > 0)
                    return (
                      <tr key={c.id} onClick={() => setOpenId(c.id)} style={{ cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ ...td, borderLeft: `3px solid ${urgent ? RED : warn ? AMBER : "transparent"}`,
                          paddingLeft: 11 }}>
                          <div style={{ fontWeight: 600, color: NAVY }}>{c.workspace?.name || "—"}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3,#64748B)" }}>{c.name}</div>
                        </td>
                        <td style={td}>
                          <Pill text={cl(("st_" + c.status) as any)} color={STATUS_COLOR[c.status] || "#64748B"} />
                        </td>
                        <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 600,
                          fontVariantNumeric: "tabular-nums" }}>{money(c.acv, c.currency)}</td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>
                          {fmtD(c.renewalDate || c.endDate)}
                          <div style={{ fontSize: 10.5, fontVariantNumeric: "tabular-nums",
                            color: c.expired ? RED : c.inAlertWindow ? AMBER : "var(--text-3,#64748B)" }}>
                            {c.expired ? cl("expired", { n: Math.abs(c.daysToRenewal) })
                                       : cl("daysLeft", { n: c.daysToRenewal })}
                          </div>
                        </td>
                        <td style={td}>
                          <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {c.expired && c.status === "ACTIVE" && <Pill text={cl("flagExpired")} color={RED} />}
                            {!c.expired && c.inAlertWindow && <Pill text={cl("flagRenewal")} color={AMBER} />}
                            {c.overdueCount > 0 && <Pill text={cl("flagOverdue")} color={RED} />}
                            {c.unbilledAmount > 0 && <Pill text={cl("flagUnbilled")} color={AMBER} />}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .clm-split { grid-template-columns: 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .clm-split * { transition: none !important; }
        }
      `}</style>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Single-contract record
function ContractRecord({ contract, onBack, onEdit, onChanged }: {
  contract: any; onBack: () => void; onEdit: () => void; onChanged: () => void
}) {
  const cl = useTranslations("clm")
  const [tab, setTab] = useState<"terms" | "sla" | "service" | "onboarding" | "invoices">("terms")
  const c = contract

  const TABS = ["terms", "sla", "service", "onboarding", "invoices"] as const

  return (
    <div>
      <button style={{ ...miniBtn, marginBottom: 12 }} onClick={onBack}>{cl("← Portfolio")}</button>

      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: NAVY }}>{c.workspace?.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-2,#334155)", marginTop: 2 }}>{c.name}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <Pill text={cl(("st_" + c.status) as any)} color={STATUS_COLOR[c.status] || "#64748B"} />
              {c.expired && c.status === "ACTIVE" && <Pill text={cl("flagExpired")} color={RED} />}
              {!c.expired && c.inAlertWindow && <Pill text={cl("flagRenewal")} color={AMBER} />}
              {c.overdueCount > 0 && <Pill text={cl("flagOverdue")} color={RED} />}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: NAVY }}>{money(c.acv, c.currency)}</div>
            <div style={{ fontSize: 11, color: "var(--text-3,#64748B)" }}>{cl("f_acv")}</div>
            <button style={{ ...miniBtn, marginTop: 8 }} onClick={onEdit}>{cl("Edit contract")}</button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border,#E2E8F0)", marginBottom: 12 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "8px 14px", border: "none", background: "none", cursor: "pointer",
              fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font)",
              color: tab === t ? STEEL : "var(--text-3,#64748B)",
              borderBottom: tab === t ? `2px solid ${STEEL}` : "2px solid transparent", marginBottom: -1 }}>
            {cl(("tab_" + t) as any)}
          </button>
        ))}
      </div>

      {tab === "terms"      && <TermsTab c={c} />}
      {tab === "sla"        && <SlaTab c={c} />}
      {tab === "service"    && <ServiceTab c={c} onChanged={onChanged} />}
      {tab === "onboarding" && <OnboardingTab c={c} onChanged={onChanged} />}
      {tab === "invoices"   && <InvoicesTab c={c} onChanged={onChanged} />}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0",
      borderBottom: "1px solid #F1F5F9", fontSize: 12.5 }}>
      <span style={{ color: "var(--text-3,#64748B)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "var(--text-1,#0F172A)", textAlign: "right" }}>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3,#64748B)",
        textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function TermsTab({ c }: { c: any }) {
  const cl = useTranslations("clm")
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
      <Section title={cl("sec_commercial")}>
        <Row label={cl("f_value")} value={money2(c.amount, c.currency)} />
        <Row label={cl("f_cycle")} value={c.billingCycle} />
        <Row label={cl("f_acv")} value={money(c.acv, c.currency)} />
        <Row label={cl("f_rate")} value={c.serviceHourlyRate == null ? cl("notSet") : money2(c.serviceHourlyRate, c.currency)} />
      </Section>
      <Section title={cl("sec_period")}>
        <Row label={cl("f_start")} value={fmtD(c.startDate)} />
        <Row label={cl("f_end")} value={fmtD(c.endDate)} />
        <Row label={cl("f_renewal")} value={fmtD(c.renewalDate)} />
        <Row label={cl("f_autorenew")} value={c.autoRenew ? cl("yes") : cl("no")} />
        <Row label={cl("f_alert")} value={cl("alertDaysValue", { n: c.alertDays })} />
      </Section>
      <Section title={cl("sec_entitlements")}>
        <Row label={cl("f_seats")} value={c.paidSeats} />
        <Row label={cl("f_bundles")} value={`${c.contributorBundles} × 10`} />
        <Row label={cl("f_ocr")} value={c.ocrPageCap ? `${c.ocrPageCap} / ${cl("perMonth")}` : cl("notSet")} />
      </Section>
    </div>
  )
}

function SlaTab({ c }: { c: any }) {
  const cl = useTranslations("clm")
  const empty = !c.supportTier && c.responseHours == null && c.uptimePct == null
  if (empty) {
    return <div style={{ ...card, fontSize: 12.5, color: "var(--text-3,#64748B)" }}>{cl("noSla")}</div>
  }
  return (
    <Section title={cl("tab_sla")}>
      <Row label={cl("sla_tier")} value={c.supportTier || cl("notSet")} />
      <Row label={cl("sla_response")} value={c.responseHours == null ? cl("notSet") : cl("hours", { n: c.responseHours })} />
      <Row label={cl("sla_uptime")} value={c.uptimePct == null ? cl("notSet") : `${c.uptimePct}%`} />
    </Section>
  )
}

// ── Service log ──────────────────────────────────────────────────────────────
const EMPTY_ENTRY = {
  entryDate: new Date().toISOString().slice(0, 10),
  category: "SERVICE_REQUEST", description: "", hours: "", billable: true, performedBy: "",
}

function ServiceTab({ c, onChanged }: { c: any; onChanged: () => void }) {
  const cl = useTranslations("clm")
  const [rows, setRows]   = useState<any[] | null>(null)
  const [form, setForm]   = useState<typeof EMPTY_ENTRY | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr]     = useState("")

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/contracts/${c.id}/service`, { cache: "no-store" })
    const d = await res.json()
    setRows(res.ok ? d.data : [])
  }, [c.id])
  useEffect(() => { load() }, [load])

  async function save() {
    if (!form) return
    setSaving(true); setErr("")
    try {
      const res = await fetch(`/api/admin/contracts/${c.id}/service`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryDate: form.entryDate, category: form.category, description: form.description,
          hours: Number(form.hours) || 0, billable: form.billable,
          performedBy: form.performedBy || null,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setErr(d?.error || cl("errSave")); return }
      setForm(null); await load(); onChanged()
    } catch { setErr(cl("errSave")) }
    finally { setSaving(false) }
  }

  async function patch(id: string, body: any) {
    const res = await fetch(`/api/admin/contracts/${c.id}/service/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    if (res.ok) { await load(); onChanged() }
  }

  async function remove(id: string) {
    if (!confirm(cl("confirmDeleteEntry"))) return
    const res = await fetch(`/api/admin/contracts/${c.id}/service/${id}`, { method: "DELETE" })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(d?.error || cl("errDelete")); return }
    await load(); onChanged()
  }

  const unbilled = (rows || []).filter(r => r.billable && (r.status === "DRAFT" || r.status === "APPROVED"))
  const unbilledAmt = unbilled.reduce((s, r) => s + r.amount, 0)
  const unbilledHrs = unbilled.reduce((s, r) => s + r.hours, 0)

  return (
    <div style={{ ...card, padding: 0 }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border,#E2E8F0)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, fontSize: 11.5, color: "var(--text-3,#64748B)" }}>
            {cl("serviceIntro")}
          </div>
          <button style={btn(true)} onClick={() => setForm(form ? null : { ...EMPTY_ENTRY })}>
            {form ? cl("Cancel") : cl("+ Log work")}
          </button>
        </div>
        {unbilledAmt > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: AMBER }}>
            {cl("totalUnbilled", { amount: money2(unbilledAmt, c.currency), h: unbilledHrs })}
          </div>
        )}
        {c.serviceHourlyRate == null && (
          <div style={{ marginTop: 6, fontSize: 11.5, color: AMBER }}>
            {cl("f_rate")}: {cl("notSet")}
          </div>
        )}
      </div>

      {err && <div style={{ padding: "8px 14px", color: RED, fontSize: 12 }}>{err}</div>}

      {form && (
        <div style={{ padding: 14, background: "#F8FAFC", borderBottom: "1px solid var(--border,#E2E8F0)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
            <div>
              <label style={lbl}>{cl("sv_date")}</label>
              <input style={inp} type="date" value={form.entryDate}
                onChange={e => setForm({ ...form, entryDate: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>{cl("sv_category")}</label>
              <select style={inp} value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(v => <option key={v} value={v}>{cl(("cat_" + v) as any)}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>{cl("sv_hours")}</label>
              <input style={inp} type="number" step="0.25" min="0" value={form.hours}
                onChange={e => setForm({ ...form, hours: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>{cl("sv_by")}</label>
              <input style={inp} value={form.performedBy}
                onChange={e => setForm({ ...form, performedBy: e.target.value })} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={lbl}>{cl("sv_desc")}</label>
            <input style={inp} placeholder={cl("descPlaceholder")} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={form.billable}
                onChange={e => setForm({ ...form, billable: e.target.checked })} />
              {cl("billable")}
            </label>
            <button style={{ ...btn(true), marginLeft: "auto" }} disabled={saving || !form.description.trim()}
              onClick={save}>{saving ? cl("Saving…") : cl("Save")}</button>
          </div>
        </div>
      )}

      {!rows ? (
        <div style={{ padding: 20, fontSize: 12.5, color: "var(--text-3,#64748B)" }}>{cl("Loading…")}</div>
      ) : !rows.length ? (
        <div style={{ padding: 28, textAlign: "center", fontSize: 12.5, color: "var(--text-3,#64748B)" }}>
          {cl("noService")}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              {["date", "category", "desc", "hours", "rate", "amount", "status"].map(h =>
                <th key={h} style={th}>{cl(("sv_" + h) as any)}</th>)}
              <th style={th} />
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtD(r.entryDate)}</td>
                  <td style={td}>{cl(("cat_" + r.category) as any)}</td>
                  <td style={{ ...td, maxWidth: 260 }}>
                    {r.description}
                    {r.performedBy && (
                      <div style={{ fontSize: 10.5, color: "var(--text-3,#64748B)" }}>{r.performedBy}</div>
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{r.hours}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{money2(r.rate, c.currency)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 600 }}>
                    {r.billable ? money2(r.amount, c.currency)
                      : <span style={{ color: "var(--text-4,#94A3B8)" }}>{cl("nonBillable")}</span>}
                  </td>
                  <td style={td}>
                    <Pill text={cl(("sst_" + r.status) as any)} color={SERVICE_STATUS_COLOR[r.status] || "#64748B"} />
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
                    {r.status === "DRAFT" && (
                      <button style={miniBtn} onClick={() => patch(r.id, { status: "APPROVED" })}>
                        {cl("sst_APPROVED")}
                      </button>
                    )}
                    {r.status === "APPROVED" && (
                      <button style={miniBtn} onClick={() => patch(r.id, { status: "INVOICED" })}>
                        {cl("sst_INVOICED")}
                      </button>
                    )}
                    {r.status !== "INVOICED" && (
                      <button style={{ ...miniBtn, marginLeft: 4, color: "#B91C1C", borderColor: "#FCA5A5" }}
                        onClick={() => remove(r.id)}>{cl("Delete")}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Onboarding milestones ────────────────────────────────────────────────────
const EMPTY_MS = { name: "", amount: "", targetDate: "" }

function OnboardingTab({ c, onChanged }: { c: any; onChanged: () => void }) {
  const cl = useTranslations("clm")
  const [rows, setRows]     = useState<any[] | null>(null)
  const [form, setForm]     = useState<typeof EMPTY_MS | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState("")

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/contracts/${c.id}/onboarding`, { cache: "no-store" })
    const d = await res.json()
    setRows(res.ok ? d.data : [])
  }, [c.id])
  useEffect(() => { load() }, [load])

  async function save() {
    if (!form) return
    setSaving(true); setErr("")
    try {
      const res = await fetch(`/api/admin/contracts/${c.id}/onboarding`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, amount: Number(form.amount) || 0,
          targetDate: form.targetDate || null,
          sortOrder: (rows?.length || 0),
        }),
      })
      const d = await res.json()
      if (!res.ok) { setErr(d?.error || cl("errSave")); return }
      setForm(null); await load(); onChanged()
    } catch { setErr(cl("errSave")) }
    finally { setSaving(false) }
  }

  async function patch(id: string, body: any) {
    const res = await fetch(`/api/admin/contracts/${c.id}/onboarding/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    if (res.ok) { await load(); onChanged() }
  }

  async function remove(id: string) {
    if (!confirm(cl("confirmDeleteMilestone"))) return
    const res = await fetch(`/api/admin/contracts/${c.id}/onboarding/${id}`, { method: "DELETE" })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(d?.error || cl("errDelete")); return }
    await load(); onChanged()
  }

  const total  = (rows || []).reduce((s, m) => s + m.amount, 0)
  const billed = (rows || []).filter(m => m.status === "INVOICED").reduce((s, m) => s + m.amount, 0)
  const ready  = (rows || []).filter(m => m.status === "COMPLETED").reduce((s, m) => s + m.amount, 0)

  return (
    <div style={{ ...card, padding: 0 }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border,#E2E8F0)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, fontSize: 11.5, color: "var(--text-3,#64748B)" }}>
            {cl("onboardingIntro")}
          </div>
          <button style={btn(true)} onClick={() => setForm(form ? null : { ...EMPTY_MS })}>
            {form ? cl("Cancel") : cl("+ Add milestone")}
          </button>
        </div>
        {(rows?.length || 0) > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-2,#334155)" }}>
            {cl("obTotals", {
              billed: money(billed, c.currency), total: money(total, c.currency),
              ready: money(ready, c.currency),
            })}
          </div>
        )}
      </div>

      {err && <div style={{ padding: "8px 14px", color: RED, fontSize: 12 }}>{err}</div>}

      {form && (
        <div style={{ padding: 14, background: "#F8FAFC", borderBottom: "1px solid var(--border,#E2E8F0)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
            <div>
              <label style={lbl}>{cl("ob_name")}</label>
              <input style={inp} placeholder={cl("namePlaceholder")} value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>{cl("ob_amount")}</label>
              <input style={inp} type="number" min="0" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>{cl("ob_target")}</label>
              <input style={inp} type="date" value={form.targetDate}
                onChange={e => setForm({ ...form, targetDate: e.target.value })} />
            </div>
            <button style={btn(true)} disabled={saving || !form.name.trim()} onClick={save}>
              {saving ? cl("Saving…") : cl("Save")}
            </button>
          </div>
        </div>
      )}

      {!rows ? (
        <div style={{ padding: 20, fontSize: 12.5, color: "var(--text-3,#64748B)" }}>{cl("Loading…")}</div>
      ) : !rows.length ? (
        <div style={{ padding: 28, textAlign: "center", fontSize: 12.5, color: "var(--text-3,#64748B)" }}>
          {cl("noOnboarding")}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              {["name", "amount", "target", "completed", "status"].map(h =>
                <th key={h} style={th}>{cl(("ob_" + h) as any)}</th>)}
              <th style={th} />
            </tr></thead>
            <tbody>
              {rows.map(m => (
                <tr key={m.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{m.name}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{money2(m.amount, c.currency)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtD(m.targetDate)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtD(m.completedDate)}</td>
                  <td style={td}>
                    <Pill text={cl(("obst_" + m.status) as any)} color={ONB_STATUS_COLOR[m.status] || "#64748B"} />
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
                    {m.status === "PENDING" && (
                      <button style={miniBtn} onClick={() => patch(m.id, { status: "COMPLETED" })}>
                        {cl("Mark complete")}
                      </button>
                    )}
                    {m.status === "COMPLETED" && (
                      <button style={miniBtn} onClick={() => patch(m.id, { status: "INVOICED" })}>
                        {cl("Mark invoiced")}
                      </button>
                    )}
                    {m.status !== "INVOICED" && (
                      <button style={{ ...miniBtn, marginLeft: 4, color: "#B91C1C", borderColor: "#FCA5A5" }}
                        onClick={() => remove(m.id)}>{cl("Delete")}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Invoices: bill logged work ───────────────────────────────────────────────
const INVOICE_STATUS_COLOR: Record<string, string> = {
  DRAFT: "#64748B", SENT: STEEL, PAID: GREEN, OVERDUE: RED, VOID: "#94A3B8",
}

function InvoicesTab({ c, onChanged }: { c: any; onChanged: () => void }) {
  const cl = useTranslations("clm")
  const [invoices, setInvoices] = useState<any[] | null>(null)
  const [billable, setBillable] = useState<any>(null)
  const [picked, setPicked]     = useState<Set<string>>(new Set())
  const [form, setForm]         = useState<any>(null)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState("")
  const [editInv, setEditInv]   = useState<any>(null)
  const [savingInv, setSavingInv] = useState(false)

  const load = useCallback(async () => {
    const [ri, rb] = await Promise.all([
      fetch(`/api/admin/contracts/${c.id}/invoices`, { cache: "no-store" }),
      fetch(`/api/admin/contracts/${c.id}/invoices/from-work`, { cache: "no-store" }),
    ])
    const di = await ri.json().catch(() => ({}))
    const db2 = await rb.json().catch(() => ({}))
    setInvoices(ri.ok ? (di.data || []) : [])
    setBillable(rb.ok ? db2.data : null)
  }, [c.id])
  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    if (!billable) return []
    return [
      ...billable.entries.map((e: any) => ({ kind: "entry", id: e.id,
        label: e.description, meta: `${e.hours} h · ${fmtD(e.entryDate)}`, amount: e.amount })),
      ...billable.milestones.map((m: any) => ({ kind: "ms", id: m.id,
        label: m.name, meta: fmtD(m.completedDate), amount: m.amount })),
    ]
  }, [billable])

  const total = rows.filter(r => picked.has(r.id)).reduce((s, r) => s + r.amount, 0)

  function toggle(id: string) {
    setPicked(p => { const n2 = new Set(p); n2.has(id) ? n2.delete(id) : n2.add(id); return n2 })
  }

  async function bill() {
    setSaving(true); setErr("")
    try {
      const res = await fetch(`/api/admin/contracts/${c.id}/invoices/from-work`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryIds:     rows.filter(r => r.kind === "entry" && picked.has(r.id)).map(r => r.id),
          milestoneIds: rows.filter(r => r.kind === "ms" && picked.has(r.id)).map(r => r.id),
          number:    form.number,
          issueDate: form.issueDate,
          dueDate:   form.dueDate,
          notes:     form.notes || null,
          applyBundle: !!form.applyBundle,
          courtesy:    !!form.courtesy,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setErr(d?.error || cl("errBill")); return }
      setForm(null); setPicked(new Set()); await load(); onChanged()
    } catch { setErr(cl("errBill")) }
    finally { setSaving(false) }
  }

  async function saveInvEdit() {
    if (!editInv || savingInv || !editInv.number?.trim()) return
    setSavingInv(true); setErr("")
    try {
      const res = await fetch(`/api/admin/contracts/${c.id}/invoices/${editInv.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number:    editInv.number.trim(),
          amount:    Number(editInv.amount) || 0,
          issueDate: editInv.issueDate,
          dueDate:   editInv.dueDate,
          notes:     editInv.notes || null,
        }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d?.error || cl("errBill")); return }
      setEditInv(null); await load(); onChanged()
    } finally { setSavingInv(false) }
  }

  async function voidInvoice(iv: any) {
    if (!confirm(cl("voidConfirm"))) return
    const res = await fetch(`/api/admin/contracts/${c.id}/invoices/${iv.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "VOID" }),
    })
    if (res.ok) { await load(); onChanged() }
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/admin/contracts/${c.id}/invoices/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(status === "PAID" ? { paidDate: new Date().toISOString() } : {}) }),
    })
    if (res.ok) { await load(); onChanged() }
  }

  const today = new Date().toISOString().slice(0, 10)
  const net30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Bill logged work */}
      <div style={{ ...card, padding: 0 }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border,#E2E8F0)" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>{cl("billWork")}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-3,#64748B)", marginTop: 2 }}>
            {cl("billWorkIntro")}
          </div>
        </div>

        {err && <div style={{ padding: "8px 14px", color: RED, fontSize: 12 }}>{err}</div>}

        {!billable ? (
          <div style={{ padding: 18, fontSize: 12.5, color: "var(--text-3,#64748B)" }}>{cl("Loading…")}</div>
        ) : !rows.length ? (
          <div style={{ padding: 22, fontSize: 12.5, color: "var(--text-3,#64748B)" }}>
            {cl("nothingToBill")}
          </div>
        ) : (
          <>
            <div style={{ padding: "10px 14px" }}>
              {rows.map(r => (
                <label key={r.id} style={{ display: "flex", alignItems: "baseline", gap: 9,
                  padding: "6px 0", fontSize: 12.5, cursor: "pointer",
                  borderBottom: "1px solid #F1F5F9" }}>
                  <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
                  <span style={{ flex: 1 }}>
                    {r.label}
                    <span style={{ color: "var(--text-3,#64748B)", marginLeft: 8, fontSize: 11 }}>
                      {r.kind === "ms" ? cl("msSection") : cl("svcSection")} · {r.meta}
                    </span>
                  </span>
                  <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {money2(r.amount, c.currency)}
                  </span>
                </label>
              ))}
            </div>

            <div style={{ padding: "10px 14px", background: "#F8FAFC",
              borderTop: "1px solid var(--border,#E2E8F0)", display: "flex",
              alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--text-3,#64748B)" }}>
                {cl("selectedCount", { n: picked.size })}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: NAVY,
                fontVariantNumeric: "tabular-nums" }}>
                {cl("billTotal", { amount: money2(total, c.currency) })}
              </span>
              <button style={{ ...btn(true), marginLeft: "auto" }} disabled={!picked.size}
                onClick={() => setForm({ number: "", issueDate: today, dueDate: net30, notes: "",
                  applyBundle: false, courtesy: false })}>
                {cl("billSelected")}
              </button>
            </div>
          </>
        )}

        {form && (
          <div style={{ padding: 14, borderTop: "1px solid var(--border,#E2E8F0)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
              <div>
                <label style={lbl}>{cl("inv_number")}</label>
                <input style={inp} value={form.number} placeholder={cl("numberPlaceholder")}
                  onChange={e => setForm({ ...form, number: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>{cl("inv_issue")}</label>
                <input style={inp} type="date" value={form.issueDate}
                  onChange={e => setForm({ ...form, issueDate: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>{cl("inv_due")}</label>
                <input style={inp} type="date" value={form.dueDate}
                  onChange={e => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={lbl}>{cl("inv_notes")}</label>
              <input style={inp} value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            {(() => {
              // Mirror of the server's bundle math, for preview only — the
              // amount that lands on the invoice is computed server-side.
              const bH = Number(billable?.serviceBundleHours) || 0
              const bP = billable?.serviceBundlePrice
              const sel = rows.filter(r => r.kind === "entry" && picked.has(r.id))
              const selIds = new Set(sel.map(r => r.id))
              const ent = (billable?.entries || []).filter((e: any) => selIds.has(e.id))
              const svcHours  = ent.reduce((s2: number, e: any) => s2 + (Number(e.hours) || 0), 0)
              const svcAmount = ent.reduce((s2: number, e: any) => s2 + (Number(e.amount) || 0), 0)
              const avgRate = svcHours > 0 ? svcAmount / svcHours : 0
              // (1) free onboarding hours (one-time allowance)
              const freeHours = (billable?.bundleInOnboarding && bH > 0)
                ? Math.min(svcHours, Math.max(0, bH - (Number(billable?.hoursAlreadyInvoiced) || 0)))
                : 0
              const freeDisc = Math.round(freeHours * avgRate * 100) / 100
              // (2) prepaid bundle on chargeable hours
              const chHours = svcHours - freeHours
              const bundles = bH > 0 ? Math.floor(chHours / bH) : 0
              const bundleDisc = (form.applyBundle && bundles > 0 && bP != null && chHours > 0)
                ? Math.max(0, Math.round(bundles * (bH * avgRate - Number(bP)) * 100) / 100)
                : 0
              // (3) negotiated service %
              const pct = Number(billable?.serviceDiscountPct) || 0
              const pctDisc = pct > 0
                ? Math.round(Math.max(0, svcAmount - freeDisc - bundleDisc) * pct) / 100
                : 0
              const disc = Math.round((freeDisc + bundleDisc + pctDisc) * 100) / 100
              const canBundle = bH > 0 && bP != null
              return (
                <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap" }}>
                  {canBundle && (
                    <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12,
                      color: bundles > 0 ? NAVY : "var(--text-3,#64748B)", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!form.applyBundle} disabled={bundles === 0}
                        onChange={e => setForm({ ...form, applyBundle: e.target.checked })} />
                      {cl("applyBundle", { n: bundles, h: bH,
                        d: money2(disc, billable?.currency || c.currency) })}
                    </label>
                  )}
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12,
                    color: NAVY, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!form.courtesy}
                      onChange={e => setForm({ ...form, courtesy: e.target.checked })} />
                    {cl("courtesyToggle")}
                  </label>
                  {freeDisc > 0 && (
                    <span style={{ fontSize: 11.5, color: GREEN }}>
                      {cl("onbFreeChip", { h: freeHours,
                        d: money2(freeDisc, billable?.currency || c.currency) })}
                    </span>
                  )}
                  {pctDisc > 0 && (
                    <span style={{ fontSize: 11.5, color: GREEN }}>
                      {cl("svcDiscChip", { pct,
                        d: money2(pctDisc, billable?.currency || c.currency) })}
                    </span>
                  )}
                  {(disc > 0 || form.courtesy) && (
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: GREEN, marginLeft: "auto",
                      fontVariantNumeric: "tabular-nums" }}>
                      {cl("billTotal", { amount: money2(
                        form.courtesy ? 0 : Math.max(0, total - disc),
                        billable?.currency || c.currency) })}
                    </span>
                  )}
                </div>
              )
            })()}
            <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
              <button style={btn()} onClick={() => setForm(null)}>{cl("Cancel")}</button>
              <button style={btn(true)} disabled={saving || !form.number.trim()} onClick={bill}>
                {saving ? cl("Saving…") : cl("billSelected")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Existing invoices */}
      <div style={{ ...card, padding: 0 }}>
        <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border,#E2E8F0)",
          fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase",
          color: "var(--text-3,#64748B)" }}>
          {cl("invoicesCount", { n: invoices?.length || 0 })}
        </div>
        {!invoices ? (
          <div style={{ padding: 18, fontSize: 12.5, color: "var(--text-3,#64748B)" }}>{cl("Loading…")}</div>
        ) : !invoices.length ? (
          <div style={{ padding: 22, textAlign: "center", fontSize: 12.5,
            color: "var(--text-3,#64748B)" }}>{cl("noInvoices")}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {["number", "amount", "issued", "due", "status"].map(h =>
                  <th key={h} style={th}>{cl(("i_" + h) as any)}</th>)}
                <th style={th} />
              </tr></thead>
              <tbody>
                {invoices.map((iv: any) => {
                  const workCount = (iv.serviceEntries?.length || 0) + (iv.onboardingMilestones?.length || 0)
                  return (
                    <tr key={iv.id}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {iv.number}
                        {workCount > 0 && (
                          <div style={{ fontSize: 10.5, color: "var(--text-3,#64748B)" }}>
                            {cl("billedWork", { n: workCount })}
                          </div>
                        )}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {money2(Number(iv.amount), iv.currency || c.currency)}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtD(iv.issueDate)}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtD(iv.dueDate)}</td>
                      <td style={td}>
                        <Pill text={cl(("ist_" + iv.status) as any)}
                          color={INVOICE_STATUS_COLOR[iv.status] || "#64748B"} />
                      </td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                        <button style={miniBtn}
                          onClick={() => window.open(`/admin/contracts/${c.id}/invoices/${iv.id}/print`, "_blank")}>
                          {cl("invoicePdf")}
                        </button>
                        {iv.status !== "VOID" && iv.status !== "PAID" && (
                          <button style={miniBtn} onClick={() => setEditInv({
                            id: iv.id, number: iv.number, amount: String(Number(iv.amount)),
                            issueDate: String(iv.issueDate).slice(0, 10),
                            dueDate: String(iv.dueDate).slice(0, 10),
                            notes: iv.notes || "",
                          })}>
                            {cl("invEdit")}
                          </button>
                        )}
                        {iv.status !== "VOID" && iv.status !== "PAID" && (
                          <button style={{ ...miniBtn, color: RED }} onClick={() => voidInvoice(iv)}>
                            {cl("invVoid")}
                          </button>
                        )}
                        {iv.status === "DRAFT" && (
                          <button style={miniBtn} onClick={() => setStatus(iv.id, "SENT")}>
                            {cl("Mark sent")}
                          </button>
                        )}
                        {(iv.status === "SENT" || iv.status === "OVERDUE") && (
                          <button style={miniBtn} onClick={() => setStatus(iv.id, "PAID")}>
                            {cl("Mark paid")}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {editInv && (
          <div style={{ padding: 14, borderTop: "1px solid var(--border,#E2E8F0)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
              {cl("invEditTitle", { number: editInv.number })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
              <div><label style={lbl}>{cl("inv_number")}</label>
                <input style={inp} value={editInv.number}
                  onChange={e => setEditInv({ ...editInv, number: e.target.value })} /></div>
              <div><label style={lbl}>{cl("i_amount")}</label>
                <input style={inp} type="number" min="0" step="0.01" value={editInv.amount}
                  onChange={e => setEditInv({ ...editInv, amount: e.target.value })} /></div>
              <div><label style={lbl}>{cl("inv_issue")}</label>
                <input style={inp} type="date" value={editInv.issueDate}
                  onChange={e => setEditInv({ ...editInv, issueDate: e.target.value })} /></div>
              <div><label style={lbl}>{cl("inv_due")}</label>
                <input style={inp} type="date" value={editInv.dueDate}
                  onChange={e => setEditInv({ ...editInv, dueDate: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={lbl}>{cl("inv_notes")}</label>
              <input style={inp} value={editInv.notes}
                onChange={e => setEditInv({ ...editInv, notes: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
              <button style={btn()} onClick={() => setEditInv(null)}>{cl("Cancel")}</button>
              <button style={btn(true)} disabled={savingInv || !editInv.number?.trim()} onClick={saveInvEdit}>
                {savingInv ? cl("Saving…") : cl("Save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
