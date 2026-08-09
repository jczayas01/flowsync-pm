"use client"
// src/components/settings/OcrPacksCard.tsx
// Billing card for OCR add-on packs (+200 AI-read pages/mo, $10/mo, stackable).
// Self-fetching from /api/stripe/ocr-packs. Renders for every plan:
//  - shows this month's usage bar for everyone
//  - Business with active subscription: pack stepper + Apply (prorated)
//  - Enterprise: cap comes from the contract; no self-serve packs
//  - No subscription yet (trial): explains packs unlock after upgrade

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

const NAVY = "#0D1B2A", STEEL = "#1B6CA8", AMBER = "#F59E0B", SLATE = "#64748B"

export function OcrPacksCard() {
  const oc = useTranslations("ocrPacks")
  const [data, setData] = useState<any | null>(null)
  const [packs, setPacks] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")

  async function load() {
    const res = await fetch("/api/stripe/ocr-packs").catch(() => null)
    if (!res?.ok) return
    const d = (await res.json().catch(() => ({})))?.data
    if (d) { setData(d); setPacks(d.packs) }
  }
  useEffect(() => { load() }, [])

  if (!data) return null
  const pct = Math.min(100, Math.round((data.used / Math.max(data.cap, 1)) * 100))
  const barColor = pct >= 100 ? "#DC2626" : pct >= 80 ? AMBER : STEEL
  const dirty = packs !== data.packs

  async function apply() {
    setBusy(true); setMsg("")
    const res = await fetch("/api/stripe/ocr-packs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packs }),
    }).catch(() => null)
    setBusy(false)
    if (!res || !res.ok) {
      const d = await res?.json().catch(() => ({}))
      setMsg(d?.error || "Could not update packs"); return
    }
    setMsg("Updated — prorated on your next invoice.")
    load()
  }

  return (
    <div style={{ background: "#fff", border: "1px solid var(--border,#E2E8F0)", borderRadius: 12,
      padding: "18px 20px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: SLATE, textTransform: "uppercase",
            letterSpacing: ".06em", marginBottom: 4 }}>{oc("AI document reading (OCR)")}</div>
          <div style={{ fontSize: 13.5, color: NAVY }}>
            <b>{data.used}</b> {oc("of")} <b>{data.cap}</b> {oc("pagesUsedThisMonth")}
          </div>
        </div>
        {data.purchasable && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button disabled={busy || packs <= 0} onClick={() => setPacks(p => Math.max(0, p - 1))}
              style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border,#E2E8F0)",
                background: "#fff", cursor: "pointer", fontSize: 15 }}>−</button>
            <div style={{ minWidth: 120, textAlign: "center", fontSize: 12.5 }}>
              {oc("packsSummary",{n:packs, p:packs * data.packPages})}
            </div>
            <button disabled={busy || packs >= 20} onClick={() => setPacks(p => Math.min(20, p + 1))}
              style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border,#E2E8F0)",
                background: "#fff", cursor: "pointer", fontSize: 15 }}>+</button>
            <button disabled={busy || !dirty} onClick={apply}
              style={{ padding: "7px 14px", borderRadius: 7, border: "none",
                background: dirty ? STEEL : "#CBD5E1", color: "#fff", fontSize: 12.5,
                fontWeight: 700, cursor: dirty ? "pointer" : "default" }}>
              {busy ? oc("Applying…") : oc("Apply")}
            </button>
          </div>
        )}
      </div>

      <div style={{ height: 8, background: "var(--bg-2,#F1F5F9)", borderRadius: 5, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: barColor, transition: "width .3s ease" }} />
      </div>

      <div style={{ fontSize: 11.5, color: SLATE, marginTop: 8 }}>
        {data.enterprise
          ? oc("enterpriseCapHint")
          : data.purchasable
            ? oc("packPricingHint",{p:data.packPages, c:(data.packPriceMonthly/100).toFixed(0)})
            : oc("includedHint",{c:data.cap, p:data.packPages, pr:(data.packPriceMonthly/100).toFixed(0)})}
      </div>
      {msg && <div style={{ fontSize: 11.5, marginTop: 6,
        color: msg.startsWith("Updated") ? "#059669" : "#B91C1C" }}>{msg}</div>}
    </div>
  )
}
