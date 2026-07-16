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
  const [q, setQ]       = useState("")

  const term = q.toLowerCase().trim()
  const ws = useMemo(() => !term ? workspaces
    : workspaces.filter(w => `${w.name} ${w.slug} ${w.plan}`.toLowerCase().includes(term)), [workspaces, term])
  const us = useMemo(() => !term ? users
    : users.filter(u => `${u.name} ${u.email}`.toLowerCase().includes(term)), [users, term])
  const lds = useMemo(() => !term ? demoRequests
    : demoRequests.filter(d => `${d.name} ${d.email} ${d.company}`.toLowerCase().includes(term)), [demoRequests, term])

  const counts: Record<Tab, number> = { workspaces: ws.length, users: us.length, leads: lds.length }

  return (
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

      <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          {tab === "workspaces" && <WorkspaceTable rows={ws} />}
          {tab === "users"      && <UserTable rows={us} />}
          {tab === "leads"      && <LeadTable rows={lds} />}
        </div>
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

function WorkspaceTable({ rows }: { rows:any[] }) {
  if (!rows.length) return <Empty text="No workspaces yet." />
  const now = Date.now()
  return (
    <table style={{ width:"100%", borderCollapse:"collapse", minWidth:820 }}>
      <thead><tr>
        {["Workspace","Plan","Members","Projects","Seats","Trial","Billing","Created"].map(h =>
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
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function UserTable({ rows }: { rows:any[] }) {
  if (!rows.length) return <Empty text="No users found." />
  return (
    <table style={{ width:"100%", borderCollapse:"collapse", minWidth:860 }}>
      <thead><tr>
        {["User","Workspace","Role","Sign-in","Status","Last active","Joined"].map(h =>
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
