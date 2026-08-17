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
  const [twoFAStatus, setTwoFAStatus] = useState<{enabled:boolean; backupCodesRemaining?:number}|null>(null)
  const [loading2FA, setLoading2FA] = useState(false)
  // Setup wizard: qr → confirm code → show backup codes once
  const [setup, setSetup] = useState<null | { qrCodeUrl:string; secret:string; backupCodes:string[] }>(null)
  const [code, setCode] = useState("")
  const [twoFAErr, setTwoFAErr] = useState("")
  const [showBackup, setShowBackup] = useState<string[]|null>(null)
  const [disableCode, setDisableCode] = useState("")
  const [disabling, setDisabling] = useState(false)

  useEffect(() => {
    fetch("/api/auth/2fa").then(r => r.json())
      .then(d => setTwoFAStatus({ enabled: !!d?.enabled, backupCodesRemaining: d?.backupCodesRemaining }))
      .catch(() => setTwoFAStatus({ enabled: false }))
  }, [])

  async function setup2FA() {
    setLoading2FA(true); setTwoFAErr("")
    try {
      const res = await fetch("/api/auth/2fa?action=setup", { method:"POST" })
      const d   = await res.json()
      if (!res.ok || !d.qrCodeUrl) { setTwoFAErr(d?.error || ss("twoFaSetupFailed")); return }
      setSetup({ qrCodeUrl: d.qrCodeUrl, secret: d.secret, backupCodes: d.backupCodes || [] })
      setCode("")
    } finally { setLoading2FA(false) }
  }

  async function confirm2FA() {
    if (!setup || code.replace(/\s/g, "").length < 6) return
    setLoading2FA(true); setTwoFAErr("")
    try {
      const res = await fetch("/api/auth/2fa?action=confirm", { method:"POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: code }) })
      const d = await res.json()
      if (!res.ok || !d.success) { setTwoFAErr(d?.error || ss("twoFaBadCode")); return }
      setShowBackup(setup.backupCodes)
      setSetup(null); setCode("")
      setTwoFAStatus({ enabled: true, backupCodesRemaining: setup.backupCodes.length })
    } finally { setLoading2FA(false) }
  }

  async function disable2FA() {
    if (disableCode.replace(/\s/g, "").length < 6) return
    setDisabling(true); setTwoFAErr("")
    try {
      const res = await fetch("/api/auth/2fa?action=disable", { method:"POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: disableCode }) })
      const d = await res.json()
      if (!res.ok || d?.success === false) { setTwoFAErr(d?.error || ss("twoFaBadCode")); return }
      setTwoFAStatus({ enabled: false, backupCodesRemaining: 0 }); setDisableCode("")
    } finally { setDisabling(false) }
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
          {twoFAErr && <div style={{ fontSize:12, color:"var(--red,#DC2626)", marginBottom:10 }}>{twoFAErr}</div>}

          {/* Status row */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:"14px 16px", marginBottom:20,
            display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <span style={{ fontSize:24 }}>{twoFAStatus?.enabled ? "🔐" : "🔒"}</span>
            <div style={{ flex:1, minWidth:180 }}>
              <div style={{ fontSize:13, fontWeight:500, color:"var(--text)", marginBottom:2 }}>
                {twoFAStatus == null ? "…" : twoFAStatus.enabled ? ss("twoFaOn") : ss("twoFaOff")}
              </div>
              <div style={{ fontSize:12, color:"var(--text-3)" }}>
                {twoFAStatus?.enabled
                  ? ss("twoFaBackupLeft", { n: twoFAStatus.backupCodesRemaining ?? 0 })
                  : ss("twoFaPasswordOnly")}
              </div>
            </div>
            {twoFAStatus && !twoFAStatus.enabled && !setup && (
              <button onClick={setup2FA} disabled={loading2FA}
                style={{ padding:"8px 16px", background:"var(--steel)", color:"#fff", border:"none",
                  borderRadius:"var(--radius)", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}>
                {loading2FA ? "…" : ss("twoFaEnable")}
              </button>
            )}
            {twoFAStatus?.enabled && (
              <span style={{ display:"flex", gap:6, alignItems:"center" }}>
                <input value={disableCode} onChange={e => setDisableCode(e.target.value)} placeholder="000000"
                  inputMode="numeric" maxLength={8}
                  style={{ width:96, padding:"7px 10px", border:"1px solid var(--border)", borderRadius:6,
                    fontSize:13, fontFamily:"var(--mono, monospace)", letterSpacing:".12em", textAlign:"center" }} />
                <button onClick={disable2FA} disabled={disabling || disableCode.replace(/\s/g,"").length < 6}
                  style={{ padding:"7px 12px", background:"#fff", color:"var(--red,#DC2626)",
                    border:"1px solid var(--red,#DC2626)", borderRadius:"var(--radius)", fontSize:12,
                    fontWeight:600, cursor:"pointer", fontFamily:"var(--font)" }}>
                  {disabling ? "…" : ss("twoFaDisable")}
                </button>
              </span>
            )}
          </div>

          {/* Setup wizard */}
          {setup && (
            <div style={{ border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:16,
              marginBottom:20, display:"grid", gridTemplateColumns:"auto 1fr", gap:18, alignItems:"start" }}>
              <img src={setup.qrCodeUrl} alt="QR" width={200} height={200}
                style={{ border:"1px solid var(--border)", borderRadius:8, background:"#fff" }} />
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:6 }}>{ss("twoFaStep1")}</div>
                <div style={{ fontSize:12, color:"var(--text-3)", marginBottom:10, lineHeight:1.6 }}>{ss("twoFaStep1Help")}</div>
                <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:12 }}>
                  {ss("twoFaManual")}: <code style={{ fontSize:12, background:"var(--surface)", padding:"2px 6px",
                    borderRadius:4, letterSpacing:".08em" }}>{setup.secret}</code>
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:6 }}>{ss("twoFaStep2")}</div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <input value={code} onChange={e => setCode(e.target.value)} placeholder="000000" autoFocus
                    inputMode="numeric" maxLength={8}
                    onKeyDown={e => { if (e.key === "Enter") confirm2FA() }}
                    style={{ width:130, padding:"9px 12px", border:"1px solid var(--border)", borderRadius:6,
                      fontSize:16, fontFamily:"var(--mono, monospace)", letterSpacing:".2em", textAlign:"center" }} />
                  <button onClick={confirm2FA} disabled={loading2FA || code.replace(/\s/g,"").length < 6}
                    style={{ padding:"9px 16px", background:"var(--steel)", color:"#fff", border:"none",
                      borderRadius:"var(--radius)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"var(--font)" }}>
                    {loading2FA ? "…" : ss("twoFaConfirm")}
                  </button>
                  <button onClick={() => { setSetup(null); setCode("") }}
                    style={{ padding:"9px 12px", background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", fontSize:12, cursor:"pointer", fontFamily:"var(--font)", color:"var(--text-2)" }}>
                    {ss("twoFaCancel")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Backup codes — shown ONCE after confirm */}
          {showBackup && (
            <div style={{ border:"1px solid #F59E0B", background:"#FFFBEB", borderRadius:"var(--radius)",
              padding:16, marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#92400E", marginBottom:6 }}>{ss("twoFaBackupTitle")}</div>
              <div style={{ fontSize:12, color:"#92400E", marginBottom:10, lineHeight:1.6 }}>{ss("twoFaBackupHelp")}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8, marginBottom:10 }}>
                {showBackup.map(c => (
                  <code key={c} style={{ fontSize:13, background:"#fff", border:"1px solid #FCD34D", borderRadius:6,
                    padding:"6px 8px", textAlign:"center", letterSpacing:".08em" }}>{c}</code>
                ))}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => navigator.clipboard?.writeText(showBackup.join("\n"))}
                  style={{ padding:"6px 12px", background:"#fff", border:"1px solid #F59E0B", borderRadius:6,
                    fontSize:12, cursor:"pointer", fontFamily:"var(--font)", color:"#92400E", fontWeight:600 }}>
                  {ss("twoFaCopy")}
                </button>
                <button onClick={() => setShowBackup(null)}
                  style={{ padding:"6px 12px", background:"#F59E0B", border:"none", borderRadius:6,
                    fontSize:12, cursor:"pointer", fontFamily:"var(--font)", color:"#fff", fontWeight:600 }}>
                  {ss("twoFaSaved")}
                </button>
              </div>
            </div>
          )}

          <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:10 }}>
            {ss("twoFaBackupSection")}
          </div>
          <p style={{ fontSize:12, color:"var(--text-3)", lineHeight:1.6 }}>
            {ss("twoFaBackupSectionHelp")}
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
