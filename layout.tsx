"use client"
// src/components/settings/TeamSettingsView.tsx
import { useState } from "react"
import { Avatar, Badge } from "@/components/ui"

const ROLE_LABELS: Record<string,string> = {
  SYSTEM_ADMIN:"System Admin", ADMIN:"Admin", SUPER_USER:"Super User",
  PROGRAM_MANAGER:"Program Manager", PROJECT_MANAGER:"Project Manager",
  TEAM_MEMBER:"Team Member", READ_ONLY:"Read Only", CLIENT:"Client"
}
const ROLE_COLORS: Record<string,any> = {
  SYSTEM_ADMIN:"red", ADMIN:"blue", SUPER_USER:"purple",
  PROGRAM_MANAGER:"blue", PROJECT_MANAGER:"green",
  TEAM_MEMBER:"gray", READ_ONLY:"gray", CLIENT:"gray"
}
const ASSIGNABLE_ROLES = ["ADMIN","SUPER_USER","PROGRAM_MANAGER","PROJECT_MANAGER","TEAM_MEMBER","READ_ONLY","CLIENT"]

export function TeamSettingsView({ members, invitations, currentUserId, workspaceId, role }: {
  members:any[]; invitations:any[]; currentUserId:string; workspaceId:string; role:string
}) {
  const canManage = ["ADMIN","SYSTEM_ADMIN","SUPER_USER"].includes(role)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole,  setInviteRole]  = useState("TEAM_MEMBER")
  const [inviting, setInviting]       = useState(false)
  const [inviteMsg, setInviteMsg]     = useState("")
  const [search, setSearch]           = useState("")

  const filtered = members.filter(m =>
    m.user.name.toLowerCase().includes(search.toLowerCase()) ||
    m.user.email.toLowerCase().includes(search.toLowerCase())
  )

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteMsg("")
    try {
      const res = await fetch("/api/users", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ email:inviteEmail, role:inviteRole })
      })
      if (!res.ok) throw new Error((await res.json()).error || "Invite failed")
      setInviteMsg(`✓ Invitation sent to ${inviteEmail}`)
      setInviteEmail("")
    } catch(e:any) { setInviteMsg(`✗ ${e.message}`) }
    finally { setInviting(false) }
  }

  async function updateRole(userId:string, newRole:string) {
    await fetch(`/api/users/${userId}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ role:newRole })
    })
  }

  async function removeMember(userId:string) {
    if (!confirm("Remove this member from the workspace?")) return
    await fetch(`/api/users/${userId}`, { method:"DELETE" })
  }

  const card: React.CSSProperties = {
    background:"#fff", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", overflow:"hidden", marginBottom:16
  }

  return (
    <div style={{ maxWidth:760 }}>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:4 }}>Team members</h2>
        <p style={{ fontSize:13, color:"var(--text-3)" }}>
          {members.length} member{members.length!==1?"s":""} in this workspace.
        </p>
      </div>

      {/* Invite form */}
      {canManage && (
        <div style={{ ...card, padding:20, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:14 }}>
            Invite team member
          </div>
          <form onSubmit={invite}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:8, alignItems:"flex-end" }}>
              <div>
                <label style={{ display:"block", fontSize:12, color:"var(--text-3)", marginBottom:4 }}>
                  Email address
                </label>
                <input type="email" required placeholder="colleague@organization.com"
                  value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  style={{ width:"100%", padding:"9px 12px", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
                    color:"var(--text)", outline:"none" }} />
              </div>
              <div>
                <label style={{ display:"block", fontSize:12, color:"var(--text-3)", marginBottom:4 }}>
                  Role
                </label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  style={{ padding:"9px 28px 9px 10px", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
                    color:"var(--text)", appearance:"none" as const,
                    background:"url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%2394A3B8'/%3E%3C/svg%3E") right 8px center no-repeat #fff" }}>
                  {ASSIGNABLE_ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={inviting}
                style={{ padding:"9px 18px", background:"var(--steel)", color:"#fff", border:"none",
                  borderRadius:"var(--radius)", fontSize:13, fontWeight:500, cursor:"pointer",
                  fontFamily:"var(--font)", whiteSpace:"nowrap" }}>
                {inviting ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>
          {inviteMsg && (
            <div style={{ marginTop:10, fontSize:13,
              color:inviteMsg.startsWith("✓")?"var(--green)":"var(--red)" }}>
              {inviteMsg}
            </div>
          )}
        </div>
      )}

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div style={card}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)",
            fontSize:12, fontWeight:600, color:"var(--text-3)", textTransform:"uppercase",
            letterSpacing:".06em" }}>
            Pending invitations ({invitations.length})
          </div>
          {invitations.map(inv => (
            <div key={inv.id} style={{ display:"flex", alignItems:"center", gap:12,
              padding:"10px 16px", borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}>
              <div style={{ width:32, height:32, borderRadius:"50%", background:"var(--surface-1)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:12,
                color:"var(--text-3)", flexShrink:0 }}>
                ✉
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, color:"var(--text)" }}>{inv.email}</div>
                <div style={{ fontSize:11, color:"var(--text-3)" }}>
                  Invited · Expires {new Date(inv.expiresAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                </div>
              </div>
              <Badge variant="amber">{ROLE_LABELS[inv.role] || inv.role}</Badge>
              <span style={{ fontSize:11, color:"var(--text-3)" }}>Pending</span>
            </div>
          ))}
        </div>
      )}

      {/* Members list */}
      <div style={card}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>
            Members ({members.length})
          </span>
          <input placeholder="Search members…" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding:"5px 10px", border:"1px solid var(--border)", borderRadius:6,
              fontSize:12, fontFamily:"var(--font)", outline:"none", width:180 }} />
        </div>
        {filtered.map(m => (
          <div key={m.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 16px",
            borderBottom:"1px solid var(--surface-1,#F1F5F9)", transition:"background .1s" }}
            onMouseOver={e => (e.currentTarget.style.background="var(--surface)")}
            onMouseOut={e  => (e.currentTarget.style.background="transparent")}>
            <Avatar name={m.user.name} avatarUrl={m.user.avatarUrl} size={34} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:13, fontWeight:500, color:"var(--text)" }}>{m.user.name}</span>
                {m.userId === currentUserId && (
                  <span style={{ fontSize:10, fontWeight:600, padding:"1px 6px", borderRadius:4,
                    background:"var(--steel-pale,#EFF6FF)", color:"var(--steel)" }}>You</span>
                )}
              </div>
              <div style={{ fontSize:11, color:"var(--text-3)" }}>{m.user.email}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {canManage && m.userId !== currentUserId ? (
                <select value={m.role}
                  onChange={e => updateRole(m.userId, e.target.value)}
                  style={{ padding:"4px 22px 4px 8px", border:"1px solid var(--border)",
                    borderRadius:5, fontSize:12, fontFamily:"var(--font)",
                    color:"var(--text)", appearance:"none" as const,
                    background:"url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%2394A3B8'/%3E%3C/svg%3E") right 6px center no-repeat #fff" }}>
                  {ASSIGNABLE_ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              ) : (
                <Badge variant={ROLE_COLORS[m.role] || "gray"}>{ROLE_LABELS[m.role] || m.role}</Badge>
              )}
              {canManage && m.userId !== currentUserId && (
                <button onClick={() => removeMember(m.userId)}
                  style={{ padding:"4px 8px", background:"none", border:"1px solid var(--border)",
                    borderRadius:5, fontSize:11, color:"var(--text-3)", cursor:"pointer",
                    fontFamily:"var(--font)", transition:"all .15s" }}
                  onMouseOver={e => { e.currentTarget.style.borderColor="var(--red)"; e.currentTarget.style.color="var(--red)" }}
                  onMouseOut={e  => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text-3)" }}>
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding:"24px", textAlign:"center", fontSize:13, color:"var(--text-3)" }}>
            No members match your search
          </div>
        )}
      </div>
    </div>
  )
}
