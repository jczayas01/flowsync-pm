// src/components/admin/AdminView.tsx
"use client"
import { useState, useMemo } from "react"

const NAVY = "#0D1B2A", STEEL = "#1B6CA8", AMBER = "#F59E0B", GREEN = "#059669", RED = "#DC2626"

type Tab = "workspaces" | "users" | "leads"

export function AdminView({ workspaces, users, demoRequests, metrics }: {
  workspaces: any[]; users: any[]; demoRequests: any[]
  metrics: { wsTotal:number; userTotal:number; projectTotal:number
             activeTrials:number; activeUsers7d:number; newLeads:number }
}) {
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
      setMsg(res.ok ? `✓ ${d?.data?.message || "Done"}` : `✗ ${d?.error || "Action failed"}`)
      if (res.ok) setTimeout(() => window.location.reload(), 900)
    } catch { setMsg("✗ Action failed") }
    finally { setBusy(false) }
  }

  const term = q.toLowerCase().trim()
  const ws = useMemo(() => !term ? workspaces
    : workspaces.filter(w => `${w.name} ${w.slug} ${w.plan}`.toLowerCase().includes(term)), [workspaces, term])
  const us = useMemo(() => !term ? users
    : users.filter(u => `${u.name} ${u.email}`.toLowerCase().includes(term)), [users, term])
  const lds = useMemo(() => !term ? demoRequests
    : demoRequests.filter(d => `${d.name} ${d.email} ${d.company}`.toLowerCase().includes(term)), [demoRequests, term])

  const counts: Record<Tab, number> = { workspaces: ws.length, users: us.length, leads: lds.length }

  return (
    // AppShell's <main> is overflow:hidden — every page provides its own scroll
    // container. This one didn't, so rows past the viewport were simply clipped.
    <div style={{ flex:1, minHeight:0, overflowY:"auto", width:"100%" }}>
    <div style={{ padding:"20px 16px", maxWidth:1280, margin:"0 auto", fontFamily:"var(--font)" }}>
      <div style={{ marginBottom:4, display:"flex", alignItems:"center", gap:10 }}>
        <h1 style={{ fontSize:19, fontWeight:700, color:NAVY }}>⚡ Platform Admin</h1>
        <span style={{ fontSize:10, fontWeight:700, color:"#fff", background:RED,
          padding:"2px 7px", borderRadius:4, letterSpacing:".04em" }}>ALL TENANTS</span>
      </div>
      <p style={{ fontSize:12, color:"#64748B", marginBottom:16 }}>
        Every workspace on FlowSync PM. This view crosses tenant boundaries — treat it as read-only operator context.
      </p>

      {/* ── Metrics ── */}
      <div className="fs-cols-6" style={{ marginBottom:18 }}>
        <Metric label="Workspaces"    value={metrics.wsTotal} />
        <Metric label="Users"         value={metrics.userTotal} />
        <Metric label="Projects"      value={metrics.projectTotal} />
        <Metric label="Active trials" value={metrics.activeTrials} color={AMBER} />
        <Metric label="Active (7d)"   value={metrics.activeUsers7d} color={GREEN} />
        <Metric label="New leads"     value={metrics.newLeads} color={metrics.newLeads > 0 ? RED : undefined} />
      </div>

      {/* ── Tabs + search ── */}
      <div className="fs-wrap" style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        {(["workspaces","users","leads"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:"7px 14px", borderRadius:8, fontSize:12.5, fontWeight:600, cursor:"pointer",
              border: tab===t ? "none" : "1px solid #E2E8F0",
              background: tab===t ? NAVY : "#fff", color: tab===t ? "#fff" : "#475569",
              fontFamily:"inherit" }}>
            {t === "workspaces" ? "🏢 Workspaces" : t === "users" ? "👤 Users" : "📩 Demo requests"}
            <span style={{ opacity:.6, marginLeft:6 }}>{counts[t]}</span>
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
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
          {tab === "leads"      && <LeadTable rows={lds} />}
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
const KIT: { file:string; label:string; note:string }[] = [
  { file:"FlowSync_Demo_Deck_ES.pptx",                        label:"Demo deck (ES)",                  note:"11 slides · speaker notes" },
  { file:"FlowSync_Guia_de_Usuario_ES.docx",                  label:"Guía de Usuario (ES)",            note:"role-based user guide" },
  { file:"FlowSync_Business_Information_Security.docx",       label:"Business Info & Security",        note:"for IT / compliance review" },
  { file:"FlowSync_Service_Policies.docx",                    label:"Service Policies",                note:"SLA · uptime · retention" },
  { file:"FlowSync_Enterprise_vs_Business.docx",              label:"Enterprise vs Business",          note:"plan justification" },
  { file:"FlowSync_Sample_Enterprise_Invoice.docx",           label:"Sample Enterprise Invoice",       note:"NET-30 template" },
  { file:"FlowSync_EntraID_SSO_OnePager.docx",                label:"Entra ID / AD One-Pager",         note:"SSO for customer IT" },
  { file:"FlowSync_Master_Subscription_Agreement_DRAFT.docx", label:"Master Subscription Agreement",   note:"DRAFT — attorney review" },
]

function SalesKit() {
  return (
    <div style={{ marginTop:18, background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, padding:"14px 16px" }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:10 }}>
        <h2 style={{ fontSize:14, fontWeight:700, color:NAVY }}>📦 Sales &amp; Enterprise Kit</h2>
        <span style={{ fontSize:11, color:"#94A3B8" }}>customer-facing collateral · Jul 2026</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:8 }}>
        {KIT.map(d => (
          <a key={d.file} href={`/sales-kit/${d.file}`} download
            style={{ display:"block", padding:"9px 12px", border:"1px solid #E2E8F0", borderRadius:8,
              textDecoration:"none", background:"#F8FAFC" }}>
            <div style={{ fontSize:12.5, fontWeight:600, color:NAVY }}>{d.label}</div>
            <div style={{ fontSize:10.5, color:"#64748B" }}>{d.note}</div>
          </a>
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

const fmt = (d: any) => d ? new Date(d).toLocaleDateString("en-US",{ month:"short", day:"numeric", year:"numeric" }) : "—"
const ago = (d: any) => {
  if (!d) return "never"
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5)
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`
}

function Pill({ text, color }: { text:string; color:string }) {
  return <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:4,
    background:`${color}1a`, color, letterSpacing:".03em" }}>{text}</span>
}

function WorkspaceTable({ rows, onManage }: { rows:any[]; onManage:(w:any)=>void }) {
  if (!rows.length) return <Empty text="No workspaces yet." />
  const now = Date.now()
  return (
    <table style={{ width:"100%", borderCollapse:"collapse", minWidth:820 }}>
      <thead><tr>
        {["Workspace","Plan","Members","Projects","Seats","Trial","Billing","Created",""].map(h =>
          <th key={h} style={th}>{h}</th>)}
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
                  ? <Pill text={`${daysLeft}d left`} color={daysLeft <= 7 ? RED : AMBER} />
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
                  Manage
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
  if (!rows.length) return <Empty text="No users found." />
  return (
    <table style={{ width:"100%", borderCollapse:"collapse", minWidth:860 }}>
      <thead><tr>
        {["User","Workspace","Role","Sign-in","Status","Last active","Joined",""].map(h =>
          <th key={h} style={th}>{h}</th>)}
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
                        <Pill text={p === "EMAIL" ? "password" : p.replace("microsoft-entra-id","microsoft")} color="#64748B" />
                      </span>
                    ))
                  : <span style={{ color:"#CBD5E1" }}>—</span>}
              </td>
              <td style={td}>
                <Pill text={u.isActive ? "ACTIVE" : "DISABLED"} color={u.isActive ? GREEN : RED} />
              </td>
              <td style={{ ...td, color:"#64748B" }}>{ago(u.lastLoginAt)}</td>
              <td style={{ ...td, color:"#64748B" }}>{fmt(u.createdAt)}</td>
              <td style={{ ...td, whiteSpace:"nowrap" }}>
                <button disabled={busy}
                  onClick={() => onAction({ action:"sendReset", userId:u.id })}
                  style={miniBtn} title="Emails a single-use reset link — you never see the password">
                  🔑 Reset
                </button>
                <button disabled={busy}
                  onClick={() => onAction({ action:"toggleUser", userId:u.id, isActive: !u.isActive })}
                  style={{ ...miniBtn, marginLeft:4, color: u.isActive ? "#B91C1C" : GREEN }}>
                  {u.isActive ? "Disable" : "Enable"}
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function LeadTable({ rows }: { rows:any[] }) {
  if (!rows.length) return <Empty text="No demo requests yet. They'll appear here the moment someone asks." />
  const statusColor: Record<string,string> = {
    NEW: RED, CONTACTED: AMBER, QUALIFIED: STEEL, WON: GREEN, LOST: "#94A3B8",
  }
  return (
    <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900 }}>
      <thead><tr>
        {["Status","Contact","Company","Team size","Message","Source","Received"].map(h =>
          <th key={h} style={th}>{h}</th>)}
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

const PLAN_OPTIONS = ["FREE","STARTER","PRO","PROFESSIONAL","CONSULTANT","BUSINESS","ENTERPRISE"]

function ManageDrawer({ w, onClose, onAction, busy }: {
  w:any; onClose:()=>void; onAction:(b:any)=>void; busy:boolean
}) {
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
          /{w.slug} · {w._count.members} members · {w._count.projects} projects
        </div>

        <Row label="Plan">
          <select value={plan} onChange={e=>setPlan(e.target.value)} style={sel}>
            {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button disabled={busy || plan===w.plan}
            onClick={()=>onAction({ action:"setPlan", workspaceId:w.id, plan })}
            style={{ ...miniBtn, opacity: plan===w.plan ? .4 : 1 }}>Apply</button>
        </Row>

        <Row label="Seats">
          <input value={seats} onChange={e=>setSeats(e.target.value.replace(/\D/g,""))} style={sel} />
          <button disabled={busy || !seats || seats===String(w.seats)}
            onClick={()=>onAction({ action:"setSeats", workspaceId:w.id, seats:Number(seats) })}
            style={miniBtn}>Apply</button>
        </Row>

        <Row label="Extend trial">
          <select value={days} onChange={e=>setDays(e.target.value)} style={sel}>
            {["7","14","30","60","90"].map(d => <option key={d} value={d}>{d} days</option>)}
          </select>
          <button disabled={busy}
            onClick={()=>onAction({ action:"extendTrial", workspaceId:w.id, days:Number(days) })}
            style={miniBtn}>Extend</button>
        </Row>

        <div style={{ display:"flex", gap:6, marginTop:16, paddingTop:14, borderTop:"1px solid #F1F5F9" }}>
          <button disabled={busy} onClick={()=>onAction({ action:"endTrial", workspaceId:w.id })}
            style={miniBtn}>Clear trial</button>
          <button disabled={busy}
            onClick={()=>onAction({ action:"toggleWorkspace", workspaceId:w.id, isActive:false })}
            style={{ ...miniBtn, color:"#B91C1C", marginLeft:"auto" }}>Disable workspace</button>
        </div>

        <div style={{ marginTop:14, fontSize:10.5, color:"#94A3B8", lineHeight:1.5 }}>
          Billing is managed in Stripe. Changing the plan here sets entitlement only — it does not
          charge or refund anyone.
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
