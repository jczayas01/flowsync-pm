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

// ── Portfolio KPI tile ───────────────────────────────────────────────────────
function Kpi({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3,#64748B)",
        textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || NAVY, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-3,#64748B)", marginTop: 4 }}>{sub}</div>}
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
  const [data, setData]       = useState<any>(null)
  const [error, setError]     = useState("")
  const [openId, setOpenId]   = useState<string | null>(null)
  const [search, setSearch]   = useState("")
  const [statusF, setStatusF] = useState("")

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
      if (statusF && c.status !== statusF) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || (c.workspace?.name || "").toLowerCase().includes(q)
    })
  }, [contracts, search, statusF])

  if (error) {
    return <div style={{ ...card, color: RED, fontSize: 12.5 }}>{error}</div>
  }
  if (!data) {
    return <div style={{ ...card, color: "var(--text-3,#64748B)", fontSize: 12.5 }}>{cl("Loading…")}</div>
  }

  if (open) {
    return (
      <ContractRecord
        contract={open}
        onBack={() => setOpenId(null)}
        onEdit={() => onEdit(open.id)}
        onChanged={load}
      />
    )
  }

  const s = data.summary

  return (
    <div>
      {/* ── KPI strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
        gap: 10, marginBottom: 14 }}>
        <Kpi label={cl("kpi_arr")} value={money(s.arr)} sub={cl("kpi_arr_sub")} color={GREEN} />
        <Kpi label={cl("kpi_contracts")} value={String(s.total)}
          sub={cl("kpi_contracts_sub", { n: s.byStatus?.ACTIVE || 0 })} />
        <Kpi label={cl("kpi_renewals")} value={String(s.renewals90)} sub={cl("kpi_renewals_sub")}
          color={s.renewals30 > 0 ? AMBER : undefined} />
        <Kpi label={cl("kpi_overdue")} value={money(s.overdueAmount)}
          sub={cl("kpi_overdue_sub", { n: s.overdueCount })}
          color={s.overdueCount > 0 ? RED : undefined} />
        <Kpi label={cl("kpi_unbilled")} value={money(s.unbilledAmount)}
          sub={cl("kpi_unbilled_sub", { h: s.unbilledHours })}
          color={s.unbilledAmount > 0 ? AMBER : undefined} />
        <Kpi label={cl("kpi_onboarding")} value={money(s.onboardingReadyToBill)}
          sub={cl("kpi_onboarding_sub")} color={s.onboardingReadyToBill > 0 ? AMBER : undefined} />
      </div>

      {/* ── Renewal runway ── */}
      <RenewalRunway contracts={contracts} onOpen={setOpenId} />

      {/* ── Contract table ── */}
      <div style={{ ...card, padding: 0, marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "12px 14px", borderBottom: "1px solid var(--border,#E2E8F0)" }}>
          <strong style={{ fontSize: 13, color: NAVY }}>{cl("allContracts")}</strong>
          <input style={{ ...inp, width: 200, marginLeft: "auto" }} placeholder={cl("search")}
            value={search} onChange={e => setSearch(e.target.value)} />
          <select style={{ ...inp, width: 150 }} value={statusF} onChange={e => setStatusF(e.target.value)}>
            <option value="">{cl("filterAll")}</option>
            {Object.keys(STATUS_COLOR).map(v => (
              <option key={v} value={v}>{cl(("st_" + v) as any)}</option>
            ))}
          </select>
          <button style={btn(true)} onClick={onNew}>{cl("+ New contract")}</button>
        </div>

        {!filtered.length ? (
          <div style={{ padding: 28, textAlign: "center", fontSize: 12.5, color: "var(--text-3,#64748B)" }}>
            {contracts.length ? cl("noMatch") : cl("noContracts")}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {["customer", "contract", "status", "value", "acv", "renewal", "health"].map(h =>
                  <th key={h} style={th}>{cl(("col_" + h) as any)}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} onClick={() => setOpenId(c.id)}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ ...td, fontWeight: 600, color: NAVY }}>{c.workspace?.name || "—"}</td>
                    <td style={td}>{c.name}</td>
                    <td style={td}>
                      <Pill text={cl(("st_" + c.status) as any)} color={STATUS_COLOR[c.status] || "#64748B"} />
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{money(c.amount, c.currency)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 600 }}>{money(c.acv, c.currency)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {fmtD(c.renewalDate || c.endDate)}
                      <div style={{ fontSize: 10.5, color: c.expired ? RED : c.inAlertWindow ? AMBER : "var(--text-3,#64748B)" }}>
                        {c.expired
                          ? cl("expired", { n: Math.abs(c.daysToRenewal) })
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Renewal runway ───────────────────────────────────────────────────────────
function RenewalRunway({ contracts, onOpen }: { contracts: any[]; onOpen: (id: string) => void }) {
  const cl = useTranslations("clm")
  const buckets = useMemo(() => {
    const active = contracts.filter(c => c.status === "ACTIVE" && c.daysToRenewal >= 0)
    return [
      { key: "in30", color: RED,   items: active.filter(c => c.daysToRenewal <= 30) },
      { key: "in60", color: AMBER, items: active.filter(c => c.daysToRenewal > 30 && c.daysToRenewal <= 60) },
      { key: "in90", color: STEEL, items: active.filter(c => c.daysToRenewal > 60 && c.daysToRenewal <= 90) },
    ]
  }, [contracts])

  const any = buckets.some(b => b.items.length)

  return (
    <div style={card}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, marginBottom: 10 }}>
        {cl("renewalRunway")}
      </div>
      {!any ? (
        <div style={{ fontSize: 12, color: "var(--text-3,#64748B)" }}>{cl("noRenewals")}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          {buckets.map(b => (
            <div key={b.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: b.color }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2,#334155)" }}>
                  {cl(b.key as any)}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-3,#64748B)" }}>({b.items.length})</span>
              </div>
              {b.items.map(c => (
                <div key={c.id} onClick={() => onOpen(c.id)}
                  style={{ padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                    borderLeft: `3px solid ${b.color}`, background: "#F8FAFC", marginBottom: 5 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{c.workspace?.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-3,#64748B)" }}>
                    {money(c.acv, c.currency)} · {fmtD(c.renewalDate || c.endDate)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Single-contract record
function ContractRecord({ contract, onBack, onEdit, onChanged }: {
  contract: any; onBack: () => void; onEdit: () => void; onChanged: () => void
}) {
  const cl = useTranslations("clm")
  const [tab, setTab] = useState<"terms" | "sla" | "service" | "onboarding">("terms")
  const c = contract

  const TABS = ["terms", "sla", "service", "onboarding"] as const

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
