"use client"
// src/components/admin/EntitlementRequestsPanel.tsx
// Platform-admin queue for customer requests to grow seats / bundles / OCR.
// Approve applies the change (contract or workspace) and emails the requester;
// for Enterprise, bill it from the contract's Increment composer afterwards.

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

const NAVY = "#0F2942", GREEN = "#059669", RED = "#DC2626", AMBER = "#B45309"

export function EntitlementRequestsPanel() {
  const ad = useTranslations("admin")
  const [rows, setRows] = useState<any[] | null>(null)
  const [busy, setBusy] = useState<string>("")
  const [note, setNote] = useState<Record<string, string>>({})
  const load = () => fetch("/api/admin/entitlement-requests").then(r => r.json())
    .then(d => setRows(d?.data || [])).catch(() => setRows([]))
  useEffect(() => { load() }, [])

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(id)
    try {
      await fetch(`/api/admin/entitlement-requests/${id}`, { method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note[id] || null }) })
      await load()
    } finally { setBusy("") }
  }

  if (rows === null) return <div style={{ padding: 20, color: "#64748B", fontSize: 13 }}>…</div>
  const pending = rows.filter(r => r.status === "PENDING")
  const decided = rows.filter(r => r.status !== "PENDING").slice(0, 20)
  const kindLabel = (k: string) => ({ SEATS: ad("er_seats"), BUNDLES: ad("er_bundles"), OCR_BLOCKS: ad("er_ocr") } as any)[k] || k
  const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" })

  const row = (r: any, actionable: boolean) => {
    const monthly = (r.unitPrice || 0) * r.quantity
    return (
      <div key={r.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 14px",
        borderBottom: "1px solid #E2E8F0", background: actionable ? "#fff" : "#F8FAFC" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>
            +{r.quantity} {kindLabel(r.kind)}
            <span style={{ fontWeight: 500, color: "#64748B" }}> · {r.workspace?.name} · {r.workspace?.plan}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>
            {r.requestedBy?.name || r.requestedBy?.email} · {new Date(r.createdAt).toLocaleString()}
            {r.contractId ? ` · ${ad("er_viaContract")}` : ` · ${ad("er_viaPlan")}`}
          </div>
          {r.note && <div style={{ fontSize: 12, color: "#475569", marginTop: 4, fontStyle: "italic" }}>"{r.note}"</div>}
          {!actionable && r.decisionNote && <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>→ {r.decisionNote}</div>}
        </div>
        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, fontVariantNumeric: "tabular-nums" }}>{money(monthly)}/mo</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>{money(monthly * 12)}/yr · {r.quantity} × {money(r.unitPrice || 0)}</div>
          {actionable ? (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
              <input value={note[r.id] || ""} onChange={e => setNote({ ...note, [r.id]: e.target.value })}
                placeholder={ad("er_notePh")}
                style={{ width: 220, padding: "5px 8px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 11.5, fontFamily: "inherit" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button disabled={busy === r.id} onClick={() => decide(r.id, "reject")}
                  style={{ padding: "5px 10px", fontSize: 11.5, fontWeight: 600, border: `1px solid ${RED}`, color: RED,
                    background: "#fff", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>{ad("er_reject")}</button>
                <button disabled={busy === r.id} onClick={() => decide(r.id, "approve")}
                  style={{ padding: "5px 12px", fontSize: 11.5, fontWeight: 700, border: "none", color: "#fff",
                    background: GREEN, borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
                  {busy === r.id ? "…" : ad("er_approve")}</button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700,
              color: r.status === "APPROVED" ? GREEN : RED }}>{r.status}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "11px 14px", fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase",
        color: pending.length ? AMBER : "#64748B", borderBottom: "1px solid #E2E8F0" }}>
        {ad("er_pending", { n: pending.length })}
      </div>
      {pending.length ? pending.map(r => row(r, true))
        : <div style={{ padding: 20, fontSize: 12.5, color: "#64748B" }}>{ad("er_none")}</div>}
      {decided.length > 0 && (<>
        <div style={{ padding: "11px 14px", fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase",
          color: "#64748B", borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0" }}>{ad("er_recent")}</div>
        {decided.map(r => row(r, false))}
      </>)}
      <div style={{ padding: "10px 14px", fontSize: 11, color: "#64748B", borderTop: "1px solid #E2E8F0" }}>{ad("er_hint")}</div>
    </div>
  )
}
