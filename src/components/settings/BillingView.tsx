// src/components/settings/BillingView.tsx
"use client"
import { useState } from "react"
import { RequestDemoModal } from "@/components/marketing/RequestDemoModal"

const NAVY = "#0D1B2A", STEEL = "#1B6CA8", AMBER = "#F59E0B", GREEN = "#059669", SLATE = "#64748B"
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

// The four-tier model — the same story as the landing page, the pricing page and
// the GTM kit. This page previously sold a retired model ($12/$22/Consultant).
const TIERS = [
  { id:"TRIAL", name:"Trial", price:"$0", suffix:"2 months",
    line:"The whole product, free. Converts to Starter unless cancelled." },
  { id:"STARTER", name:"Starter", price:"$19", suffix:"/user/mo",
    line:"Flat per user. For small teams and independent PMs." },
  { id:"BUSINESS", name:"Business", price:"$39", suffix:"/user/mo",
    line:"Paid seats for the roles that drive the work. Everyone else: $20/mo per 10." },
  { id:"ENTERPRISE", name:"Enterprise", price:"Custom", suffix:"",
    line:"Directory sync, white-label, DPA, personal onboarding." },
]

// Workspace.plan values map onto the four public tiers for display.
const PLAN_LABEL: Record<string,string> = {
  FREE:"Trial", STARTER:"Starter", PRO:"Business", PROFESSIONAL:"Business",
  BUSINESS:"Business", CONSULTANT:"Starter", ENTERPRISE:"Enterprise",
}

export function BillingView({
  plan, seats, memberCount, trialEndsAt, planRenewsAt,
  hasStripeCustomer, stripeConfigured, canManage,
}: {
  plan:string; seats:number; memberCount:number
  trialEndsAt:string|null; planRenewsAt:string|null
  hasStripeCustomer:boolean; stripeConfigured:boolean; canManage:boolean
}) {
  const [demoOpen, setDemoOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const now = Date.now()
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null
  const onTrial = !!trialEnd && trialEnd.getTime() > now
  const daysLeft = onTrial ? Math.ceil((trialEnd!.getTime() - now) / 864e5) : 0
  const label = PLAN_LABEL[plan] || plan

  async function openPortal() {
    setBusy(true)
    try {
      const res = await fetch("/api/stripe/portal", { method:"POST" })
      const d = await res.json().catch(() => ({}))
      if (d?.url) window.location.href = d.url
      else alert(d?.error || "Billing portal isn't available yet.")
    } finally { setBusy(false) }
  }

  const fmt = (iso:string) =>
    new Date(iso).toLocaleDateString("en-US",{ month:"long", day:"numeric", year:"numeric" })

  return (
    <div style={{ padding:"20px 16px", maxWidth:840, margin:"0 auto", fontFamily:"var(--font)" }}>
      <h1 style={{ fontSize:19, fontWeight:700, color:NAVY, marginBottom:4 }}>Billing</h1>
      <p style={{ fontSize:12.5, color:SLATE, marginBottom:18 }}>
        Your plan, your seats, and what happens next.
      </p>

      {/* ── Current plan — the truth, from the database ── */}
      <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:12,
        padding:"18px 20px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <div style={{ flex:1, minWidth:220 }}>
            <div style={{ fontSize:11, fontWeight:700, color:SLATE, textTransform:"uppercase",
              letterSpacing:".06em", marginBottom:5 }}>Current plan</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:9 }}>
              <span style={{ fontSize:24, fontWeight:800, color:NAVY }}>{label}</span>
              {onTrial && (
                <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, padding:"3px 8px",
                  borderRadius:5, background: daysLeft <= 7 ? "#FEF2F2" : "#FFFBEB",
                  color: daysLeft <= 7 ? "#B91C1C" : "#B45309" }}>
                  TRIAL · {daysLeft}d left
                </span>
              )}
            </div>
            <div style={{ fontSize:12.5, color:SLATE, marginTop:6, lineHeight:1.6 }}>
              {memberCount} {memberCount === 1 ? "member" : "members"} · {seats} {seats === 1 ? "seat" : "seats"}
              {onTrial && <> · trial ends <strong style={{ color:NAVY }}>{fmt(trialEndsAt!)}</strong></>}
              {!onTrial && planRenewsAt && <> · renews {fmt(planRenewsAt)}</>}
            </div>
          </div>

          {canManage && stripeConfigured && hasStripeCustomer && (
            <button onClick={openPortal} disabled={busy}
              style={{ padding:"10px 18px", background:NAVY, color:"#fff", border:"none",
                borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              {busy ? "Opening…" : "Manage billing"}
            </button>
          )}
        </div>

        {onTrial && (
          <div style={{ marginTop:14, padding:"10px 13px", background:"#EFF6FF",
            borderLeft:`3px solid ${STEEL}`, borderRadius:"0 8px 8px 0",
            fontSize:12.5, color:"#1E40AF", lineHeight:1.6 }}>
            Your trial includes everything — no feature limits. When it ends it converts to
            Starter automatically so nothing stops mid-project.
          </div>
        )}
      </div>

      {/* ── Plans — the same four tiers as everywhere else ── */}
      <div style={{ fontSize:11, fontWeight:700, color:SLATE, textTransform:"uppercase",
        letterSpacing:".06em", marginBottom:8 }}>Plans</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",
        gap:10, marginBottom:14 }}>
        {TIERS.map(t => {
          const isCurrent = PLAN_LABEL[plan] === t.name || (t.id === "TRIAL" && onTrial)
          return (
            <div key={t.id} style={{ background:"#fff", borderRadius:10, padding:"14px 15px",
              border: isCurrent ? `2px solid ${STEEL}` : "1px solid var(--border)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
                <span style={{ fontFamily:MONO, fontSize:10.5, fontWeight:700, color:SLATE,
                  textTransform:"uppercase", letterSpacing:".06em" }}>{t.name}</span>
                {isCurrent && (
                  <span style={{ fontSize:9, fontWeight:800, padding:"2px 6px", borderRadius:4,
                    background:"#EFF6FF", color:STEEL }}>CURRENT</span>
                )}
              </div>
              <div style={{ display:"flex", alignItems:"baseline", gap:3, marginBottom:6 }}>
                <span style={{ fontSize:21, fontWeight:800, color:NAVY }}>{t.price}</span>
                {t.suffix && <span style={{ fontSize:11, color:SLATE }}>{t.suffix}</span>}
              </div>
              <div style={{ fontSize:11.5, color:SLATE, lineHeight:1.55 }}>{t.line}</div>
            </div>
          )
        })}
      </div>

      {/* ── Changing plans — honest about the current state ── */}
      <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:12,
        padding:"16px 18px" }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:NAVY, marginBottom:6 }}>
          Want to change your plan?
        </div>
        <div style={{ fontSize:12.5, color:SLATE, lineHeight:1.65, marginBottom:12 }}>
          {stripeConfigured
            ? "Self-serve plan changes are being finalized. In the meantime we handle changes personally — usually the same day."
            : "During early access we handle plan changes personally — usually the same day. Tell us what you need and it's done."}
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={() => setDemoOpen(true)}
            style={{ padding:"10px 18px", background:STEEL, color:"#fff", border:"none",
              borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            Contact us
          </button>
        </div>
      </div>

      <RequestDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} source="app" />
    </div>
  )
}
