"use client"
// src/components/settings/SecuritySettingsView.tsx
import { useState } from "react"
import { Badge } from "@/components/ui"

export function SecuritySettingsView({ userId, workspaceId, role, auditLogs }: {
  userId:string; workspaceId:string; role:string; auditLogs:any[]
}) {
  const [tab, setTab] = useState<"2fa"|"sessions"|"audit">("2fa")
  const [twoFAStatus, setTwoFAStatus] = useState<{enabled:boolean}|null>(null)
  const [loading2FA, setLoading2FA] = useState(false)

  async function setup2FA() {
    setLoading2FA(true)
    const res = await fetch("/api/auth/2fa?action=setup", { method:"POST" })
    const d   = await res.json()
    setLoading2FA(false)
    if (d.qrCodeUrl) {
      window.open(d.qrCodeUrl, "_blank")
    }
  }

  const ACTION_ICONS: Record<string,string> = {
    "auth.login_success":"✅", "auth.login_failed":"❌",
    "user.invited":"📧", "user.role_changed":"🔄",
    "project.created":"📁", "project.updated":"✏",
    "billing.subscribed":"💳", "data.exported":"⬇",
  }

  return (
    <div style={{ maxWidth:760 }}>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:4 }}>
          Security
        </h2>
        <p style={{ fontSize:13, color:"var(--text-3)" }}>
          Manage two-factor authentication, active sessions, and audit logs.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, borderBottom:"1px solid var(--border)", marginBottom:20 }}>
        {[["2fa","Two-factor auth"],["sessions","Active sessions"],["audit","Audit log"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            style={{ padding:"9px 16px", border:"none", background:"none", cursor:"pointer",
              fontFamily:"var(--font)", fontSize:12, fontWeight:500,
              color:tab===id?"var(--steel)":"var(--text-3)",
              borderBottom:tab===id?"2px solid var(--steel)":"2px solid transparent",
              marginBottom:-1 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "2fa" && (
        <div style={{ background:"#fff", border:"1px solid var(--border)",
          borderRadius:"var(--radius)", padding:24 }}>
          <div style={{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:6 }}>
            Two-factor authentication
          </div>
          <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:20, lineHeight:1.6 }}>
            Add a second layer of security using an authenticator app like Google Authenticator or Authy.
            When enabled, you'll need to enter a 6-digit code in addition to your password.
          </p>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:"14px 16px", marginBottom:20,
            display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:24 }}>🔒</span>
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:"var(--text)", marginBottom:2 }}>
                2FA is not enabled
              </div>
              <div style={{ fontSize:12, color:"var(--text-3)" }}>
                Your account is protected by password only.
              </div>
            </div>
            <button onClick={setup2FA} disabled={loading2FA}
              style={{ marginLeft:"auto", padding:"8px 16px", background:"var(--steel)",
                color:"#fff", border:"none", borderRadius:"var(--radius)", fontSize:12,
                fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}>
              {loading2FA ? "Loading…" : "Enable 2FA"}
            </button>
          </div>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:10 }}>
            Backup codes
          </div>
          <p style={{ fontSize:12, color:"var(--text-3)", lineHeight:1.6 }}>
            Backup codes are generated when you set up 2FA. Store them in a safe place.
            Each code can be used once if you lose access to your authenticator app.
          </p>
        </div>
      )}

      {tab === "sessions" && (
        <div>
          <div style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)",
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>Active sessions</span>
              <button style={{ fontSize:12, color:"var(--red)", background:"none", border:"none",
                cursor:"pointer", fontFamily:"var(--font)", fontWeight:500 }}
                onClick={async () => {
                  if (!confirm("Sign out all other sessions?")) return
                  await fetch("/api/security/sessions?all=true", { method:"DELETE" })
                }}>
                Sign out all others
              </button>
            </div>
            <div style={{ padding:"20px 16px", fontSize:13, color:"var(--text-3)", textAlign:"center" }}>
              Session management is available via the API. Current session is active.
            </div>
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div style={{ background:"#fff", border:"1px solid var(--border)",
          borderRadius:"var(--radius)", overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)",
            display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>
              Audit log ({auditLogs.length} recent events)
            </span>
            <span style={{ fontSize:11, color:"var(--text-3)" }}>Last 50 events</span>
          </div>
          {auditLogs.length === 0 ? (
            <div style={{ padding:"24px 16px", textAlign:"center",
              fontSize:12, color:"var(--text-3)" }}>
              No audit events recorded yet
            </div>
          ) : (
            auditLogs.map(log => (
              <div key={log.id} style={{ display:"flex", alignItems:"center", gap:12,
                padding:"10px 16px", borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}>
                <span style={{ fontSize:16, flexShrink:0 }}>
                  {ACTION_ICONS[log.action] || "📋"}
                </span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:"var(--text)", marginBottom:1 }}>
                    {log.user?.name || "System"} — {log.action.replace(/\./g," · ").replace(/_/g," ")}
                  </div>
                  <div style={{ fontSize:11, color:"var(--text-3)" }}>
                    {log.entityType} {log.entityId?.slice(0,8)}
                    {log.ipAddress && ` · ${log.ipAddress}`}
                  </div>
                </div>
                <span style={{ fontSize:11, color:"var(--text-3)", flexShrink:0 }}>
                  {new Date(log.createdAt).toLocaleString("en-US",{
                    month:"short", day:"numeric",
                    hour:"2-digit", minute:"2-digit"
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
