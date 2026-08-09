"use client"
// src/components/settings/IntegrationsView.tsx
import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { M365SmartInbox } from "./M365SmartInbox"
import { useSearchParams, useRouter } from "next/navigation"

const NAVY = "#0D1B2A", STEEL = "#1B6CA8", GREEN = "#059669", SLATE = "#64748B", RED = "#DC2626"
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

// What each scope actually buys the user, in their words â€” not Microsoft's.
const CAPABILITIES = [
  { scope:"Mail.Read",           icon:"ðŸ“§", label:"capMailLabel",
    desc:"capMailDesc" },
  { scope:"Calendars.Read",      icon:"ðŸ“…", label:"capMeetingsLabel",
    desc:"capMeetingsDesc" },
  { scope:"OnlineMeetings.Read", icon:"ðŸ’¬", label:"capTeamsLabel",
    desc:"capTeamsDesc" },
  { scope:"Tasks.ReadWrite",     icon:"âœ…", label:"capPlannerLabel",
    desc:"capPlannerDesc" },
]

const STATUS_MESSAGES: Record<string, { text:string; ok:boolean }> = {
  connected:      { text:"m365Connected", ok:true },
  denied:         { text:"m365Denied", ok:false },
  state_mismatch: { text:"m365StateMismatch", ok:false },
  exchange_failed:{ text:"m365ExchangeFailed", ok:false },
  misconfigured:  { text:"m365Misconfigured", ok:false },
  error:          { text:"m365Error", ok:false },
}

export function IntegrationsView({
  connected, signedInWithMicrosoft, hasRefresh, scopes, expiresAt, canManage,
}: {
  connected: boolean; signedInWithMicrosoft: boolean; hasRefresh: boolean
  scopes: string[]; expiresAt: string | null; canManage: boolean
}) {
  const iv = useTranslations("integrations")
  const params = useSearchParams()
  const router = useRouter()
  const [msg, setMsg] = useState<{ text:string; ok:boolean } | null>(null)

  useEffect(() => {
    const s = params.get("m365")
    if (s && STATUS_MESSAGES[s]) setMsg({...STATUS_MESSAGES[s], text: iv(STATUS_MESSAGES[s].text as any)})
  }, [params])

  const has = (s: string) => scopes.some(g => g.toLowerCase() === s.toLowerCase())

  return (
    <div style={{ padding:"20px 16px", maxWidth:840, margin:"0 auto", fontFamily:"var(--font)" }}>
      <h1 style={{ fontSize:19, fontWeight:700, color:NAVY, marginBottom:4 }}>{iv("Integrations")}</h1>
      <p style={{ fontSize:12.5, color:SLATE, marginBottom:18 }}>
        {iv("subtitle")}
      </p>

      {msg && (
        <div style={{ marginBottom:14, padding:"10px 13px", borderRadius:8, fontSize:12.5,
          background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? GREEN : "#B91C1C",
          border:`1px solid ${msg.ok ? "#BBF7D0" : "#FECACA"}` }}>
          {msg.text}
        </div>
      )}

      {/* â”€â”€ Microsoft 365 â”€â”€ */}
      <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:12, overflow:"hidden" }}>
        <div style={{ padding:"18px 20px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", gap:13 }}>
          <div style={{ width:40, height:40, borderRadius:9, background:"#EFF6FF",
            display:"grid", placeItems:"center", fontSize:20, flexShrink:0 }}>ðŸªŸ</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:700, color:NAVY }}>{iv("Microsoft 365")}</div>
            <div style={{ fontSize:12, color:SLATE, marginTop:2 }}>
              {iv("m365Subtitle")}
            </div>
          </div>
          <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:5,
            fontFamily:MONO, whiteSpace:"nowrap", flexShrink:0,
            background: connected ? "#ECFDF5" : "#F1F5F9",
            color: connected ? GREEN : SLATE }}>
            {connected ? iv("CONNECTED") : iv("NOT CONNECTED")}
          </span>
        </div>

        <div style={{ padding:"16px 20px" }}>
          {/* Signed in with Microsoft but never granted M365 access â€” the common case,
              and the one most likely to confuse someone. Name it explicitly. */}
          {!connected && signedInWithMicrosoft && (
            <div style={{ padding:"10px 13px", background:"#FFFBEB", border:"1px solid #FDE68A",
              borderRadius:8, fontSize:12.5, color:"#92400E", lineHeight:1.6, marginBottom:14 }}>
              {iv("signedInHint")}
            </div>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:16 }}>
            {CAPABILITIES.map(c => {
              const on = connected && has(c.scope)
              return (
                <div key={c.scope} style={{ display:"flex", gap:11, alignItems:"flex-start",
                  padding:"11px 13px", borderRadius:9, border:"1px solid var(--border)",
                  borderLeft:`3px solid ${on ? GREEN : "var(--border)"}`,
                  opacity: on || !connected ? 1 : .55 }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>{c.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                      <span style={{ fontSize:13, fontWeight:600, color:NAVY }}>{iv(c.label as any)}</span>
                      <span style={{ fontFamily:MONO, fontSize:9.5, color:SLATE,
                        background:"var(--surface-2,#F1F5F9)", padding:"1px 5px", borderRadius:3 }}>
                        {c.scope}
                      </span>
                      {on && <span style={{ fontSize:11, color:GREEN, fontWeight:700 }}>âœ“</span>}
                    </div>
                    <div style={{ fontSize:12, color:SLATE, lineHeight:1.55, marginTop:3 }}>{iv(c.desc as any)}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {connected ? (
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <a href="/api/m365/authorize"
                style={{ padding:"9px 16px", background:"#fff", color:"var(--text-2)",
                  border:"1px solid var(--border)", borderRadius:8, fontSize:12.5,
                  fontWeight:600, textDecoration:"none" }}>
                {iv("Reconnect")}
              </a>
              <div style={{ fontSize:11.5, color:SLATE }}>
                {hasRefresh
                  ? iv("renewsAuto")
                  : iv("noRefreshToken")}
                {expiresAt && (
                  <> Â· {iv("tokenValidUntil")}{" "}
                    <span style={{ fontFamily:MONO }}>
                      {new Date(expiresAt).toLocaleString("en-US",{ month:"short", day:"numeric", hour:"numeric", minute:"2-digit" })}
                    </span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <a href="/api/m365/authorize"
              style={{ display:"inline-block", padding:"11px 20px", background:STEEL, color:"#fff",
                borderRadius:8, fontSize:13, fontWeight:600, textDecoration:"none" }}>
              {iv("Connect Microsoft 365")}
            </a>
          )}

          <div style={{ marginTop:14, fontSize:11, color:"var(--text-3)", lineHeight:1.6 }}>
            {iv("consentHint")}
          </div>
        </div>
      </div>

      <M365SmartInbox connected={connected} />

      {!canManage && (
        <div style={{ marginTop:12, fontSize:11.5, color:SLATE }}>
          Connecting affects only your own account. Workspace-wide integration settings need an admin.
        </div>
      )}
    </div>
  )
}
