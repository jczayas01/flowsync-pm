"use client"
// src/components/admin/ContractsPanel.tsx
// Enterprise Contracts / CLM — first-class tab in Platform Admin.
// Self-fetching (GET /api/admin/contracts) so AdminView's server props stay
// untouched. Covers: contract terms + expiration alerting, bundle package,
// SLA commitments, invoice records, attached signed documents.

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { enumLabel } from "@/lib/enum-labels"
import { dateLocale } from "@/lib/date-locale"

const S: Record<string, { color: string; bg: string }> = {
  DRAFT:      { color: "#64748B", bg: "#F8FAFC" },
  ACTIVE:     { color: "#059669", bg: "#ECFDF5" },
  EXPIRED:    { color: "#DC2626", bg: "#FEF2F2" },
  TERMINATED: { color: "#7C3AED", bg: "#F5F3FF" },
  RENEWED:    { color: "#1B6CA8", bg: "#EFF6FF" },
}
const INV: Record<string, { color: string; bg: string }> = {
  DRAFT:   { color: "#64748B", bg: "#F8FAFC" },
  SENT:    { color: "#1B6CA8", bg: "#EFF6FF" },
  PAID:    { color: "#059669", bg: "#ECFDF5" },
  OVERDUE: { color: "#DC2626", bg: "#FEF2F2" },
  VOID:    { color: "#94A3B8", bg: "#F8FAFC" },
}

const inp: React.CSSProperties = {
  width: "100%", padding: "7px 10px", border: "1px solid var(--border,#E2E8F0)",
  borderRadius: 7, fontSize: 12.5, fontFamily: "var(--font)", background: "#fff",
}
const lbl: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-3,#64748B)", marginBottom: 4,
}
const btn = (primary = false): React.CSSProperties => ({
  padding: "7px 14px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
  border: primary ? "none" : "1px solid var(--border,#E2E8F0)",
  background: primary ? "var(--steel,#1B6CA8)" : "#fff",
  color: primary ? "#fff" : "var(--text-1,#0F172A)", fontFamily: "var(--font)",
})
const chip = (c: { color: string; bg: string }, label: string) => (
  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
    color: c.color, background: c.bg, border: `1px solid ${c.color}30` }}>{label}</span>
)
const money = (n?: number | null, cur = "USD") =>
  n == null ? "—" : `$${Number(n).toLocaleString()} ${cur !== "USD" ? cur : ""}`.trim()
const fmtD = (d?: string | null) => d ? new Date(d).toLocaleDateString(dateLocale(),
  { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—"

/** One source of truth for contract pricing — Calculate, the breakdown line
 *  and the first invoice all read this. Mirrors the negotiation sheet:
 *  (seats + contributor bundles + extra OCR packs + service retainer) per
 *  month × cycle, per-component discounts, first OCR pack always included,
 *  onboarding one-time. */
export function contractMath(f: any) {
  const nn = (v: any, def = 0) => (v === "" || v == null ? def : Number(v) || 0)
  const seatPrice   = nn(f.seatUnitPrice, 39)
  const bundlePrice = nn(f.contributorBundlePrice, 20)
  const ocrPrice    = nn(f.ocrPackPrice, 10)
  const perMoSeats  = nn(f.paidSeats) * seatPrice
  const perMoBund   = nn(f.contributorBundles) * bundlePrice
  const subDisc     = Math.min(100, nn(f.subscriptionDiscountPct))
  const onbDisc     = Math.min(100, nn(f.onboardingDiscountPct))
  const svcDisc     = Math.min(100, nn(f.serviceDiscountPct))
  // First 200-page pack is included in the plan; only extra packs bill.
  const ocrPacks    = Math.max(0, Math.ceil(nn(f.ocrPageCap) / 200) - 1)
  const perMoOcr    = ocrPacks * ocrPrice
  const pkgHours    = nn(f.serviceBundleHours)
  const pkgPrice    = Math.round(pkgHours * nn(f.serviceHourlyRate) * (1 - svcDisc / 100) * 100) / 100
  const retainer    = nn(f.serviceRetainerPackages)
  const perMoSvc    = retainer * pkgPrice
  const cyc         = f.billingCycle === "MONTHLY" ? 1 : 12
  const r2 = (x: number) => Math.round(x * 100) / 100
  const subAnnual   = r2((perMoSeats + perMoBund) * (1 - subDisc / 100) * cyc)
  const ocrAnnual   = r2(perMoOcr * cyc)
  const svcAnnual   = r2(perMoSvc * cyc)
  // Onboarding-included package: one package free, once, on the first bill.
  const firstFree   = f.bundleInOnboarding && retainer > 0 ? pkgPrice : 0
  const onboarding  = r2(nn(f.onboardingFee) * (1 - onbDisc / 100))
  const total       = r2(subAnnual + ocrAnnual + svcAnnual - firstFree + onboarding)
  return { seatPrice, bundlePrice, ocrPrice, perMoSeats, perMoBund, perMoOcr,
           ocrPacks, pkgPrice, pkgHours, retainer, perMoSvc, cyc,
           subDisc, onbDisc, svcDisc, subAnnual, ocrAnnual, svcAnnual,
           firstFree, onboarding, total }
}

const EMPTY_FORM = {
  workspaceId: "", name: "", status: "DRAFT", startDate: "", endDate: "", renewalDate: "",
  autoRenew: false, alertDays: 60, paidSeats: 0, contributorBundles: 0, ocrPageCap: "",
  billingCycle: "ANNUAL", amount: "", currency: "USD",
  supportTier: "", responseHours: "", uptimePct: "", slaNotes: "", notes: "",
  serviceHourlyRate: "", onboardingFee: "",
  serviceBundleHours: "", serviceBundlePrice: "",
  subscriptionDiscountPct: "", onboardingDiscountPct: "", serviceDiscountPct: "",
  bundleInOnboarding: false,
  seatUnitPrice: "", contributorBundlePrice: "", ocrPackPrice: "",
  serviceRetainerPackages: "",
}

export function ContractsPanel({ workspaces, driveEditId, driveNew, onModalClose, onSaved, hideList }: {
  workspaces: { id: string; name: string; plan?: string }[]
  driveEditId?: string | null
  driveNew?: boolean
  onModalClose?: () => void
  onSaved?: () => void
  hideList?: boolean
}) {
  const locale = useLocale()
  const ct = useTranslations("contracts")
  const [contracts, setContracts] = useState<any[] | null>(null)
  const [error, setError] = useState("")
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<any | null>(null) // null | "new" | contract
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  async function load() {
    setError("")
    const res = await fetch("/api/admin/contracts").catch(() => null)
    if (!res || !res.ok) { setError(ct("errLoad")); setContracts([]); return }
    const d = await res.json().catch(() => ({}))
    setContracts(d.data || [])
  }
  useEffect(() => { load() }, [])

  // Externally driven modal: the CLM workspace owns the list, this panel owns the
  // one contract form. Waits for `contracts` so startEdit has a record to read.
  useEffect(() => {
    if (driveNew) { startNew(); return }
    if (driveEditId && contracts) {
      const c = contracts.find((x: any) => x.id === driveEditId)
      if (c) startEdit(c)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveNew, driveEditId, contracts])

  function startNew() {
    setForm({ ...EMPTY_FORM })
    setEditing("new")
  }
  function startEdit(c: any) {
    setForm({
      workspaceId: c.workspaceId, name: c.name, status: c.status,
      startDate: c.startDate?.slice(0, 10) || "", endDate: c.endDate?.slice(0, 10) || "",
      renewalDate: c.renewalDate?.slice(0, 10) || "",
      autoRenew: c.autoRenew, alertDays: c.alertDays,
      paidSeats: c.paidSeats, contributorBundles: c.contributorBundles,
      ocrPageCap: c.ocrPageCap ?? "", billingCycle: c.billingCycle,
      amount: c.amount ?? "", currency: c.currency,
      supportTier: c.supportTier || "", responseHours: c.responseHours ?? "",
      uptimePct: c.uptimePct ?? "", slaNotes: c.slaNotes || "", notes: c.notes || "",
      serviceHourlyRate: c.serviceHourlyRate ?? "", onboardingFee: c.onboardingFee ?? "",
      serviceBundleHours: c.serviceBundleHours ?? "", serviceBundlePrice: c.serviceBundlePrice ?? "",
      subscriptionDiscountPct: c.subscriptionDiscountPct ?? "",
      onboardingDiscountPct: c.onboardingDiscountPct ?? "",
      serviceDiscountPct: c.serviceDiscountPct ?? "",
      bundleInOnboarding: !!c.bundleInOnboarding,
      seatUnitPrice: c.seatUnitPrice ?? "", contributorBundlePrice: c.contributorBundlePrice ?? "",
      ocrPackPrice: c.ocrPackPrice ?? "", serviceRetainerPackages: c.serviceRetainerPackages ?? "",
    })
    setEditing(c)
  }

  async function save(withInvoice = false) {
    if (!form.workspaceId || !form.name.trim() || !form.startDate || !form.endDate) {
      setError(ct("errRequired")); return
    }
    setSaving(true); setError("")
    const payload: any = {
      ...form,
      renewalDate: form.renewalDate || null,
      alertDays: Number(form.alertDays) || 60,
      paidSeats: Number(form.paidSeats) || 0,
      contributorBundles: Number(form.contributorBundles) || 0,
      ocrPageCap: form.ocrPageCap === "" ? null : Number(form.ocrPageCap),
      amount: form.amount === "" ? null : Number(form.amount),
      responseHours: form.responseHours === "" ? null : Number(form.responseHours),
      uptimePct: form.uptimePct === "" ? null : Number(form.uptimePct),
      supportTier: form.supportTier || null,
      slaNotes: form.slaNotes || null,
      notes: form.notes || null,
      serviceHourlyRate: form.serviceHourlyRate === "" ? null : Number(form.serviceHourlyRate),
      onboardingFee:     form.onboardingFee === "" ? null : Number(form.onboardingFee),
      serviceBundleHours: form.serviceBundleHours === "" ? null : Number(form.serviceBundleHours),
      serviceBundlePrice: form.serviceBundlePrice === "" ? null : Number(form.serviceBundlePrice),
      subscriptionDiscountPct: form.subscriptionDiscountPct === "" ? null : Number(form.subscriptionDiscountPct),
      onboardingDiscountPct:   form.onboardingDiscountPct   === "" ? null : Number(form.onboardingDiscountPct),
      serviceDiscountPct:      form.serviceDiscountPct      === "" ? null : Number(form.serviceDiscountPct),
      bundleInOnboarding:      !!form.bundleInOnboarding,
      seatUnitPrice:          form.seatUnitPrice          === "" ? null : Number(form.seatUnitPrice),
      contributorBundlePrice: form.contributorBundlePrice === "" ? null : Number(form.contributorBundlePrice),
      ocrPackPrice:           form.ocrPackPrice           === "" ? null : Number(form.ocrPackPrice),
      serviceRetainerPackages: form.serviceRetainerPackages === "" ? null : Number(form.serviceRetainerPackages),
    }
    const isNew = editing === "new"
    const res = await fetch(isNew ? "/api/admin/contracts" : `/api/admin/contracts/${editing.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? payload : (({ workspaceId, ...rest }) => rest)(payload)),
    }).catch(() => null)
    if (!res || !res.ok) {
      setSaving(false)
      const d = await res?.json().catch(() => ({}))
      setError(d?.error || ct("Save failed")); return
    }

    // First invoice: discounted subscription period + discounted onboarding.
    // Same math as Calculate; the breakdown rides in the notes so the PDF
    // shows the negotiation, not just a bare number.
    if (withInvoice && isNew) {
      try {
        const created = await res.json().catch(() => ({}))
        const contractId = created?.data?.id
        if (contractId) {
          const m = contractMath(form)
          // Contract amount wins when the admin typed their own negotiated
          // figure; the formula is the fallback.
          const amount = form.amount !== "" ? Number(form.amount) : m.total
          const now = new Date()
          const number = `FSPM-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`
          const fm = (x: number) => x.toLocaleString("en-US")
          const noteLines: string[] = []
          if (m.perMoSeats > 0) noteLines.push(
            `Sillas / Seats: ${form.paidSeats} × $${fm(m.seatPrice)}/mo`)
          if (m.perMoBund > 0) noteLines.push(
            `Paquetes colaboradores / Contributor bundles: ${form.contributorBundles} × $${fm(m.bundlePrice)}/mo`)
          if (m.subDisc > 0) noteLines.push(`Descuento suscripción / Subscription discount: −${m.subDisc}%`)
          if (m.ocrPacks > 0) noteLines.push(
            `OCR: +${m.ocrPacks} × $${fm(m.ocrPrice)}/mo (primeras 200 pág. incluidas / first 200 pages included)`)
          if (m.retainer > 0) noteLines.push(
            `Servicio / Service: ${m.retainer} × ${m.pkgHours} h/mo @ $${fm(m.pkgPrice)}${m.svcDisc > 0 ? ` (−${m.svcDisc}%)` : ""}`)
          if (m.firstFree > 0) noteLines.push(
            `Primer paquete incluido en onboarding / First package included: −$${fm(m.firstFree)}`)
          if (m.onboarding > 0) noteLines.push(
            `Onboarding: $${fm(m.onboarding)}${m.onbDisc > 0 ? ` (−${m.onbDisc}%)` : ""}`)
          const ri = await fetch(`/api/admin/contracts/${contractId}/invoices`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              number, amount,
              issueDate: new Date().toISOString().slice(0, 10),
              dueDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
              status: "DRAFT",
              notes: noteLines.join("\n"),
            }),
          }).catch(() => null)
          const di = await ri?.json().catch(() => ({}))
          const invoiceId = di?.data?.id
          if (invoiceId) window.open(`/admin/contracts/${contractId}/invoices/${invoiceId}/print`, "_blank")
        }
      } catch { /* the contract itself saved — the invoice can be created from the record */ }
    }

    setSaving(false)
    setEditing(null); load(); onSaved?.(); onModalClose?.()
  }

  async function removeContract(c: any) {
    if (!window.confirm(ct("deleteConfirm", { name: c.name }))) return
    await fetch(`/api/admin/contracts/${c.id}`, { method: "DELETE" }).catch(() => {})
    load()
  }

  // ── Invoices ──
  const [invFor, setInvFor] = useState<any | null>(null)
  const [invForm, setInvForm] = useState({ number: "", amount: "", issueDate: "", dueDate: "", status: "DRAFT", notes: "" })
  async function saveInvoice() {
    if (!invForm.number || !invForm.amount || !invForm.issueDate || !invForm.dueDate) return
    const res = await fetch(`/api/admin/contracts/${invFor.id}/invoices`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...invForm, amount: Number(invForm.amount), notes: invForm.notes || null }),
    }).catch(() => null)
    if (res?.ok) { setInvFor(null); setInvForm({ number: "", amount: "", issueDate: "", dueDate: "", status: "DRAFT", notes: "" }); load() }
  }
  async function setInvoiceStatus(c: any, inv: any, status: string) {
    await fetch(`/api/admin/contracts/${c.id}/invoices/${inv.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {})
    load()
  }

  // ── Documents ──
  async function uploadDoc(c: any, file: File) {
    const fd = new FormData(); fd.append("file", file)
    const res = await fetch(`/api/admin/contracts/${c.id}/documents`, { method: "POST", body: fd }).catch(() => null)
    if (!res?.ok) { const d = await res?.json().catch(() => ({})); setError(d?.error || ct("Upload failed")) }
    load()
  }

  const daysLeft = (c: any) => {
    const anchor = Math.min(new Date(c.endDate).getTime(),
      c.renewalDate ? new Date(c.renewalDate).getTime() : Infinity)
    return Math.ceil((anchor - Date.now()) / 864e5)
  }

  return (
    <div>
      {!hideList && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text-3)" }}>
          {contracts ? ct("contractCount", { n: contracts.length }) : ct("Loading…")}
          {" · "}{ct("alertHint")}
        </div>
        <button style={btn(true)} onClick={startNew}>{ct("+ New contract")}</button>
      </div>}

      {error && <div style={{ marginBottom: 12, padding: "8px 12px", background: "#FEF2F2",
        border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#B91C1C" }}>{error}</div>}

      {!hideList && contracts?.map(c => {
        const dl = daysLeft(c)
        const dlColor = dl < 0 ? "#DC2626" : dl <= c.alertDays ? "#D97706" : "#059669"
        const isOpen = !!open[c.id]
        return (
          <div key={c.id} style={{ border: "1px solid var(--border,#E2E8F0)", borderRadius: 10,
            marginBottom: 10, background: "#fff", overflow: "hidden" }}>
            <div onClick={() => setOpen(o => ({ ...o, [c.id]: !o[c.id] }))}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                cursor: "pointer", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--text-3)", width: 10 }}>{isOpen ? "▾" : "▸"}</span>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.workspace?.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
              </div>
              {chip(S[c.status] || S.DRAFT, ct(("st_" + (S[c.status] ? c.status : "DRAFT")) as any))}
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                {ct("seatsSummary", { seats: c.paidSeats, bundles: c.contributorBundles })}
                {c.ocrPageCap ? ct("ocrSummary", { pages: c.ocrPageCap }) : ""}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700 }}>{money(c.amount, c.currency)}
                <span style={{ color: "var(--text-3)", fontWeight: 500 }}> /{c.billingCycle === "MONTHLY" ? ct("perMo") : ct("perYr")}</span>
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: dlColor }}>
                {fmtD(c.endDate)} · {dl < 0 ? ct("daysOverdue", { n: -dl }) : ct("daysLeft", { n: dl })}
              </div>
              <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                <button style={btn()} onClick={() => startEdit(c)}>{ct("Edit")}</button>
                <button style={{ ...btn(), color: "#DC2626" }} onClick={() => removeContract(c)}>{ct("Delete")}</button>
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: "1px solid var(--border,#E2E8F0)", padding: "14px 16px",
                background: "var(--bg-2,#F8FAFC)", display: "grid", gap: 16 }}>
                {/* SLA */}
                <div style={{ fontSize: 12, color: "var(--text-2,#334155)" }}>
                  <b>{ct("SLA:")}</b> {ct("slaTier", { tier: c.supportTier || "—" })}
                  {c.responseHours != null ? ct("slaResponse", { h: c.responseHours }) : ""}
                  {c.uptimePct != null ? ct("slaUptime", { pct: c.uptimePct }) : ""}
                  {c.slaNotes ? ` · ${c.slaNotes}` : ""}
                  {c.autoRenew ? ct("slaAutoRenew") : ""}
                  {c.renewalDate ? ct("slaRenewal", { date: fmtD(c.renewalDate) }) : ""}
                </div>

                {/* Invoices */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
                      textTransform: "uppercase", color: "var(--text-3)" }}>{ct("invoicesCount", { n: c.invoices?.length || 0 })}</div>
                    <button style={btn()} onClick={() => setInvFor(invFor?.id === c.id ? null : c)}>
                      {invFor?.id === c.id ? ct("Cancel") : ct("+ Invoice")}
                    </button>
                  </div>
                  {invFor?.id === c.id && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8,
                      marginBottom: 10, alignItems: "end" }}>
                      <div><label style={lbl}>{ct("Number")}</label>
                        <input style={inp} value={invForm.number} placeholder="INV-2026-001"
                          onChange={e => setInvForm(f => ({ ...f, number: e.target.value }))} /></div>
                      <div><label style={lbl}>{ct("Amount")}</label>
                        <input style={inp} type="number" value={invForm.amount}
                          onChange={e => setInvForm(f => ({ ...f, amount: e.target.value }))} /></div>
                      <div><label style={lbl}>{ct("Issued")}</label>
                        <input style={inp} type="date" value={invForm.issueDate}
                          onChange={e => setInvForm(f => ({ ...f, issueDate: e.target.value }))} /></div>
                      <div><label style={lbl}>{ct("Due")}</label>
                        <input style={inp} type="date" value={invForm.dueDate}
                          onChange={e => setInvForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
                      <button style={btn(true)} onClick={saveInvoice}>{ct("Add")}</button>
                    </div>
                  )}
                  {(c.invoices || []).map((inv: any) => (
                    <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10,
                      padding: "7px 10px", background: "#fff", border: "1px solid var(--border,#E2E8F0)",
                      borderRadius: 7, marginBottom: 6, fontSize: 12, flexWrap: "wrap" }}>
                      <b>{inv.number}</b>
                      <span>{money(inv.amount, inv.currency)}</span>
                      <span style={{ color: "var(--text-3)" }}>{ct("invIssuedDue", { issued: fmtD(inv.issueDate), due: fmtD(inv.dueDate) })}</span>
                      {inv.paidDate && <span style={{ color: "#059669" }}>{ct("invPaid", { date: fmtD(inv.paidDate) })}</span>}
                      {chip(INV[inv.status] || INV.DRAFT, ct(("inv_" + (INV[inv.status] ? inv.status : "DRAFT")) as any))}
                      <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                        {inv.status !== "PAID" && (
                          <button style={btn()} onClick={() => setInvoiceStatus(c, inv, "PAID")}>{ct("Mark paid")}</button>
                        )}
                        {inv.status === "DRAFT" && (
                          <button style={btn()} onClick={() => setInvoiceStatus(c, inv, "SENT")}>{ct("Mark sent")}</button>
                        )}
                      </span>
                    </div>
                  ))}
                  {!c.invoices?.length && <div style={{ fontSize: 12, color: "var(--text-3)" }}>{ct("No invoices yet_")}</div>}
                </div>

                {/* Documents */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
                      textTransform: "uppercase", color: "var(--text-3)" }}>
                      {ct("documentsCount", { n: c.documents?.length || 0 })}</div>
                    <label style={{ ...btn(), display: "inline-block" }}>
                      {ct("Upload signed doc")}
                      <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(c, f); e.target.value = "" }} />
                    </label>
                  </div>
                  {(c.documents || []).map((doc: any) => (
                    <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10,
                      padding: "7px 10px", background: "#fff", border: "1px solid var(--border,#E2E8F0)",
                      borderRadius: 7, marginBottom: 6, fontSize: 12 }}>
                      <span>📎</span>
                      <a href={`/api/admin/contracts/${c.id}/documents/${doc.id}`}
                        style={{ color: "var(--steel,#1B6CA8)", fontWeight: 600, textDecoration: "none" }}>
                        {doc.title}
                      </a>
                      <span style={{ color: "var(--text-3)" }}>
                        {ct("docMeta", { kb: (doc.sizeBytes / 1024).toFixed(0), date: fmtD(doc.createdAt) })}
                      </span>
                    </div>
                  ))}
                  {!c.documents?.length && <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                    {ct("noDocuments")}</div>}
                </div>
              </div>
            )}
          </div>
        )
      })}
      {contracts && !contracts.length && (
        <div style={{ padding: 30, textAlign: "center", color: "var(--text-3)", fontSize: 13,
          border: "1px dashed var(--border,#E2E8F0)", borderRadius: 10 }}>
          {ct("emptyState")}
        </div>
      )}

      {/* ── Create / edit modal ── */}
      {editing !== null && (
        <div onClick={() => { if (!saving) { setEditing(null); onModalClose?.() } }}
          style={{ position: "fixed", inset: 0, background: "rgba(13,27,42,.45)", zIndex: 60,
            display: "grid", placeItems: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, width: "min(760px, 100%)",
              maxHeight: "90vh", overflowY: "auto", padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>
              {editing === "new" ? ct("New customer contract") : ct("Edit contract")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>{ct("Customer workspace *")}</label>
                <select style={{ ...inp, cursor: "pointer" }} value={form.workspaceId}
                  disabled={editing !== "new"}
                  onChange={e => setForm((f: any) => ({ ...f, workspaceId: e.target.value }))}>
                  <option value="">{ct("Select…")}</option>
                  {workspaces.map(w => (
                    <option key={w.id} value={w.id}>{w.name}{w.plan ? ` (${w.plan})` : ""}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>{ct("Contract name *")}</label>
                <input style={inp} value={form.name} placeholder={ct("contractNamePlaceholder")}
                  onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
              </div>
              <div><label style={lbl}>{ct("Status")}</label>
                <select style={{ ...inp, cursor: "pointer" }} value={form.status}
                  onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                  {Object.keys(S).map(v => <option key={v} value={v}>{ct(("st_" + v) as any)}</option>)}
                </select></div>
              <div><label style={lbl}>{ct("Alert window (days before end/renewal)")}</label>
                <input style={inp} type="number" value={form.alertDays}
                  onChange={e => setForm((f: any) => ({ ...f, alertDays: e.target.value }))} /></div>
              <div><label style={lbl}>{ct("Start *")}</label>
                <input style={inp} type="date" value={form.startDate}
                  onChange={e => setForm((f: any) => ({ ...f, startDate: e.target.value }))} /></div>
              <div><label style={lbl}>{ct("End *")}</label>
                <input style={inp} type="date" value={form.endDate}
                  onChange={e => setForm((f: any) => ({ ...f, endDate: e.target.value }))} /></div>
              <div><label style={lbl}>{ct("Renewal decision date")}</label>
                <input style={inp} type="date" value={form.renewalDate}
                  onChange={e => setForm((f: any) => ({ ...f, renewalDate: e.target.value }))} /></div>
              <div style={{ display: "flex", alignItems: "end", paddingBottom: 8 }}>
                <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.autoRenew}
                    onChange={e => setForm((f: any) => ({ ...f, autoRenew: e.target.checked }))} />
                  {ct("Auto-renews")}
                </label>
              </div>

              <div style={{ gridColumn: "1 / -1", fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
                textTransform: "uppercase", color: "var(--text-3)", marginTop: 4 }}>{ct("Bundle package")}</div>
              <div><label style={lbl}>{ct("Paid seats")}</label>
                <input style={inp} type="number" value={form.paidSeats}
                  onChange={e => setForm((f: any) => ({ ...f, paidSeats: e.target.value }))} /></div>
              <div><label style={lbl}>{ct("seatPriceLbl")}</label>
                <input style={inp} type="number" min="0" step="0.01" value={form.seatUnitPrice}
                  placeholder="39"
                  onChange={e => setForm((f: any) => ({ ...f, seatUnitPrice: e.target.value }))} /></div>
              <div><label style={lbl}>{ct("Contributor bundles (×10)")}</label>
                <input style={inp} type="number" value={form.contributorBundles}
                  onChange={e => setForm((f: any) => ({ ...f, contributorBundles: e.target.value }))} /></div>
              <div><label style={lbl}>{ct("bundlePriceUnitLbl")}</label>
                <input style={inp} type="number" min="0" step="0.01" value={form.contributorBundlePrice}
                  placeholder="20"
                  onChange={e => setForm((f: any) => ({ ...f, contributorBundlePrice: e.target.value }))} /></div>
              <div><label style={lbl}>{ct("subDiscLbl")}</label>
                <input style={inp} type="number" min="0" max="100" step="1" value={form.subscriptionDiscountPct}
                  placeholder="0"
                  onChange={e => setForm((f: any) => ({ ...f, subscriptionDiscountPct: e.target.value }))} /></div>
              <div><label style={lbl}>{ct("OCR page cap /mo (Enterprise custom)")}</label>
                <input style={inp} type="number" value={form.ocrPageCap} placeholder={ct("default")}
                  onChange={e => setForm((f: any) => ({ ...f, ocrPageCap: e.target.value }))} /></div>
              <div><label style={lbl}>{ct("ocrPackPriceLbl")}</label>
                <input style={inp} type="number" min="0" step="0.01" value={form.ocrPackPrice}
                  placeholder="10"
                  onChange={e => setForm((f: any) => ({ ...f, ocrPackPrice: e.target.value }))} /></div>
              <div><label style={lbl}>{ct("Billing")}</label>
                <select style={{ ...inp, cursor: "pointer" }} value={form.billingCycle}
                  onChange={e => setForm((f: any) => ({ ...f, billingCycle: e.target.value }))}>
                  <option value="ANNUAL">{enumLabel("ANNUAL", locale)}</option>
                  <option value="MONTHLY">{enumLabel("MONTHLY", locale)}</option>
                </select></div>
              <div><label style={lbl}>{ct("Amount")}</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input style={{ ...inp, flex: 1 }} type="number" value={form.amount}
                    onChange={e => setForm((f: any) => ({ ...f, amount: e.target.value }))} />
                  <button type="button" title={ct("calcTitle")}
                    onClick={() => setForm((f: any) => {
                      const m = contractMath(f)
                      return { ...f, amount: m.total ? String(m.total) : f.amount }
                    })}
                    style={{ padding: "0 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                      border: "1px solid var(--border)", borderRadius: 6, background: "#fff",
                      color: "var(--steel,#1B6CA8)", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    {ct("calcBtn")}
                  </button>
                </div>
                {(() => {
                  const m = contractMath(form)
                  if (m.total <= 0) return null
                  const fm = (x: number) => x.toLocaleString("en-US")
                  return (
                    <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 3, lineHeight: 1.7 }}>
                      {Number(form.paidSeats) > 0 &&
                        `${form.paidSeats} × $${fm(m.seatPrice)} = $${fm(m.perMoSeats)}/mo`}
                      {Number(form.contributorBundles) > 0 &&
                        ` · ${form.contributorBundles} × $${fm(m.bundlePrice)} = $${fm(m.perMoBund)}/mo`}
                      {m.subDisc > 0 && ` (−${m.subDisc}%)`}
                      {m.ocrPacks > 0 &&
                        ` · OCR +${m.ocrPacks} × $${fm(m.ocrPrice)} = $${fm(m.perMoOcr)}/mo`}
                      {m.retainer > 0 &&
                        ` · ${ct("retainerLine", { n: m.retainer, h: m.pkgHours,
                            price: fm(m.pkgPrice) })}`}
                      {m.firstFree > 0 && ` · ${ct("firstPkgFree", { d: fm(m.firstFree) })}`}
                      {m.onboarding > 0 && ` · ${ct("calcOnboarding", { fee: fm(m.onboarding) })}`}
                      {m.onbDisc > 0 && m.onboarding > 0 && ` (−${m.onbDisc}%)`}
                      {` · ${ct("calcTotal", { total: fm(m.total) })}`}
                    </div>
                  )
                })()}</div>
              <div><label style={lbl}>{ct("Currency")}</label>
                <input style={inp} value={form.currency}
                  onChange={e => setForm((f: any) => ({ ...f, currency: e.target.value }))} /></div>

              <div style={{ gridColumn: "1 / -1", fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
                textTransform: "uppercase", color: "var(--text-3)", marginTop: 4 }}>{ct("Service level agreement")}</div>
              <div><label style={lbl}>{ct("Support tier")}</label>
                <input style={inp} value={form.supportTier} placeholder={ct("supportTierPlaceholder")}
                  onChange={e => setForm((f: any) => ({ ...f, supportTier: e.target.value }))} /></div>
              <div><label style={lbl}>{ct("First response (hours)")}</label>
                <input style={inp} type="number" value={form.responseHours}
                  onChange={e => setForm((f: any) => ({ ...f, responseHours: e.target.value }))} /></div>
              <div><label style={lbl}>{ct("Uptime commitment (%)")}</label>
                <input style={inp} type="number" step="0.01" value={form.uptimePct} placeholder="99.9"
                  onChange={e => setForm((f: any) => ({ ...f, uptimePct: e.target.value }))} /></div>
              <div><label style={lbl}>{ct("Service hourly rate")}</label>
                <input style={inp} type="number" min="0" step="0.01" value={form.serviceHourlyRate}
                  onChange={e => setForm({ ...form, serviceHourlyRate: e.target.value })} /></div>
              <div><label style={lbl}>{ct("svcDiscLbl")}</label>
                <input style={inp} type="number" min="0" max="100" step="1" value={form.serviceDiscountPct}
                  placeholder="0"
                  onChange={e => setForm({ ...form, serviceDiscountPct: e.target.value })} /></div>
              <div><label style={lbl}>{ct("Onboarding fee (fixed)")}</label>
                <input style={inp} type="number" min="0" step="0.01" value={form.onboardingFee}
                  onChange={e => setForm({ ...form, onboardingFee: e.target.value })} /></div>
              <div><label style={lbl}>{ct("onbDiscLbl")}</label>
                <input style={inp} type="number" min="0" max="100" step="1" value={form.onboardingDiscountPct}
                  placeholder="0"
                  onChange={e => setForm({ ...form, onboardingDiscountPct: e.target.value })} /></div>
              <div><label style={lbl}>{ct("bundleHoursLbl")}</label>
                <input style={inp} type="number" min="1" step="1" value={form.serviceBundleHours}
                  placeholder="10"
                  onChange={e => setForm({ ...form, serviceBundleHours: e.target.value })} /></div>
              <div><label style={lbl}>{ct("bundlePriceLbl")}</label>
                <input style={inp} type="number" min="0" step="0.01" value={form.serviceBundlePrice}
                  placeholder="125"
                  onChange={e => setForm({ ...form, serviceBundlePrice: e.target.value })} /></div>
              <div><label style={lbl}>{ct("retainerLbl")}</label>
                <input style={inp} type="number" min="0" step="1" value={form.serviceRetainerPackages}
                  placeholder="0"
                  onChange={e => setForm({ ...form, serviceRetainerPackages: e.target.value })} /></div>
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 6 }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12,
                  color: "var(--text-2)", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!form.bundleInOnboarding}
                    onChange={e => setForm({ ...form, bundleInOnboarding: e.target.checked })} />
                  {ct("bundleInOnbLbl")}
                </label>
              </div>
              <div><label style={lbl}>{ct("SLA notes")}</label>
                <input style={inp} value={form.slaNotes}
                  onChange={e => setForm((f: any) => ({ ...f, slaNotes: e.target.value }))} /></div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>{ct("Notes")}</label>
                <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={form.notes}
                  onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button style={btn()} disabled={saving} onClick={() => { setEditing(null); onModalClose?.() }}>{ct("Cancel")}</button>
              {editing === "new" && (
                <button style={btn()} disabled={saving} onClick={() => save(true)}
                  title={ct("createWithInvoiceTitle")}>
                  {ct("createWithInvoice")}
                </button>
              )}
              <button style={btn(true)} disabled={saving} onClick={() => save()}>
                {saving ? ct("Saving…") : editing === "new" ? ct("Create contract") : ct("Save changes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
