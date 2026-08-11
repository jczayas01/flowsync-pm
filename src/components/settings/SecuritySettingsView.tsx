"use client"
// src/components/settings/SecuritySettingsView.tsx
import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui"

export function SecuritySettingsView({ userId, workspaceId, role, auditLogs }: {
  userId:string; workspaceId:string; role:string; auditLogs:any[]
}) {
  const ss = useTranslations("securitySettings")
  const [tab, setTab] = useState<"2fa"|"sessions"|"audit"|"ai">("2fa")
  const [ai, setAi] = useState<{ aiEnabled: boolean; logs: any[] } | null>(null)
  const [aiSaving, setAiSaving] = useState(false)
  useEffect(() => {
    if (tab !== "ai" || ai) return
    fetch("/api/workspace/ai-audit").then(r => r.json())
      .then(d => { if (d?.data) setAi(d.data) }).catch(() => {})
  }, [tab, ai])

  async function toggleAi(next: boolean) {
    if (aiSaving) return
    setAiSaving(true)
    try {
      const res = await fetch("/api/workspace", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiEnabled: next }),
      })
      if (res.ok) setAi(a => a ? { ...a, aiEnabled: next } : a)
    } finally { setAiSaving(false) }
  }
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
        {[["2fa","Two-factor auth"],["sessions","Active sessions"],["audit","Audit log"],["ai","AI governance"]].map(([id,label]) => (
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
              <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{ss("Active sessions")}</span>
              <button style={{ fontSize:12, color:"var(--red)", background:"none", border:"none",
                cursor:"pointer", fontFamily:"var(--font)", fontWeight:500 }}
                onClick={async () => {
                  if (!confirm(ss("Sign out all other sessions?"))) return
                  await fetch("/api/security/sessions?all=true", { method:"DELETE" })
                }}>
                {ss("Sign out all others")}
              </button>
            </div>
            <div style={{ padding:"20px 16px", fontSize:13, color:"var(--text-3)", textAlign:"center" }}>
              {ss("sessionMgmtHint")}
            </div>
          </div>
        </div>
      )}

      {tab === "ai" && (
        <div style={{ background:"#fff", border:"1px solid var(--border)",
          borderRadius:"var(--radius)", padding:24 }}>
          <div style={{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:6 }}>
            {ss("aiTitle")}
          </div>
          <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:16, lineHeight:1.6 }}>
            {ss("aiIntro")}
          </p>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:"14px 16px", marginBottom:20,
            display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:24 }}>{ai?.aiEnabled === false ? "⛔" : "🤖"}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500, color:"var(--text)", marginBottom:2 }}>
                {ai == null ? "…" : ai.aiEnabled ? ss("aiOn") : ss("aiOff")}
              </div>
              <div style={{ fontSize:12, color:"var(--text-3)" }}>{ss("aiEnforced")}</div>
            </div>
            {ai != null && ["ADMIN","SYSTEM_ADMIN"].includes(role) && (
              <button onClick={() => toggleAi(!ai.aiEnabled)} disabled={aiSaving}
                style={{ padding:"7px 14px", borderRadius:"var(--radius)", fontSize:12,
                  fontWeight:600, cursor:"pointer", fontFamily:"var(--font)",
                  border: ai.aiEnabled ? "1px solid #DC2626" : "1px solid var(--border)",
                  background: ai.aiEnabled ? "#fff" : "var(--steel)",
                  color: ai.aiEnabled ? "#DC2626" : "#fff" }}>
                {aiSaving ? "…" : ai.aiEnabled ? ss("aiDisableBtn") : ss("aiEnableBtn")}
              </button>
            )}
          </div>
          <div style={{ fontSize:12, fontWeight:700, color:"var(--text-2)", marginBottom:8 }}>
            {ss("aiLogTitle")}
          </div>
          {!ai?.logs?.length ? (
            <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{ss("aiLogEmpty")}</div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
              <thead><tr>
                {[ss("aiColWhen"), ss("aiColFeature"), ss("aiColUser"), ss("aiColResult")].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"6px 8px", fontSize:10.5,
                    textTransform:"uppercase", letterSpacing:".05em", color:"var(--text-3)",
                    borderBottom:"1px solid var(--border)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {ai.logs.map((l: any) => (
                  <tr key={l.id}>
                    <td style={{ padding:"6px 8px", borderBottom:"1px solid var(--border)",
                      whiteSpace:"nowrap", color:"var(--text-3)" }}>
                      {new Date(l.at).toLocaleString()}
                    </td>
                    <td style={{ padding:"6px 8px", borderBottom:"1px solid var(--border)" }}>
                      {l.feature}
                    </td>
                    <td style={{ padding:"6px 8px", borderBottom:"1px solid var(--border)" }}>
                      {l.by}
                    </td>
                    <td style={{ padding:"6px 8px", borderBottom:"1px solid var(--border)" }}>
                      <span style={{ fontSize:11, fontWeight:700,
                        color: l.action === "ai.blocked" ? "#DC2626" : "#059669" }}>
                        {l.action === "ai.blocked" ? ss("aiBlocked") : ss("aiAllowed")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "audit" && (
        <div style={{ background:"#fff", border:"1px solid var(--border)",
          borderRadius:"var(--radius)", overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)",
            display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>
              {ss("auditLogCount",{n:auditLogs.length})}
            </span>
            <span style={{ fontSize:11, color:"var(--text-3)" }}>{ss("Last 50 events")}</span>
          </div>
          {auditLogs.length === 0 ? (
            <div style={{ padding:"24px 16px", textAlign:"center",
              fontSize:12, color:"var(--text-3)" }}>
              {ss("No audit events recorded yet")}
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
