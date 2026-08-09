// src/components/admin/AdminView.tsx
"use client"
import { useState, useMemo } from "react"
import { useTranslations } from "next-intl"
import { dateLocale } from "@/lib/date-locale"
import { ContractsPanel } from "./ContractsPanel"

const NAVY = "#0D1B2A", STEEL = "#1B6CA8", AMBER = "#F59E0B", GREEN = "#059669", RED = "#DC2626"

type Tab = "workspaces" | "users" | "leads" | "contracts"

export function AdminView({ workspaces, users, demoRequests, metrics }: {
  workspaces: any[]; users: any[]; demoRequests: any[]
  metrics: { wsTotal:number; userTotal:number; projectTotal:number
             activeTrials:number; activeUsers7d:number; newLeads:number }
}) {
  const ad = useTranslations("admin")
  const [tab, setTab]   = useState<Tab>("workspaces")
  const [manage, setManage] = useState<any>(null)   // workspace row being managed
  const [busy, setBusy]     = useState(false)
  const [msg, setMsg]       = useState("")
  const [q, setQ]       = useState("")

  async function run(body: any) {
    setBusy(true); setMsg("")
    try {
      const res = await fetch("/api/admin/actions", {
        method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body),
      })
      const d = await res.json().catch(()=>({}))
      setMsg(res.ok ? `✓ ${d?.data?.message || ad("Done")}` : `✗ ${d?.error || ad("Action failed")}`)
      if (res.ok) setTimeout(() => window.location.reload(), 900)
    } catch { setMsg("✗ " + ad("Action failed")) }
    finally { setBusy(false) }
  }

  const term = q.toLowerCase().trim()
  const ws = useMemo(() => !term ? workspaces
    : workspaces.filter(w => `${w.name} ${w.slug} ${w.plan}`.toLowerCase().includes(term)), [workspaces, term])
  const us = useMemo(() => !term ? users
    : users.filter(u => `${u.name} ${u.email}`.toLowerCase().includes(term)), [users, term])
  const lds = useMemo(() => !term ? demoRequests
    : demoRequests.filter(d => `${d.name} ${d.email} ${d.company}`.toLowerCase().includes(term)), [demoRequests, term])

  const counts: Record<Tab, number> = { workspaces: ws.length, users: us.length, leads: lds.length, contracts: -1 }

  return (
    // AppShell's <main> is overflow:hidden — every page provides its own scroll
    // container. This one didn't, so rows past the viewport were simply clipped.
    <div style={{ flex:1, minHeight:0, overflowY:"auto", width:"100%" }}>
    <div style={{ padding:"20px 16px", maxWidth:1280, margin:"0 auto", fontFamily:"var(--font)" }}>
      <div style={{ marginBottom:4, display:"flex", alignItems:"center", gap:10 }}>
        <h1 style={{ fontSize:19, fontWeight:700, color:NAVY }}>{ad("Platform Admin")}</h1>
        <span style={{ fontSize:10, fontWeight:700, color:"#fff", background:RED,
          padding:"2px 7px", borderRadius:4, letterSpacing:".04em" }}>{ad("ALL TENANTS")}</span>
      </div>
      <p style={{ fontSize:12, color:"#64748B", marginBottom:16 }}>
        {ad("headerDesc")}
      </p>

      {/* ── Metrics ── */}
      <div className="fs-cols-6" style={{ marginBottom:18 }}>
        <Metric label={ad("Workspaces")}    value={metrics.wsTotal} />
        <Metric label={ad("Users")}         value={metrics.userTotal} />
        <Metric label={ad("Projects")}      value={metrics.projectTotal} />
        <Metric label={ad("Active trials")} value={metrics.activeTrials} color={AMBER} />
        <Metric label={ad("Active (7d)")}   value={metrics.activeUsers7d} color={GREEN} />
        <Metric label={ad("New leads")}     value={metrics.newLeads} color={metrics.newLeads > 0 ? RED : undefined} />
      </div>

      {/* ── Tabs + search ── */}
      <div className="fs-wrap" style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        {(["workspaces","users","leads","contracts"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:"7px 14px", borderRadius:8, fontSize:12.5, fontWeight:600, cursor:"pointer",
              border: tab===t ? "none" : "1px solid #E2E8F0",
              background: tab===t ? NAVY : "#fff", color: tab===t ? "#fff" : "#475569",
              fontFamily:"inherit" }}>
            {ad(("tab." + t) as any)}
            {counts[t] >= 0 && <span style={{ opacity:.6, marginLeft:6 }}>{counts[t]}</span>}
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={ad("Search…")}
          style={{ marginLeft:"auto", padding:"7px 11px", border:"1px solid #E2E8F0",
            borderRadius:8, fontSize:12.5, minWidth:180, outline:"none", fontFamily:"inherit" }} />
      </div>

      {msg && (
        <div style={{ marginBottom:10, padding:"8px 12px", borderRadius:8, fontSize:12.5,
          background: msg.startsWith("✓") ? "#ECFDF5" : "#FEF2F2",
          color: msg.startsWith("✓") ? GREEN : "#B91C1C",
          border:`1px solid ${msg.startsWith("✓") ? "#BBF7D0" : "#FECACA"}` }}>{msg}</div>
      )}

      {manage && <ManageDrawer w={manage} onClose={()=>setManage(null)} onAction={run} busy={busy} />}

      <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          {tab === "workspaces" && <WorkspaceTable rows={ws} onManage={setManage} />}
          {tab === "users"      && <UserTable rows={us} onAction={run} busy={busy} />}
          {tab === "contracts"  && <ContractsPanel
            workspaces={workspaces.map((w: any) => ({ id: w.id, name: w.name, plan: w.plan }))} />}
          {tab === "leads"      && <LeadTable rows={lds} onAction={run} busy={busy} />}
        </div>
      </div>

      <SalesKit />
    </div>
    </div>
  )
}

// ── Sales Kit ──
// Static collateral shipped in /public/sales-kit — customer-facing documents,
// nothing secret, so plain static links are fine. Update a doc by replacing
// the file in the repo; Vercel serves the new version on next deploy.
const KIT: { key:string; en?:string; es?:string }[] = [
  { key:"deck",      en:"FlowSync_Demo_Deck_EN.pptx",   es:"FlowSync_Demo_Deck_ES.pptx" },
  { key:"guide",     en:"FlowSync_User_Guide_EN.docx",  es:"FlowSync_Guia_de_Usuario_ES.docx" },
  { key:"security",  en:"FlowSync_Business_Information_Security.docx", es:"FlowSync_Informacion_Comercial_Seguridad_ES.docx" },
  { key:"policies",  en:"FlowSync_Service_Policies.docx", es:"FlowSync_Politicas_de_Servicio_ES.docx" },
  { key:"plans",     en:"FlowSync_Enterprise_vs_Business.docx", es:"FlowSync_Enterprise_vs_Business_ES.docx" },
  { key:"invoice",   en:"FlowSync_Sample_Enterprise_Invoice.docx", es:"FlowSync_Factura_Enterprise_Muestra_ES.docx" },
  { key:"sso",       en:"FlowSync_EntraID_SSO_OnePager.docx", es:"FlowSync_EntraID_SSO_ES.docx" },
  { key:"msa",       en:"FlowSync_Master_Subscription_Agreement_DRAFT.docx", es:"FlowSync_Acuerdo_Maestro_Suscripcion_BORRADOR_ES.docx" },
  { key:"benchmark", en:"FlowSync_Competitive_Benchmark_EN.docx", es:"FlowSync_Benchmark_Competitivo_ES.docx" },
]

function SalesKit() {
  const ad = useTranslations("admin")
  return (
    <div style={{ marginTop:18, background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, padding:"14px 16px" }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:10 }}>
        <h2 style={{ fontSize:14, fontWeight:700, color:NAVY }}>{ad("salesKitTitle")}</h2>
        <span style={{ fontSize:11, color:"#94A3B8" }}>{ad("salesKitNote")}</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:8 }}>
        {KIT.map(d => (
          <div key={d.key}
            style={{ padding:"9px 12px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC" }}>
            <div style={{ fontSize:12.5, fontWeight:600, color:NAVY }}>{ad(("kit." + d.key) as any)}</div>
            <div style={{ fontSize:10.5, color:"#64748B", marginBottom:6 }}>{ad(("kit." + d.key + ".note") as any)}</div>
            <div style={{ display:"flex", gap:6 }}>
              {d.en && (
                <a href={`/sales-kit/${d.en}`} download
                  style={{ padding:"3px 12px", fontSize:10.5, fontWeight:700, color:"#1B6CA8",
                    background:"#fff", border:"1px solid #BFDBFE", borderRadius:6, textDecoration:"none" }}>
                  EN
                </a>
              )}
              {d.es && (
                <a href={`/sales-kit/${d.es}`} download
                  style={{ padding:"3px 12px", fontSize:10.5, fontWeight:700, color:"#047857",
                    background:"#fff", border:"1px solid #A7F3D0", borderRadius:6, textDecoration:"none" }}>
                  ES
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Metric({ label, value, color }: { label:string; value:number; color?:string }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, padding:"12px 14px" }}>
      <div style={{ fontSize:10.5, color:"#64748B", fontWeight:600, textTransform:"uppercase",
        letterSpacing:".05em", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, color: color || NAVY }}>{value}</div>
    </div>
  )
}

const th: React.CSSProperties = { textAlign:"left", padding:"9px 12px", fontSize:10.5, fontWeight:700,
  color:"#64748B", textTransform:"uppercase", letterSpacing:".04em", background:"#F8FAFC",
  borderBottom:"1px solid #E2E8F0", whiteSpace:"nowrap" }
const td: React.CSSProperties = { padding:"9px 12px", fontSize:12.5, color:"#334155",
  borderBottom:"1px solid #F1F5F9", whiteSpace:"nowrap" }

const fmt = (d: any) => d ? new Date(d).toLocaleDateString(dateLocale(),{ month:"short", day:"numeric", year:"numeric" }) : "—"
const useAgo = () => {
  const ad = useTranslations("admin")
  return (d: any) => {
    if (!d) return ad("never")
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5)
    return days === 0 ? ad("today") : days === 1 ? ad("yesterday") : ad("daysAgo", { n: days })
  }
}

function Pill({ text, color }: { text:string; color:string }) {
  return <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:4,
    background:`${color}1a`, color, letterSpacing:".03em" }}>{text}</span>
}

function WorkspaceTable({ rows, onManage }: { rows:any[]; onManage:(w:any)=>void }) {
  const ad = useTranslations("admin")
  const now = Date.now()
  if (!rows.length) return <Empty text={ad("No workspaces yet.")} />
  return (
    <table style={{ width:"100%", borderCollapse:"collapse", minWidth:820 }}>
      <thead><tr>
        {["Workspace","Plan","Members","Projects","Seats","Trial","Billing","Created",""].map(h =>
          <th key={h} style={th}>{h ? ad(("col." + h) as any) : ""}</th>)}
      </tr></thead>
      <tbody>
        {rows.map(w => {
          const onTrial = w.trialEndsAt && new Date(w.trialEndsAt).getTime() > now
          const daysLeft = onTrial ? Math.ceil((new Date(w.trialEndsAt).getTime() - now) / 864e5) : 0
          return (
            <tr key={w.id}>
              <td style={{ ...td, fontWeight:600, color:NAVY }}>
                {w.name}
                <div style={{ fontSize:10.5, color:"#94A3B8", fontWeight:400 }}>/{w.slug}</div>
              </td>
              <td style={td}><Pill text={w.plan} color={w.plan==="FREE"?"#64748B":w.plan==="ENTERPRISE"?"#7C3AED":STEEL} /></td>
              <td style={td}>{w._count.members}</td>
              <td style={td}>{w._count.projects}</td>
              <td style={td}>{w.seats}</td>
              <td style={td}>
                {onTrial
                  ? <Pill text={ad("daysLeft", { n: daysLeft })} color={daysLeft <= 7 ? RED : AMBER} />
                  : <span style={{ color:"#CBD5E1" }}>—</span>}
              </td>
              <td style={td}>
                {w.stripeCustomerId
                  ? <Pill text="STRIPE" color={GREEN} />
                  : <span style={{ color:"#CBD5E1" }}>—</span>}
                {w.ssoEnabled && <span style={{ marginLeft:5 }}><Pill text="SSO" color="#7C3AED" /></span>}
              </td>
              <td style={{ ...td, color:"#64748B" }}>{fmt(w.createdAt)}</td>
              <td style={td}>
                <button onClick={() => onManage(w)}
                  style={{ padding:"4px 10px", border:"1px solid #E2E8F0", background:"#fff",
                    borderRadius:6, fontSize:11, fontWeight:600, color:"#475569",
                    cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                  {ad("Manage")}
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function UserTable({ rows, onAction, busy }: { rows:any[]; onAction:(b:any)=>void; busy:boolean }) {
  const ad = useTranslations("admin")
  const ago = useAgo()
  if (!rows.length) return <Empty text={ad("No users found.")} />
  return (
    <table style={{ width:"100%", borderCollapse:"collapse", minWidth:860 }}>
      <thead><tr>
        {["User","Workspace","Role","Sign-in","Status","Last active","Joined",""].map(h =>
          <th key={h} style={th}>{h ? ad(("col." + h) as any) : ""}</th>)}
      </tr></thead>
      <tbody>
        {rows.map(u => {
          const m = u.memberships?.[0]
          const providers = Array.from(new Set((u.accounts||[]).map((a:any) => a.provider)))
          return (
            <tr key={u.id}>
              <td style={{ ...td, fontWeight:600, color:NAVY }}>
                {u.name}
                <div style={{ fontSize:10.5, color:"#94A3B8", fontWeight:400 }}>{u.email}</div>
              </td>
              <td style={td}>{m?.workspace?.name || <span style={{ color:"#CBD5E1" }}>—</span>}</td>
              <td style={td}>{m?.role ? <Pill text={m.role} color={STEEL} /> : "—"}</td>
              <td style={td}>
                {providers.length
                  ? providers.map((p:any) => (
                      <span key={p} style={{ marginRight:4 }}>
                        <Pill text={p === "EMAIL" ? ad("password") : p.replace("microsoft-entra-id","microsoft")} color="#64748B" />
                      </span>
                    ))
                  : <span style={{ color:"#CBD5E1" }}>—</span>}
              </td>
              <td style={td}>
                <Pill text={u.isActive ? ad("ACTIVE") : ad("DISABLED")} color={u.isActive ? GREEN : RED} />
              </td>
              <td style={{ ...td, color:"#64748B" }}>{ago(u.lastLoginAt)}</td>
              <td style={{ ...td, color:"#64748B" }}>{fmt(u.createdAt)}</td>
              <td style={{ ...td, whiteSpace:"nowrap" }}>
                <button disabled={busy}
                  onClick={() => onAction({ action:"sendReset", userId:u.id })}
                  style={miniBtn} title={ad("resetTitle")}>
                  {ad("🔑 Reset")}
                </button>
                <button disabled={busy}
                  onClick={() => onAction({ action:"toggleUser", userId:u.id, isActive: !u.isActive })}
                  style={{ ...miniBtn, marginLeft:4, color: u.isActive ? "#B91C1C" : GREEN }}>
                  {u.isActive ? ad("Disable") : ad("Enable")}
                </button>
                <button disabled={busy}
                  title={ad("deleteUserTitle")}
                  onClick={() => {
                    const typed = prompt(ad("deleteUserPrompt", { email: u.email }))
                    if (typed === null) return
                    onAction({ action:"deleteUser", userId:u.id, confirmEmail: typed })
                  }}
                  style={{ ...miniBtn, marginLeft:4, background:"#B91C1C", color:"#fff", border:"none" }}>
                  {ad("Delete")}
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function LeadTable({ rows, onAction, busy }: { rows:any[]; onAction:(a:any)=>void; busy:boolean }) {
  const ad = useTranslations("admin")
  const ago = useAgo()
  const statusColor: Record<string,string> = {
    NEW: RED, CONTACTED: AMBER, QUALIFIED: STEEL, WON: GREEN, LOST: "#94A3B8",
  }
  if (!rows.length) return <Empty text={ad("noLeads")} />
  return (
    <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900 }}>
      <thead><tr>
        {["Status","Contact","Company","Team size","Message","Source","Received",""].map(h =>
          <th key={h} style={th}>{h ? ad(("col." + h) as any) : ""}</th>)}
      </tr></thead>
      <tbody>
        {rows.map(d => (
          <tr key={d.id}>
            <td style={td}><Pill text={d.status} color={statusColor[d.status] || "#64748B"} /></td>
            <td style={{ ...td, fontWeight:600, color:NAVY }}>
              {d.name}
              <div style={{ fontSize:10.5, fontWeight:400 }}>
                <a href={`mailto:${d.email}`} style={{ color:STEEL, textDecoration:"none" }}>{d.email}</a>
              </div>
              {d.phone && <div style={{ fontSize:10.5, color:"#94A3B8", fontWeight:400 }}>{d.phone}</div>}
            </td>
            <td style={td}>{d.company}</td>
            <td style={td}>{d.teamSize || "—"}</td>
            <td style={{ ...td, whiteSpace:"normal", maxWidth:280, color:"#475569", fontSize:11.5 }}>
              {d.message || <span style={{ color:"#CBD5E1" }}>—</span>}
            </td>
            <td style={td}><Pill text={d.source} color="#64748B" /></td>
            <td style={{ ...td, color:"#64748B" }}>{ago(d.createdAt)}</td>
            <td style={td}>
              <button disabled={busy}
                onClick={() => { if (confirm(ad("deleteLeadConfirm", { name: d.name })))
                  onAction({ action:"deleteDemoRequest", demoRequestId:d.id }) }}
                style={{ ...miniBtn, color:"#B91C1C", borderColor:"#FCA5A5" }}>{ad("Delete")}</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Empty({ text }: { text:string }) {
  return <div style={{ padding:"40px 20px", textAlign:"center", fontSize:13, color:"#94A3B8" }}>{text}</div>
}


const miniBtn: React.CSSProperties = {
  padding:"4px 8px", border:"1px solid #E2E8F0", background:"#fff", borderRadius:6,
  fontSize:11, fontWeight:600, color:"#475569", cursor:"pointer", fontFamily:"inherit",
}

// Only the plans we actually sell (Trial=FREE, Starter, Business, Enterprise).
// PRO / PROFESSIONAL / CONSULTANT remain valid DB enum values for legacy rows
// but are no longer assignable — offering them here caused plan-picker
// inconsistency with the Billing page.
const PLAN_OPTIONS = ["FREE","STARTER","BUSINESS","ENTERPRISE"]


function ManageDrawer({ w, onClose, onAction, busy }: {
  w:any; onClose:()=>void; onAction:(b:any)=>void; busy:boolean
}) {
  const ad = useTranslations("admin")
  const [plan, setPlan]   = useState(w.plan)
  const [seats, setSeats] = useState(String(w.seats))
  const [days, setDays]   = useState("30")

  return (
    <div onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(13,27,42,.5)", zIndex:200,
        display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:"#fff", borderRadius:12, width:"100%", maxWidth:420,
          padding:"20px 22px", boxShadow:"0 24px 60px rgba(0,0,0,.3)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
          <div style={{ fontSize:16, fontWeight:700, color:NAVY }}>{w.name}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20,
            color:"#94A3B8", cursor:"pointer", lineHeight:1 }}>×</button>
        </div>
        <div style={{ fontSize:11.5, color:"#64748B", marginBottom:16 }}>
          {ad("drawerMeta", { slug: w.slug, members: w._count.members, projects: w._count.projects })}
        </div>

        <Row label={ad("Plan")}>
          <select value={plan} onChange={e=>setPlan(e.target.value)} style={sel}>
            {/* keep a legacy plan selectable if this workspace already has one */}
            {(PLAN_OPTIONS.includes(w.plan) ? PLAN_OPTIONS : [w.plan, ...PLAN_OPTIONS]).map(p =>
              <option key={p} value={p}>{p === "FREE" ? ad("planFree") : p}</option>)}
          </select>
          <button disabled={busy || plan===w.plan}
            onClick={()=>onAction({ action:"setPlan", workspaceId:w.id, plan })}
            style={{ ...miniBtn, opacity: plan===w.plan ? .4 : 1 }}>{ad("Apply")}</button>
        </Row>

        <Row label={ad("Seats")}>
          <input value={seats} onChange={e=>setSeats(e.target.value.replace(/\D/g,""))} style={sel} />
          <button disabled={busy || !seats || seats===String(w.seats)}
            onClick={()=>onAction({ action:"setSeats", workspaceId:w.id, seats:Number(seats) })}
            style={miniBtn}>{ad("Apply")}</button>
        </Row>

        <Row label={ad("Extend trial")}>
          <select value={days} onChange={e=>setDays(e.target.value)} style={sel}>
            {["7","14","30","60","90"].map(d => <option key={d} value={d}>{ad("nDays", { n: d })}</option>)}
          </select>
          <button disabled={busy}
            onClick={()=>onAction({ action:"extendTrial", workspaceId:w.id, days:Number(days) })}
            style={miniBtn}>{ad("Extend")}</button>
        </Row>

        <div style={{ display:"flex", gap:6, marginTop:16, paddingTop:14, borderTop:"1px solid #F1F5F9" }}>
          <button disabled={busy} onClick={()=>onAction({ action:"endTrial", workspaceId:w.id })}
            style={miniBtn}>{ad("Clear trial")}</button>
          <button disabled={busy}
            onClick={()=>onAction({ action:"toggleWorkspace", workspaceId:w.id, isActive:false })}
            style={{ ...miniBtn, color:"#B91C1C", marginLeft:"auto" }}>{ad("Disable workspace")}</button>
        </div>

        <div style={{ marginTop:14, paddingTop:12, borderTop:"1px solid #FECACA" }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:"#B91C1C", textTransform:"uppercase",
            letterSpacing:".05em", marginBottom:4 }}>{ad("Danger zone")}</div>
          <div style={{ fontSize:10.5, color:"#7F1D1D", lineHeight:1.5, marginBottom:8 }}>
            {ad("dangerDesc")}
          </div>
          <button disabled={busy}
            onClick={() => {
              const typed = prompt(ad("deleteWorkspacePrompt", { name: w.name }))
              if (typed === null) return
              onAction({ action:"deleteWorkspace", workspaceId:w.id, confirmName: typed })
            }}
            style={{ ...miniBtn, background:"#B91C1C", color:"#fff", border:"none" }}>
            {ad("Delete workspace permanently")}
          </button>
        </div>

        <div style={{ marginTop:14, fontSize:10.5, color:"#94A3B8", lineHeight:1.5 }}>
          {ad("billingNote")}
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:11 }}>
      <div style={{ fontSize:10.5, fontWeight:700, color:"#64748B", textTransform:"uppercase",
        letterSpacing:".05em", marginBottom:4 }}>{label}</div>
      <div style={{ display:"flex", gap:6 }}>{children}</div>
    </div>
  )
}

const sel: React.CSSProperties = {
  flex:1, padding:"6px 9px", border:"1px solid #E2E8F0", borderRadius:6,
  fontSize:12.5, fontFamily:"inherit", color:"#0D1B2A", outline:"none", background:"#fff",
}
