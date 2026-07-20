// src/components/settings/BillingView.tsx
"use client"
import { sendGAEvent } from "@next/third-parties/google"
import { useState } from "react"
import { RequestDemoModal } from "@/components/marketing/RequestDemoModal"
import { STARTER_LIMITS, BUSINESS_LIMITS, ENTERPRISE_LIMITS } from "@/lib/stripe/plan-limits"

const NAVY = "#0D1B2A", STEEL = "#1B6CA8", AMBER = "#F59E0B", GREEN = "#059669", SLATE = "#64748B"
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

// The four-tier model — the same story as the landing page, the pricing page and
// the GTM kit. This page previously sold a retired model ($12/$22/Consultant).
const TIERS = [
  { id:"TRIAL", name:"Trial", price:"$0", suffix:"2 months",
    line:"The whole product, free for two months. No card required." },
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


// ── Compare plans — rows read straight from PLANS limits so the table can
// never drift from what the gates actually enforce.
const COMPARE_ROWS: { label:string; get:(l:any)=>string|boolean }[] = [
  { label:"Projects & users",            get:l => "Unlimited" },
  { label:"Storage",                     get:l => l.storage },
  { label:"AI plan import & reports",    get:l => l.aiReports },
  { label:"Earned value (EVM) & budget", get:l => l.evm },
  { label:"Full governance suite",       get:l => l.fullGovernance },
  { label:"OCR of scanned documents",    get:l => l.ocr },
  { label:"Portfolio & programs view",   get:l => l.portfolio },
  { label:"Executive dashboard",         get:l => l.executiveDash },
  { label:"Automations",                 get:l => l.automations === -1 ? "Unlimited" : `${l.automations} rules` },
  { label:"SSO (Microsoft / Google)",    get:l => l.sso },
  { label:"Microsoft 365 integration",   get:l => l.m365 },
  { label:"API access & webhooks",       get:l => l.apiAccess },
  { label:"White-label branding",        get:l => l.whiteLabel },
  { label:"Audit log retention",         get:l => l.auditLog === "unlimited" ? "Unlimited" : l.auditLog },
  { label:"Support",                     get:l => l.support },
]

function ComparePlans() {
  const cols: { name:string; limits:any }[] = [
    { name:"Starter",    limits: STARTER_LIMITS },
    { name:"Business",   limits: BUSINESS_LIMITS },
    { name:"Enterprise", limits: ENTERPRISE_LIMITS },
  ]
  const cell = (v: string|boolean) =>
    v === true  ? <span style={{ color:"#047857", fontWeight:700 }}>✓</span> :
    v === false ? <span style={{ color:"#CBD5E1" }}>—</span> :
    <span style={{ color:NAVY }}>{v}</span>
  return (
    <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:12,
      marginBottom:14, overflow:"hidden" }}>
      <div style={{ padding:"14px 20px 10px", fontSize:13.5, fontWeight:700, color:NAVY }}>
        Compare plans
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr style={{ borderTop:"1px solid var(--border)" }}>
              <th style={{ textAlign:"left", padding:"8px 20px", color:SLATE, fontWeight:600 }}></th>
              {cols.map(c => (
                <th key={c.name} style={{ padding:"8px 12px", color: c.name==="Business" ? STEEL : SLATE,
                  fontWeight:700, whiteSpace:"nowrap" }}>{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((r,i) => (
              <tr key={r.label} style={{ borderTop:"1px solid #F1F5F9",
                background: i % 2 ? "#FAFBFC" : "#fff" }}>
                <td style={{ padding:"7px 20px", color:SLATE }}>{r.label}</td>
                {cols.map(c => (
                  <td key={c.name} style={{ padding:"7px 12px", textAlign:"center", whiteSpace:"nowrap" }}>
                    {cell(r.get(c.limits))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding:"9px 20px 13px", fontSize:10.5, color:"var(--text-3)" }}>
        Trial includes everything in Business for two months. Enterprise adds custom terms, DPA,
        personal onboarding, and priority SLA — see "Need Enterprise?".
      </div>
    </div>
  )
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
            Your trial includes everything — no feature limits, no card required. Subscribe
            below whenever you're ready: pay during the trial and your card isn't charged
            until the trial actually ends.
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

      <ComparePlans />

      {/* ── Checkout (when Stripe is configured) or the honest fallback ── */}
      {stripeConfigured && canManage ? (
        <Checkout memberCount={memberCount} onEnterprise={() => setDemoOpen(true)} />
      ) : (
        <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:12,
          padding:"16px 18px" }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:NAVY, marginBottom:6 }}>
            Want to change your plan?
          </div>
          <div style={{ fontSize:12.5, color:SLATE, lineHeight:1.65, marginBottom:12 }}>
            {canManage
              ? "During early access we handle plan changes personally — usually the same day. Tell us what you need and it's done."
              : "Plan changes need a workspace owner or admin."}
          </div>
          {canManage && (
            <button onClick={() => setDemoOpen(true)}
              style={{ padding:"10px 18px", background:STEEL, color:"#fff", border:"none",
                borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              Contact us
            </button>
          )}
        </div>
      )}

      <RequestDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} source="app" />
    </div>
  )
}


// ── Self-serve checkout ───────────────────────────────────────────────────────
const SEAT_PRICE   = { STARTER: 19, BUSINESS: 39 }
const BUNDLE_PRICE = 20
const ANNUAL_OFF   = 0.8   // 20% discount

function Checkout({ memberCount, onEnterprise }: { memberCount:number; onEnterprise:()=>void }) {
  const [planId, setPlanId]   = useState<"STARTER"|"BUSINESS">("BUSINESS")
  const [annual, setAnnual]   = useState(false)
  const [seats, setSeats]     = useState(String(Math.max(1, Math.min(memberCount, 3))))
  const [bundles, setBundles] = useState(String(Math.max(0, Math.ceil((memberCount - 3) / 10))))
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState("")

  const nSeats   = Math.max(1, parseInt(seats)   || 1)
  const nBundles = planId === "BUSINESS" ? Math.max(0, parseInt(bundles) || 0) : 0
  const mult     = annual ? ANNUAL_OFF : 1
  const monthly  = (SEAT_PRICE[planId] * nSeats + BUNDLE_PRICE * nBundles) * mult
  const covered  = planId === "BUSINESS" ? nSeats + nBundles * 10 : nSeats

  async function checkout() {
    sendGAEvent('event', 'begin_checkout', { plan: planId, cycle: annual })
    setBusy(true); setErr("")
    try {
      const res = await fetch("/api/stripe/checkout", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ planId, billing: annual ? "annual" : "monthly",
          seats: nSeats, bundles: nBundles }),
      })
      const d = await res.json().catch(() => ({}))
      const url = d?.data?.url || d?.url
      if (res.ok && url) { window.location.href = url; return }
      setErr(d?.error || "Couldn't start checkout. Try again.")
    } catch { setErr("Couldn't start checkout. Try again.") }
    finally { setBusy(false) }
  }

  return (
    <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:12,
      padding:"18px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:NAVY, flex:1 }}>Subscribe</div>
        <div style={{ display:"flex", background:"var(--surface-2,#F1F5F9)", borderRadius:8, padding:2 }}>
          {(["monthly","annual"] as const).map(b => (
            <button key={b} onClick={() => setAnnual(b === "annual")}
              style={{ padding:"5px 12px", borderRadius:6, fontSize:11.5, fontWeight:600,
                border:"none", cursor:"pointer", fontFamily:"inherit",
                background: (b === "annual") === annual ? "#fff" : "transparent",
                color: (b === "annual") === annual ? NAVY : SLATE,
                boxShadow: (b === "annual") === annual ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}>
              {b === "monthly" ? "Monthly" : "Annual −20%"}
            </button>
          ))}
        </div>
      </div>

      {/* Plan choice */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
        {(["STARTER","BUSINESS"] as const).map(id => (
          <button key={id} onClick={() => setPlanId(id)}
            style={{ textAlign:"left", padding:"11px 13px", borderRadius:9, cursor:"pointer",
              fontFamily:"inherit", background:"#fff",
              border: planId === id ? `2px solid ${STEEL}` : "1px solid var(--border)" }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:NAVY }}>
              {id === "STARTER" ? "Starter" : "Business"}
              <span style={{ fontFamily:MONO, fontSize:11, color:SLATE, marginLeft:6 }}>
                ${Math.round(SEAT_PRICE[id] * mult * 100) / 100}/user/mo
              </span>
            </div>
            <div style={{ fontSize:11, color:SLATE, marginTop:3, lineHeight:1.5 }}>
              {id === "STARTER"
                ? "Every user is a paid seat."
                : `Paid seats + $${Math.round(BUNDLE_PRICE * mult * 100) / 100}/mo per 10-user bundle.`}
            </div>
          </button>
        ))}
      </div>

      {/* Quantities */}
      <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <label style={{ flex:1, minWidth:150 }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:SLATE, textTransform:"uppercase",
            letterSpacing:".05em", marginBottom:4 }}>
            {planId === "BUSINESS" ? "Paid seats (drive the work)" : "Users"}
          </div>
          <input value={seats} onChange={e => setSeats(e.target.value.replace(/\D/g,""))}
            inputMode="numeric"
            style={{ width:"100%", padding:"8px 11px", border:"1px solid var(--border)",
              borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none" }} />
        </label>
        {planId === "BUSINESS" && (
          <label style={{ flex:1, minWidth:150 }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:SLATE, textTransform:"uppercase",
              letterSpacing:".05em", marginBottom:4 }}>
              Contributor bundles (×10 users)
            </div>
            <input value={bundles} onChange={e => setBundles(e.target.value.replace(/\D/g,""))}
              inputMode="numeric"
              style={{ width:"100%", padding:"8px 11px", border:"1px solid var(--border)",
                borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none" }} />
          </label>
        )}
      </div>

      {/* Total */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 13px",
        background:"var(--surface-2,#F8FAFC)", borderRadius:9, marginBottom:12, flexWrap:"wrap" }}>
        <div style={{ fontSize:12, color:SLATE, flex:1, minWidth:180 }}>
          Covers <strong style={{ color:NAVY }}>{covered}</strong> {covered === 1 ? "person" : "people"}
          {memberCount > covered && (
            <span style={{ color:"#B45309" }}> · you have {memberCount} members — add {planId === "BUSINESS" ? "seats or bundles" : "users"}</span>
          )}
        </div>
        <div style={{ fontFamily:MONO, fontSize:19, fontWeight:800, color:NAVY }}>
          ${monthly.toFixed(2)}<span style={{ fontSize:11, color:SLATE, fontWeight:600 }}>/mo{annual ? " · billed annually" : ""}</span>
        </div>
      </div>

      {err && (
        <div style={{ marginBottom:10, padding:"8px 11px", background:"#FEF2F2",
          border:"1px solid #FECACA", borderRadius:8, fontSize:12, color:"#B91C1C" }}>{err}</div>
      )}

      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <button onClick={checkout} disabled={busy}
          style={{ padding:"11px 20px", background:AMBER, color:NAVY, border:"none",
            borderRadius:8, fontSize:13.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
          {busy ? "Opening checkout…" : "Continue to secure checkout →"}
        </button>
        <button onClick={onEnterprise}
          style={{ padding:"11px 16px", background:"none", color:SLATE, border:"1px solid var(--border)",
            borderRadius:8, fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
          Need Enterprise?
        </button>
      </div>

      <div style={{ marginTop:12, fontSize:11, color:"var(--text-3)", lineHeight:1.6 }}>
        If your trial is still running, your card goes on file now and the first charge lands when
        the trial ends — exactly the date shown above. By subscribing you agree to the{" "}
        <a href="/legal/billing" target="_blank" rel="noreferrer"
          style={{ color:STEEL, textDecoration:"none", fontWeight:600 }}>
          Billing &amp; Subscription Terms</a>. Payments are processed by Stripe; cancel any time
        from Manage billing.
      </div>
    </div>
  )
}
