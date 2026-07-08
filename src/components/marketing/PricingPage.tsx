"use client"
// src/components/marketing/PricingPage.tsx

import { useState } from "react"
import Link from "next/link"

const STEEL = "#1B6CA8"
const GREEN = "#059669"

const TIERS = [
  {
    name:"Free", price:0, priceSuffix:"", annualPrice:0,
    desc:"For individual PMs and small experiments.",
    color:"#64748B", highlight:false,
    cta:"Get started free", ctaHref:"/auth/signup",
    features:[
      "1 project", "Up to 3 users", "Dashboard + Tasks + Gantt + Board",
      "Basic risk & issue tracking", "1 GB file storage", "Community support",
    ],
    notIncluded:["EVM / budget tracking","Change requests","PM governance best practices","AI reports","Word export"],
  },
  {
    name:"Starter", price:12, priceSuffix:"/user/mo", annualPrice:9.60,
    desc:"For small teams getting structured.",
    color:STEEL, highlight:false,
    cta:"Start free trial", ctaHref:"/auth/signup?plan=starter",
    features:[
      "5 projects", "Up to 10 users", "All views: Dashboard, Gantt, Board, Tasks",
      "Full risk & issue tracking", "Budget tracking", "Change request workflow",
      "Excel import/export", "10 GB storage", "Email support",
    ],
    notIncluded:["PM Standard full governance","AI report generator","Word export","Executive Dashboard"],
  },
  {
    name:"Professional", price:22, priceSuffix:"/user/mo", annualPrice:17.60,
    desc:"Full PM Standard PMO platform. The sweet spot.",
    color:GREEN, highlight:true,
    cta:"Start free trial", ctaHref:"/auth/signup?plan=professional",
    badge:"Most popular",
    features:[
      "Unlimited projects", "Unlimited users", "Complete PM governance best practices",
      "Decisions + Lessons Learned + Benefits Realization",
      "Baseline management (approve/lock)",
      "Executive Dashboard", "Portfolio → Program → Project hierarchy",
      "✨ AI Report Generator (5 report types)", "📄 Word document export",
      "M365 integration", "API access", "100 GB storage",
      "1-year audit log", "Email support",
    ],
    notIncluded:["SSO / Azure AD","White-label"],
  },
  {
    name:"Enterprise", price:38, priceSuffix:"/user/mo", annualPrice:30.40,
    desc:"For large PMOs with enterprise governance needs.",
    color:"#1a3a5c", highlight:false,
    cta:"Contact sales", ctaHref:"mailto:sales@flowsyncpm.com",
    features:[
      "Everything in Professional",
      "SSO / Azure AD / SAML", "White-label & custom domain",
      "Unlimited file storage", "Unlimited audit log",
      "Dedicated Customer Success Manager", "SLA guarantee",
      "Custom onboarding", "Data Processing Agreement (DPA)",
    ],
    notIncluded:[],
  },
  {
    name:"Consultant", price:99, priceSuffix:"/mo flat", annualPrice:79,
    desc:"1 consultant, unlimited client workspaces. Unique in the market.",
    color:"#7C3AED", highlight:false,
    cta:"Start free trial", ctaHref:"/auth/signup?plan=consultant",
    features:[
      "1 consultant user", "Unlimited client workspaces",
      "Full Professional features per workspace",
      "50 GB storage per workspace", "Client read-only access included",
      "Buy & sell automation recipes", "Dedicated CSM",
    ],
    notIncluded:[],
  },
]

const COMPARE_FEATURES = [
  { label:"Projects",                free:"1",    starter:"5",     pro:"Unlimited", ent:"Unlimited", cons:"Unlimited" },
  { label:"Users",                   free:"3",    starter:"10",    pro:"Unlimited", ent:"Unlimited", cons:"1 + clients" },
  { label:"Dashboard / Tasks / Gantt",free:"✓",  starter:"✓",     pro:"✓",         ent:"✓",         cons:"✓" },
  { label:"EVM (CPI/SPI/TCPI)",      free:"—",   starter:"✓",     pro:"✓",         ent:"✓",         cons:"✓" },
  { label:"Risk heat map (P×I)",     free:"Basic",starter:"✓",    pro:"✓",         ent:"✓",         cons:"✓" },
  { label:"Change request workflow", free:"—",   starter:"✓",     pro:"✓",         ent:"✓",         cons:"✓" },
  { label:"PM Standard full governance", free:"—",   starter:"—",     pro:"✓",         ent:"✓",         cons:"✓" },
  { label:"Lessons + Decisions + Benefits",free:"—",starter:"—",  pro:"✓",         ent:"✓",         cons:"✓" },
  { label:"Baseline approval",       free:"—",   starter:"—",     pro:"✓",         ent:"✓",         cons:"✓" },
  { label:"Executive Dashboard",     free:"—",   starter:"—",     pro:"✓",         ent:"✓",         cons:"✓" },
  { label:"AI report generator",     free:"—",   starter:"—",     pro:"✓",         ent:"✓",         cons:"✓" },
  { label:"Word (.docx) export",     free:"—",   starter:"—",     pro:"✓",         ent:"✓",         cons:"✓" },
  { label:"M365 integration",        free:"—",   starter:"—",     pro:"✓",         ent:"✓",         cons:"✓" },
  { label:"API access",              free:"—",   starter:"—",     pro:"✓",         ent:"✓",         cons:"✓" },
  { label:"SSO / Azure AD",          free:"—",   starter:"—",     pro:"—",         ent:"✓",         cons:"—" },
  { label:"White-label",             free:"—",   starter:"—",     pro:"—",         ent:"✓",         cons:"Add-on" },
  { label:"Automation recipes",      free:"—",   starter:"5",     pro:"20",        ent:"Unlimited", cons:"Unlimited" },
  { label:"File storage",            free:"1 GB",starter:"10 GB", pro:"100 GB",    ent:"Unlimited", cons:"50 GB/ws" },
  { label:"Audit log",               free:"—",   starter:"30 days",pro:"1 year",   ent:"Unlimited", cons:"1 year" },
  { label:"Support",                 free:"Community",starter:"Email",pro:"Email",  ent:"Dedicated CSM",cons:"Dedicated CSM" },
]

export function PricingPage() {
  const [annual, setAnnual] = useState(true)

  return (
    <div style={{ fontFamily:"var(--font,-apple-system,system-ui)", background:"#F8FAFC",
      minHeight:"100vh", color:"#1E293B" }}>

      {/* Nav */}
      <nav style={{ background:"#1a3a5c", padding:"0 40px", height:60,
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <Link href="/" style={{ fontSize:18, fontWeight:800, color:"#fff", textDecoration:"none" }}>
          FlowSync <span style={{ color:"#60A5FA" }}>PM</span>
        </Link>
        <div style={{ display:"flex", gap:20, alignItems:"center" }}>
          <Link href="/dashboard" style={{ fontSize:13, color:"rgba(255,255,255,.7)", textDecoration:"none" }}>Dashboard</Link>
          <Link href="/auth/signup" style={{ padding:"7px 18px", background:GREEN, color:"#fff",
            borderRadius:6, fontSize:13, fontWeight:600, textDecoration:"none" }}>
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ textAlign:"center", padding:"60px 20px 40px" }}>
        <div style={{ fontSize:11, fontWeight:700, color:STEEL, textTransform:"uppercase",
          letterSpacing:".1em", marginBottom:12 }}>
          Simple, transparent pricing
        </div>
        <h1 style={{ fontSize:42, fontWeight:800, margin:"0 0 16px", lineHeight:1.1 }}>
          The PMO platform that doesn't<br/>hide features behind add-ons
        </h1>
        <p style={{ fontSize:17, color:"#64748B", maxWidth:560, margin:"0 auto 32px", lineHeight:1.6 }}>
          Full PM governance best practices included at every paid tier.
          No per-module fees. No automation caps. No surprises.
        </p>

        {/* Billing toggle */}
        <div style={{ display:"inline-flex", alignItems:"center", gap:10,
          background:"#fff", padding:"6px 16px", borderRadius:20,
          border:"1px solid #E2E8F0", marginBottom:40 }}>
          <span style={{ fontSize:13, color:!annual?"#1E293B":"#94A3B8", fontWeight:!annual?600:400 }}>Monthly</span>
          <div onClick={()=>setAnnual(a=>!a)}
            style={{ width:44, height:24, borderRadius:12,
              background:annual?STEEL:"#CBD5E1", cursor:"pointer",
              display:"flex", alignItems:"center", padding:"0 3px",
              transition:"background .2s", position:"relative" }}>
            <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff",
              transform:annual?"translateX(20px)":"translateX(0)", transition:"transform .2s" }} />
          </div>
          <span style={{ fontSize:13, color:annual?"#1E293B":"#94A3B8", fontWeight:annual?600:400 }}>
            Annual <span style={{ color:GREEN, fontWeight:700 }}>— save 20%</span>
          </span>
        </div>
      </div>

      {/* Pricing cards */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 20px 60px",
        display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16 }}>
        {TIERS.map(tier => (
          <div key={tier.name}
            style={{ background:"#fff", borderRadius:12,
              border:`2px solid ${tier.highlight?GREEN:"#E2E8F0"}`,
              boxShadow:tier.highlight?"0 8px 32px rgba(5,150,105,.15)":"0 1px 4px rgba(0,0,0,.06)",
              overflow:"hidden", position:"relative" }}>
            {tier.badge && (
              <div style={{ position:"absolute", top:12, right:12, padding:"3px 10px",
                borderRadius:20, background:GREEN, color:"#fff",
                fontSize:10, fontWeight:700 }}>
                {tier.badge}
              </div>
            )}
            <div style={{ background:tier.highlight?GREEN+"08":"#F8FAFC", padding:"20px 20px 16px" }}>
              <div style={{ fontSize:12, fontWeight:700, color:tier.color, textTransform:"uppercase",
                letterSpacing:".06em", marginBottom:6 }}>{tier.name}</div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:4, marginBottom:6 }}>
                <span style={{ fontSize:32, fontWeight:800, color:"#1E293B" }}>
                  {tier.price===0?"Free":`$${annual&&tier.annualPrice?tier.annualPrice:tier.price}`}
                </span>
                {tier.price>0 && (
                  <span style={{ fontSize:12, color:"#64748B", marginBottom:6 }}>
                    {annual&&tier.annualPrice!==tier.price?"/user/mo (billed annually)":tier.priceSuffix}
                  </span>
                )}
              </div>
              <p style={{ fontSize:12, color:"#64748B", margin:0, lineHeight:1.5 }}>{tier.desc}</p>
            </div>
            <div style={{ padding:"16px 20px" }}>
              <a href={tier.ctaHref}
                style={{ display:"block", textAlign:"center", padding:"10px", borderRadius:8,
                  background:tier.highlight?GREEN:tier.color, color:"#fff",
                  textDecoration:"none", fontSize:13, fontWeight:600, marginBottom:16 }}>
                {tier.cta}
              </a>
              {tier.features.map((f,i) => (
                <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                  <span style={{ color:GREEN, flexShrink:0, fontSize:12 }}>✓</span>
                  <span style={{ fontSize:12, color:"#374151", lineHeight:1.4 }}>{f}</span>
                </div>
              ))}
              {tier.notIncluded.map((f,i) => (
                <div key={i} style={{ display:"flex", gap:8, marginBottom:6, opacity:.4 }}>
                  <span style={{ color:"#94A3B8", flexShrink:0, fontSize:12 }}>✗</span>
                  <span style={{ fontSize:12, color:"#94A3B8", lineHeight:1.4 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Full comparison table */}
      <div style={{ maxWidth:1000, margin:"0 auto 60px", padding:"0 20px" }}>
        <h2 style={{ fontSize:24, fontWeight:700, textAlign:"center", marginBottom:24 }}>
          Full feature comparison
        </h2>
        <div style={{ background:"#fff", borderRadius:12, border:"1px solid #E2E8F0", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#1a3a5c" }}>
                <th style={{ padding:"12px 16px", textAlign:"left", fontSize:11, fontWeight:700,
                  color:"rgba(255,255,255,.7)", textTransform:"uppercase", letterSpacing:".05em", width:"28%" }}>Feature</th>
                {["Free","Starter","Professional","Enterprise","Consultant"].map(n=>(
                  <th key={n} style={{ padding:"12px 8px", textAlign:"center", fontSize:11,
                    fontWeight:700, color: n==="Professional"?"#86EFAC":"rgba(255,255,255,.85)",
                    letterSpacing:".03em" }}>{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_FEATURES.map((f,i) => (
                <tr key={f.label} style={{ background:i%2===0?"#fff":"#F8FAFC",
                  borderBottom:"1px solid #F1F5F9" }}>
                  <td style={{ padding:"10px 16px", fontSize:12, fontWeight:500, color:"#374151" }}>{f.label}</td>
                  {[f.free,f.starter,f.pro,f.ent,f.cons].map((v,vi)=>(
                    <td key={vi} style={{ padding:"10px 8px", textAlign:"center", fontSize:12,
                      color:v==="✓"?GREEN:v==="—"?"#CBD5E1":"#374151",
                      fontWeight:v==="✓"?700:400,
                      background:vi===2?"rgba(5,150,105,.04)":"transparent" }}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ strip */}
      <div style={{ background:"#1a3a5c", padding:"40px 40px", textAlign:"center", color:"#fff" }}>
        <h2 style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>Questions?</h2>
        <p style={{ fontSize:14, opacity:.7, marginBottom:20 }}>
          All paid plans include a 14-day free trial. No credit card required.
        </p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <a href="mailto:sales@flowsyncpm.com"
            style={{ padding:"10px 20px", background:"rgba(255,255,255,.1)", color:"#fff",
              borderRadius:8, fontSize:13, textDecoration:"none", border:"1px solid rgba(255,255,255,.2)" }}>
            Contact sales
          </a>
          <Link href="/legal"
            style={{ padding:"10px 20px", background:"rgba(255,255,255,.1)", color:"#fff",
              borderRadius:8, fontSize:13, textDecoration:"none", border:"1px solid rgba(255,255,255,.2)" }}>
            Legal & Privacy
          </Link>
        </div>
        <div style={{ marginTop:24, fontSize:11, opacity:.4 }}>
          © 2026 FlowSync PM. All rights reserved.
        </div>
      </div>
    </div>
  )
}
