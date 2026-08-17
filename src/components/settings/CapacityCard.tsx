"use client"
// src/components/settings/CapacityCard.tsx
// Shows what the workspace is entitled to vs. what it uses, and lets an admin
// request more. The dialog quotes the exact cost (contract price if
// Enterprise, list price otherwise) before "Accept & send request", which
// records the request and emails FlowSync. Nothing changes until approved.

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

type Ent = {
  source: "contract" | "plan"; plan: string
  seats: number; bundles: number; contributorsCap: number; ocrPages: number
  prices: { seat: number; bundle: number; ocrPack: number }
  contractName?: string; contractEnd?: string | null
  seatsUsed: number; contributorsUsed: number
  pending: { id: string; kind: string; quantity: number; createdAt: string }[]
  canRequest: boolean
}
type Kind = "SEATS" | "BUNDLES" | "OCR_BLOCKS"

export function CapacityCard() {
  const t = useTranslations("capacity")
  const [ent, setEnt] = useState<Ent | null>(null)
  const [dlg, setDlg] = useState<Kind | null>(null)
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string>("")
  const [err, setErr] = useState("")

  const load = () => fetch("/api/workspace/entitlements").then(r => r.json())
    .then(d => setEnt(d?.data || null)).catch(() => {})
  useEffect(() => { load() }, [])
  if (!ent) return null

  const unit = dlg === "SEATS" ? ent.prices.seat : dlg === "BUNDLES" ? ent.prices.bundle : ent.prices.ocrPack
  const monthly = qty * unit
  const seatPct = ent.seats > 0 ? Math.min(100, (ent.seatsUsed / ent.seats) * 100) : 0
  const contribPct = ent.contributorsCap > 0 ? Math.min(100, (ent.contributorsUsed / ent.contributorsCap) * 100) : 0
  const bar = (pct: number, over: boolean) => (
    <div style={{ height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: over ? "#DC2626" : pct >= 85 ? "#F59E0B" : "#059669" }} />
    </div>
  )
  const pendingFor = (k: Kind) => ent.pending.filter(p => p.kind === k).reduce((s, p) => s + p.quantity, 0)

  async function submit() {
    if (!dlg || busy) return
    setBusy(true); setErr("")
    try {
      const r = await fetch("/api/workspace/entitlements/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: dlg, quantity: qty, note: note || null }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d?.error || t("reqFailed")); return }
      setDone(t("reqSent")); setDlg(null); setQty(1); setNote(""); load()
      setTimeout(() => setDone(""), 5000)
    } finally { setBusy(false) }
  }

  const tile = (k: Kind, title: string, used: number, cap: number, pct: number, sub: string) => {
    const over = used > cap
    const pend = pendingFor(k)
    return (
      <div style={{ flex: "1 1 200px", minWidth: 200, background: "#fff", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "12px 14px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase",
          letterSpacing: ".06em" }}>{title}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: over ? "#DC2626" : "var(--text)",
            fontVariantNumeric: "tabular-nums" }}>{used}</span>
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>/ {cap}</span>
          <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>{sub}</span>
        </div>
        {bar(pct, over)}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          {pend > 0 && <span style={{ fontSize: 10.5, color: "#B45309", background: "#FEF3C7",
            padding: "1px 7px", borderRadius: 10, fontWeight: 600 }}>{t("pendingChip", { n: pend })}</span>}
          {ent.canRequest && (
            <button onClick={() => { setDlg(k); setQty(1) }}
              style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, padding: "4px 10px",
                border: "1px solid var(--steel)", color: "var(--steel)", background: "#fff",
                borderRadius: 6, cursor: "pointer", fontFamily: "var(--font)" }}>
              {t(k === "SEATS" ? "addSeat" : k === "BUNDLES" ? "addBundle" : "addOcr")}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t("title")}</div>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
          {ent.source === "contract" ? t("sourceContract", { name: ent.contractName || "" }) : t("sourcePlan", { plan: ent.plan })}
        </span>
        {done && <span style={{ marginLeft: "auto", fontSize: 12, color: "#059669", fontWeight: 600 }}>✓ {done}</span>}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {tile("SEATS", t("seats"), ent.seatsUsed, ent.seats, seatPct, t("seatsSub"))}
        {tile("BUNDLES", t("contributors"), ent.contributorsUsed, ent.contributorsCap, contribPct,
          t("bundlesSub", { n: ent.bundles }))}
        <div style={{ flex: "1 1 200px", minWidth: 200, background: "#fff", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "12px 14px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>{t("ocr")}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{ent.ocrPages}</span>
            <span style={{ fontSize: 13, color: "var(--text-3)" }}>{t("pagesMo")}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>{t("ocrSub")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            {pendingFor("OCR_BLOCKS") > 0 && <span style={{ fontSize: 10.5, color: "#B45309", background: "#FEF3C7",
              padding: "1px 7px", borderRadius: 10, fontWeight: 600 }}>{t("pendingChip", { n: pendingFor("OCR_BLOCKS") })}</span>}
            {ent.canRequest && (
              <button onClick={() => { setDlg("OCR_BLOCKS"); setQty(1) }}
                style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, padding: "4px 10px",
                  border: "1px solid var(--steel)", color: "var(--steel)", background: "#fff",
                  borderRadius: 6, cursor: "pointer", fontFamily: "var(--font)" }}>{t("addOcr")}</button>
            )}
          </div>
        </div>
      </div>

      {/* Request dialog */}
      {dlg && (
        <div onClick={() => !busy && setDlg(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(13,27,42,.45)", zIndex: 1000,
            display: "grid", placeItems: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, width: "min(440px, 100%)", padding: 22,
              boxShadow: "0 20px 60px rgba(13,27,42,.25)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
              {t(dlg === "SEATS" ? "dlgSeats" : dlg === "BUNDLES" ? "dlgBundles" : "dlgOcr")}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 14, lineHeight: 1.6 }}>
              {t(dlg === "SEATS" ? "dlgSeatsHelp" : dlg === "BUNDLES" ? "dlgBundlesHelp" : "dlgOcrHelp")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>{t("qty")}</label>
              <input type="number" min={1} max={500} value={qty}
                onChange={e => setQty(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                style={{ width: 90, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6,
                  fontSize: 15, fontWeight: 700, textAlign: "center", fontFamily: "var(--font)" }} />
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>× ${unit}/{t("mo")}</span>
            </div>
            <div style={{ background: "#F8FAFC", border: "1px solid var(--border)", borderRadius: 8,
              padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-2)" }}>{t("addedMonthly")}</span>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>${monthly.toLocaleString("en-US")}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4 }}>
                <span style={{ color: "var(--text-2)" }}>{t("addedAnnual")}</span>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>${(monthly * 12).toLocaleString("en-US")}</b>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8, lineHeight: 1.5 }}>
                {ent.source === "contract" ? t("noteContract") : t("notePlan")}
              </div>
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={t("notePh")} rows={2}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6,
                fontSize: 12.5, fontFamily: "var(--font)", resize: "vertical", boxSizing: "border-box", marginBottom: 12 }} />
            {err && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 8 }}>{err}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDlg(null)} disabled={busy}
                style={{ padding: "8px 14px", background: "#fff", border: "1px solid var(--border)", borderRadius: 6,
                  fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font)", color: "var(--text-2)" }}>{t("cancel")}</button>
              <button onClick={submit} disabled={busy}
                style={{ padding: "8px 16px", background: "var(--steel)", color: "#fff", border: "none", borderRadius: 6,
                  fontSize: 12.5, fontWeight: 700, cursor: busy ? "wait" : "pointer", fontFamily: "var(--font)" }}>
                {busy ? "…" : t("accept")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
