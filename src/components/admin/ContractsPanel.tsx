"use client"
// src/components/admin/ContractsPanel.tsx
// Enterprise Contracts / CLM — first-class tab in Platform Admin.
// Self-fetching (GET /api/admin/contracts) so AdminView's server props stay
// untouched. Covers: contract terms + expiration alerting, bundle package,
// SLA commitments, invoice records, attached signed documents.

import { useEffect, useState } from "react"
import { dateLocale } from "@/lib/date-locale"

const S: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:      { label: "Draft",      color: "#64748B", bg: "#F8FAFC" },
  ACTIVE:     { label: "Active",     color: "#059669", bg: "#ECFDF5" },
  EXPIRED:    { label: "Expired",    color: "#DC2626", bg: "#FEF2F2" },
  TERMINATED: { label: "Terminated", color: "#7C3AED", bg: "#F5F3FF" },
  RENEWED:    { label: "Renewed",    color: "#1B6CA8", bg: "#EFF6FF" },
}
const INV: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:   { label: "Draft",   color: "#64748B", bg: "#F8FAFC" },
  SENT:    { label: "Sent",    color: "#1B6CA8", bg: "#EFF6FF" },
  PAID:    { label: "Paid",    color: "#059669", bg: "#ECFDF5" },
  OVERDUE: { label: "Overdue", color: "#DC2626", bg: "#FEF2F2" },
  VOID:    { label: "Void",    color: "#94A3B8", bg: "#F8FAFC" },
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
const chip = (c: { label: string; color: string; bg: string }) => (
  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
    color: c.color, background: c.bg, border: `1px solid ${c.color}30` }}>{c.label}</span>
)
const money = (n?: number | null, cur = "USD") =>
  n == null ? "—" : `$${Number(n).toLocaleString()} ${cur !== "USD" ? cur : ""}`.trim()
const fmtD = (d?: string | null) => d ? new Date(d).toLocaleDateString(dateLocale(),
  { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—"

const EMPTY_FORM = {
  workspaceId: "", name: "", status: "DRAFT", startDate: "", endDate: "", renewalDate: "",
  autoRenew: false, alertDays: 60, paidSeats: 0, contributorBundles: 0, ocrPageCap: "",
  billingCycle: "ANNUAL", amount: "", currency: "USD",
  supportTier: "", responseHours: "", uptimePct: "", slaNotes: "", notes: "",
}

export function ContractsPanel({ workspaces }: {
  workspaces: { id: string; name: string; plan?: string }[]
}) {
  const [contracts, setContracts] = useState<any[] | null>(null)
  const [error, setError] = useState("")
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<any | null>(null) // null | "new" | contract
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  async function load() {
    setError("")
    const res = await fetch("/api/admin/contracts").catch(() => null)
    if (!res || !res.ok) { setError("Failed to load contracts"); setContracts([]); return }
    const d = await res.json().catch(() => ({}))
    setContracts(d.data || [])
  }
  useEffect(() => { load() }, [])

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
    })
    setEditing(c)
  }

  async function save() {
    if (!form.workspaceId || !form.name.trim() || !form.startDate || !form.endDate) {
      setError("Customer, name, start and end dates are required"); return
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
    }
    const isNew = editing === "new"
    const res = await fetch(isNew ? "/api/admin/contracts" : `/api/admin/contracts/${editing.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? payload : (({ workspaceId, ...rest }) => rest)(payload)),
    }).catch(() => null)
    setSaving(false)
    if (!res || !res.ok) {
      const d = await res?.json().catch(() => ({}))
      setError(d?.error || "Save failed"); return
    }
    setEditing(null); load()
  }

  async function removeContract(c: any) {
    if (!window.confirm(`Delete contract "${c.name}" and all its invoices/documents?`)) return
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
    if (!res?.ok) { const d = await res?.json().catch(() => ({})); setError(d?.error || "Upload failed") }
    load()
  }

  const daysLeft = (c: any) => {
    const anchor = Math.min(new Date(c.endDate).getTime(),
      c.renewalDate ? new Date(c.renewalDate).getTime() : Infinity)
    return Math.ceil((anchor - Date.now()) / 864e5)
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text-3)" }}>
          {contracts ? `${contracts.length} contract${contracts.length === 1 ? "" : "s"}` : "Loading…"}
          {" · "}expiry alerts email platform admins at each contract's T-window
        </div>
        <button style={btn(true)} onClick={startNew}>+ New contract</button>
      </div>

      {error && <div style={{ marginBottom: 12, padding: "8px 12px", background: "#FEF2F2",
        border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#B91C1C" }}>{error}</div>}

      {contracts?.map(c => {
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
              {chip(S[c.status] || S.DRAFT)}
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                {c.paidSeats} seats · {c.contributorBundles}×10 contrib
                {c.ocrPageCap ? ` · OCR ${c.ocrPageCap}p/mo` : ""}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700 }}>{money(c.amount, c.currency)}
                <span style={{ color: "var(--text-3)", fontWeight: 500 }}> /{c.billingCycle === "MONTHLY" ? "mo" : "yr"}</span>
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: dlColor }}>
                {fmtD(c.endDate)} · {dl < 0 ? `${-dl}d overdue` : `${dl}d left`}
              </div>
              <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                <button style={btn()} onClick={() => startEdit(c)}>Edit</button>
                <button style={{ ...btn(), color: "#DC2626" }} onClick={() => removeContract(c)}>Delete</button>
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: "1px solid var(--border,#E2E8F0)", padding: "14px 16px",
                background: "var(--bg-2,#F8FAFC)", display: "grid", gap: 16 }}>
                {/* SLA */}
                <div style={{ fontSize: 12, color: "var(--text-2,#334155)" }}>
                  <b>SLA:</b> {c.supportTier || "—"} tier
                  {c.responseHours != null ? ` · first response ≤ ${c.responseHours}h` : ""}
                  {c.uptimePct != null ? ` · ${c.uptimePct}% uptime` : ""}
                  {c.slaNotes ? ` · ${c.slaNotes}` : ""}
                  {c.autoRenew ? " · auto-renews" : ""}
                  {c.renewalDate ? ` · renewal decision ${fmtD(c.renewalDate)}` : ""}
                </div>

                {/* Invoices */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
                      textTransform: "uppercase", color: "var(--text-3)" }}>Invoices ({c.invoices?.length || 0})</div>
                    <button style={btn()} onClick={() => setInvFor(invFor?.id === c.id ? null : c)}>
                      {invFor?.id === c.id ? "Cancel" : "+ Invoice"}
                    </button>
                  </div>
                  {invFor?.id === c.id && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8,
                      marginBottom: 10, alignItems: "end" }}>
                      <div><label style={lbl}>Number</label>
                        <input style={inp} value={invForm.number} placeholder="INV-2026-001"
                          onChange={e => setInvForm(f => ({ ...f, number: e.target.value }))} /></div>
                      <div><label style={lbl}>Amount</label>
                        <input style={inp} type="number" value={invForm.amount}
                          onChange={e => setInvForm(f => ({ ...f, amount: e.target.value }))} /></div>
                      <div><label style={lbl}>Issued</label>
                        <input style={inp} type="date" value={invForm.issueDate}
                          onChange={e => setInvForm(f => ({ ...f, issueDate: e.target.value }))} /></div>
                      <div><label style={lbl}>Due</label>
                        <input style={inp} type="date" value={invForm.dueDate}
                          onChange={e => setInvForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
                      <button style={btn(true)} onClick={saveInvoice}>Add</button>
                    </div>
                  )}
                  {(c.invoices || []).map((inv: any) => (
                    <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10,
                      padding: "7px 10px", background: "#fff", border: "1px solid var(--border,#E2E8F0)",
                      borderRadius: 7, marginBottom: 6, fontSize: 12, flexWrap: "wrap" }}>
                      <b>{inv.number}</b>
                      <span>{money(inv.amount, inv.currency)}</span>
                      <span style={{ color: "var(--text-3)" }}>issued {fmtD(inv.issueDate)} · due {fmtD(inv.dueDate)}</span>
                      {inv.paidDate && <span style={{ color: "#059669" }}>paid {fmtD(inv.paidDate)}</span>}
                      {chip(INV[inv.status] || INV.DRAFT)}
                      <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                        {inv.status !== "PAID" && (
                          <button style={btn()} onClick={() => setInvoiceStatus(c, inv, "PAID")}>Mark paid</button>
                        )}
                        {inv.status === "DRAFT" && (
                          <button style={btn()} onClick={() => setInvoiceStatus(c, inv, "SENT")}>Mark sent</button>
                        )}
                      </span>
                    </div>
                  ))}
                  {!c.invoices?.length && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No invoices yet.</div>}
                </div>

                {/* Documents */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
                      textTransform: "uppercase", color: "var(--text-3)" }}>
                      Documents ({c.documents?.length || 0})</div>
                    <label style={{ ...btn(), display: "inline-block" }}>
                      Upload signed doc
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
                        {(doc.sizeBytes / 1024).toFixed(0)} KB · {fmtD(doc.createdAt)}
                      </span>
                    </div>
                  ))}
                  {!c.documents?.length && <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                    No documents attached — upload the signed MSA and invoices here.</div>}
                </div>
              </div>
            )}
          </div>
        )
      })}
      {contracts && !contracts.length && (
        <div style={{ padding: 30, textAlign: "center", color: "var(--text-3)", fontSize: 13,
          border: "1px dashed var(--border,#E2E8F0)", borderRadius: 10 }}>
          No customer contracts yet. Create the first one when an Enterprise deal signs.
        </div>
      )}

      {/* ── Create / edit modal ── */}
      {editing !== null && (
        <div onClick={() => !saving && setEditing(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(13,27,42,.45)", zIndex: 60,
            display: "grid", placeItems: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, width: "min(760px, 100%)",
              maxHeight: "90vh", overflowY: "auto", padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>
              {editing === "new" ? "New customer contract" : "Edit contract"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Customer workspace *</label>
                <select style={{ ...inp, cursor: "pointer" }} value={form.workspaceId}
                  disabled={editing !== "new"}
                  onChange={e => setForm((f: any) => ({ ...f, workspaceId: e.target.value }))}>
                  <option value="">Select…</option>
                  {workspaces.map(w => (
                    <option key={w.id} value={w.id}>{w.name}{w.plan ? ` (${w.plan})` : ""}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Contract name *</label>
                <input style={inp} value={form.name} placeholder="Enterprise Agreement 2026–2027"
                  onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
              </div>
              <div><label style={lbl}>Status</label>
                <select style={{ ...inp, cursor: "pointer" }} value={form.status}
                  onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                  {Object.entries(S).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                </select></div>
              <div><label style={lbl}>Alert window (days before end/renewal)</label>
                <input style={inp} type="number" value={form.alertDays}
                  onChange={e => setForm((f: any) => ({ ...f, alertDays: e.target.value }))} /></div>
              <div><label style={lbl}>Start *</label>
                <input style={inp} type="date" value={form.startDate}
                  onChange={e => setForm((f: any) => ({ ...f, startDate: e.target.value }))} /></div>
              <div><label style={lbl}>End *</label>
                <input style={inp} type="date" value={form.endDate}
                  onChange={e => setForm((f: any) => ({ ...f, endDate: e.target.value }))} /></div>
              <div><label style={lbl}>Renewal decision date</label>
                <input style={inp} type="date" value={form.renewalDate}
                  onChange={e => setForm((f: any) => ({ ...f, renewalDate: e.target.value }))} /></div>
              <div style={{ display: "flex", alignItems: "end", paddingBottom: 8 }}>
                <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.autoRenew}
                    onChange={e => setForm((f: any) => ({ ...f, autoRenew: e.target.checked }))} />
                  Auto-renews
                </label>
              </div>

              <div style={{ gridColumn: "1 / -1", fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
                textTransform: "uppercase", color: "var(--text-3)", marginTop: 4 }}>Bundle package</div>
              <div><label style={lbl}>Paid seats</label>
                <input style={inp} type="number" value={form.paidSeats}
                  onChange={e => setForm((f: any) => ({ ...f, paidSeats: e.target.value }))} /></div>
              <div><label style={lbl}>Contributor bundles (×10)</label>
                <input style={inp} type="number" value={form.contributorBundles}
                  onChange={e => setForm((f: any) => ({ ...f, contributorBundles: e.target.value }))} /></div>
              <div><label style={lbl}>OCR page cap /mo (Enterprise custom)</label>
                <input style={inp} type="number" value={form.ocrPageCap} placeholder="default"
                  onChange={e => setForm((f: any) => ({ ...f, ocrPageCap: e.target.value }))} /></div>
              <div><label style={lbl}>Billing</label>
                <select style={{ ...inp, cursor: "pointer" }} value={form.billingCycle}
                  onChange={e => setForm((f: any) => ({ ...f, billingCycle: e.target.value }))}>
                  <option value="ANNUAL">Annual</option>
                  <option value="MONTHLY">Monthly</option>
                </select></div>
              <div><label style={lbl}>Amount</label>
                <input style={inp} type="number" value={form.amount}
                  onChange={e => setForm((f: any) => ({ ...f, amount: e.target.value }))} /></div>
              <div><label style={lbl}>Currency</label>
                <input style={inp} value={form.currency}
                  onChange={e => setForm((f: any) => ({ ...f, currency: e.target.value }))} /></div>

              <div style={{ gridColumn: "1 / -1", fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
                textTransform: "uppercase", color: "var(--text-3)", marginTop: 4 }}>Service level agreement</div>
              <div><label style={lbl}>Support tier</label>
                <input style={inp} value={form.supportTier} placeholder="Priority"
                  onChange={e => setForm((f: any) => ({ ...f, supportTier: e.target.value }))} /></div>
              <div><label style={lbl}>First response (hours)</label>
                <input style={inp} type="number" value={form.responseHours}
                  onChange={e => setForm((f: any) => ({ ...f, responseHours: e.target.value }))} /></div>
              <div><label style={lbl}>Uptime commitment (%)</label>
                <input style={inp} type="number" step="0.01" value={form.uptimePct} placeholder="99.9"
                  onChange={e => setForm((f: any) => ({ ...f, uptimePct: e.target.value }))} /></div>
              <div><label style={lbl}>SLA notes</label>
                <input style={inp} value={form.slaNotes}
                  onChange={e => setForm((f: any) => ({ ...f, slaNotes: e.target.value }))} /></div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Notes</label>
                <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={form.notes}
                  onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button style={btn()} disabled={saving} onClick={() => setEditing(null)}>Cancel</button>
              <button style={btn(true)} disabled={saving} onClick={save}>
                {saving ? "Saving…" : editing === "new" ? "Create contract" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
