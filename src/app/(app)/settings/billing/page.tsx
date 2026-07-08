// src/app/(app)/settings/billing/page.tsx
"use client"
import { useState, useEffect } from "react"
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/stripe/client"

const FEATURE_ROWS = [
  { label:"Projects",       key:"projects",       fmt:(v:any)=>v===-1?"Unlimited":String(v) },
  { label:"Users",          key:"users",          fmt:(v:any)=>v===-1?"Unlimited":String(v) },
  { label:"Storage",        key:"storage",        fmt:(v:any)=>String(v) },
  { label:"EVM dashboard",  key:"evm",            fmt:(v:any)=>v?"✓":"—" },
  { label:"PM governance best practices",key:"fullGovernance",fmt:(v:any)=>v?"✓":"—" },
  { label:"AI reports",     key:"aiReports",      fmt:(v:any)=>v?"✓":"—" },
  { label:"Word export",    key:"wordExport",      fmt:(v:any)=>v?"✓":"—" },
  { label:"Executive dashboard",key:"executiveDash",fmt:(v:any)=>v?"✓":"—" },
  { label:"Portfolio hierarchy",key:"portfolio",   fmt:(v:any)=>v?"✓":"—" },
  { label:"Automation recipes",key:"automations",  fmt:(v:any)=>v===-1?"Unlimited":v===0?"—":`${v} recipes` },
  { label:"M365 integration",key:"m365",           fmt:(v:any)=>v?"✓":"—" },
  { label:"API access",     key:"apiAccess",       fmt:(v:any)=>v?"✓":"—" },
  { label:"SSO / Azure AD", key:"sso",             fmt:(v:any)=>v?"✓":"—" },
  { label:"White-label",    key:"whiteLabel",      fmt:(v:any)=>v?"✓":"—" },
  { label:"Audit log",      key:"auditLog",        fmt:(v:any)=>v==="none"?"—":String(v) },
  { label:"Support",        key:"support",         fmt:(v:any)=>String(v) },
]

export default function BillingPage() {
  const [annual,    setAnnual]    = useState(true)
  const [loading,   setLoading]   = useState(false)
  const [current,   setCurrent]   = useState<PlanId>("FREE")
  const [cancelled, setCancelled] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (params.get("cancelled")) setCancelled(true)
    }
  }, [])

  async function subscribe(planId: PlanId) {
    if (planId === "FREE")       { alert("You are on the free plan."); return }
    if (planId === "ENTERPRISE") { window.open("mailto:sales@flowsyncpm.com","_blank"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/stripe/checkout", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ planId, billing:annual?"annual":"monthly" }),
      })
      const d = await res.json()
      if (d.url) window.location.href = d.url
    } finally { setLoading(false) }
  }

  async function manageSubscription() {
    setLoading(true)
    try {
      const res = await fetch("/api/stripe/portal", { method:"POST" })
      const d = await res.json()
      if (d.url) window.location.href = d.url
    } finally { setLoading(false) }
  }

  const fmtPrice = (plan: typeof PLANS[PlanId]) => {
    if (plan.priceMonthly === 0) return "Free"
    const p = annual ? plan.priceAnnual : plan.priceMonthly
    return `$${(p/100).toFixed(0)}`
  }
  const fmtSuffix = (plan: typeof PLANS[PlanId]) => {
    if (plan.priceMonthly === 0) return ""
    if (plan.id === "CONSULTANT") return annual?"/mo (billed annually)":"/mo flat"
    return annual?"/user/mo (billed annually)":"/user/mo"
  }

  return (
    <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 20px",
      fontFamily:"var(--font,-apple-system,system-ui)" }}>

      {cancelled && (
        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA",
          borderRadius:8, padding:"12px 16px", marginBottom:20,
          fontSize:13, color:"#DC2626" }}>
          Checkout cancelled — no changes were made.
        </div>
      )}

      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:24, fontWeight:800, color:"#1E293B", marginBottom:6 }}>
          Billing & Plans
        </h1>
        <p style={{ fontSize:14, color:"#64748B" }}>
          Current plan: <strong style={{ color:"#1B6CA8" }}>{PLANS[current]?.name}</strong>
        </p>
      </div>

      {/* Billing toggle */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
        <span style={{ fontSize:13, color:!annual?"#1E293B":"#94A3B8", fontWeight:!annual?600:400 }}>Monthly</span>
        <div onClick={()=>setAnnual(a=>!a)}
          style={{ width:44, height:24, borderRadius:12, background:annual?"#1B6CA8":"#CBD5E1",
            cursor:"pointer", display:"flex", alignItems:"center", padding:"0 3px",
            transition:"background .2s" }}>
          <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff",
            transform:annual?"translateX(20px)":"translateX(0)", transition:"transform .2s" }} />
        </div>
        <span style={{ fontSize:13, color:annual?"#1E293B":"#94A3B8", fontWeight:annual?600:400 }}>
          Annual <span style={{ color:"#059669", fontWeight:700 }}>— save 20%</span>
        </span>
      </div>

      {/* Plan cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:32 }}>
        {PLAN_ORDER.map(planId => {
          const plan = PLANS[planId]
          const isCurrent = current === planId
          const isHighlight = plan.highlighted
          return (
            <div key={planId} style={{
              background:"#fff", borderRadius:10,
              border:`2px solid ${isHighlight?"#059669":isCurrent?"#1B6CA8":"#E2E8F0"}`,
              overflow:"hidden", position:"relative",
              boxShadow:isHighlight?"0 4px 20px rgba(5,150,105,.15)":"none" }}>
              {isHighlight && (
                <div style={{ background:"#059669", color:"#fff", textAlign:"center",
                  fontSize:10, fontWeight:700, padding:"3px 0", letterSpacing:".06em" }}>
                  MOST POPULAR
                </div>
              )}
              {isCurrent && !isHighlight && (
                <div style={{ background:"#1B6CA8", color:"#fff", textAlign:"center",
                  fontSize:10, fontWeight:700, padding:"3px 0" }}>
                  CURRENT PLAN
                </div>
              )}
              <div style={{ padding:"16px 14px" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#1E293B",
                  marginBottom:4, textTransform:"uppercase", letterSpacing:".05em" }}>
                  {plan.name}
                </div>
                <div style={{ fontSize:24, fontWeight:800, color:"#1E293B", lineHeight:1, marginBottom:3 }}>
                  {fmtPrice(plan)}
                </div>
                <div style={{ fontSize:10, color:"#64748B", marginBottom:10, minHeight:28 }}>
                  {fmtSuffix(plan)}
                </div>
                <p style={{ fontSize:11, color:"#64748B", margin:"0 0 14px", lineHeight:1.5 }}>
                  {plan.description}
                </p>
                <button
                  onClick={() => isCurrent ? manageSubscription() : subscribe(planId)}
                  disabled={loading}
                  style={{ width:"100%", padding:"9px 0", borderRadius:7,
                    background: isCurrent?"#F1F5F9":isHighlight?"#059669":"#1B6CA8",
                    color: isCurrent?"#64748B":"#fff",
                    border:"none", fontSize:12, fontWeight:600,
                    cursor:loading?"wait":"pointer", fontFamily:"var(--font)" }}>
                  {isCurrent
                    ? "Manage"
                    : planId==="FREE"?"Current":planId==="ENTERPRISE"?"Contact sales":"Upgrade"}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Feature comparison table */}
      <div style={{ background:"#fff", borderRadius:10, border:"1px solid #E2E8F0", overflow:"hidden" }}>
        <div style={{ padding:"14px 18px", borderBottom:"1px solid #E2E8F0",
          fontSize:13, fontWeight:700, color:"#1E293B" }}>
          Full feature comparison
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#1a3a5c" }}>
              <th style={{ padding:"10px 16px", textAlign:"left", fontSize:11,
                fontWeight:700, color:"rgba(255,255,255,.7)", width:"28%" }}>Feature</th>
              {PLAN_ORDER.map(p => (
                <th key={p} style={{ padding:"10px 8px", textAlign:"center", fontSize:11,
                  fontWeight:700, color: PLANS[p].highlighted?"#86EFAC":"rgba(255,255,255,.85)" }}>
                  {PLANS[p].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURE_ROWS.map((row, i) => (
              <tr key={row.key} style={{ background:i%2===0?"#fff":"#F8FAFC",
                borderBottom:"1px solid #F1F5F9" }}>
                <td style={{ padding:"9px 16px", fontSize:12, fontWeight:500, color:"#374151" }}>
                  {row.label}
                </td>
                {PLAN_ORDER.map(planId => {
                  const val = PLANS[planId].limits[row.key as keyof typeof PLANS[PlanId]["limits"]]
                  const fmt = row.fmt(val)
                  return (
                    <td key={planId} style={{ padding:"9px 8px", textAlign:"center", fontSize:12,
                      color:fmt==="✓"?"#059669":fmt==="—"?"#CBD5E1":"#374151",
                      fontWeight:fmt==="✓"?700:400,
                      background:PLANS[planId].highlighted?"rgba(5,150,105,.04)":"transparent" }}>
                      {fmt}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop:20, fontSize:11, color:"#94A3B8", textAlign:"center" }}>
        All paid plans include a 14-day free trial · No credit card required to start ·
        Cancel anytime · <a href="mailto:billing@flowsyncpm.com" style={{ color:"#1B6CA8" }}>
          billing@flowsyncpm.com
        </a>
      </div>
    </div>
  )
}
