"use client"
// src/components/settings/WorkspaceSettingsForm.tsx
import { useState } from "react"
import { useTranslations } from "next-intl"
import { dateLocale } from "@/lib/date-locale"
import { isWorkspaceAdmin } from "@/lib/rbac/roles"
import { LogoUploader } from "./LogoUploader"

export function WorkspaceSettingsForm({ workspace, role }: { workspace: any; role: string }) {
  const ws_ = useTranslations("workspaceSettings")
  const canEdit = isWorkspaceAdmin(role)
  const [form, setForm] = useState({
    name:         workspace.name         || "",
    timezone:     workspace.defaultTimezone || "UTC",
    currency:     workspace.defaultCurrency || "USD",
    primaryColor: workspace.primaryColor || "#1B6CA8",
    secondaryColor: (workspace as any).secondaryColor || "#F59E0B",
    logoUrl:      workspace.logoUrl      || "",
  })
  const [saving, setSaving]   = useState(false)
  const [saved,  setSaved]    = useState(false)
  const [error,  setError]    = useState("")

  async function save() {
    setSaving(true); setSaved(false); setError("")
    try {
      const res = await fetch("/api/workspace", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:         form.name,
          timezone:     form.timezone,
          currency:     form.currency,
          primaryColor: form.primaryColor,
          secondaryColor: form.secondaryColor,
          logoUrl:      form.logoUrl || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || ws_("Save failed"))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const s = {
    section: { background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:24, marginBottom:16 } as React.CSSProperties,
    label:   { display:"block", fontSize:12, fontWeight:500, color:"var(--text-2)", marginBottom:5 } as React.CSSProperties,
    input:   { width:"100%", padding:"9px 12px", border:"1px solid var(--border)", borderRadius:"var(--radius)",
               fontSize:14, fontFamily:"var(--font)", color:"var(--text)", outline:"none",
               background: canEdit ? "#fff" : "var(--surface)" } as React.CSSProperties,
    grid:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 } as React.CSSProperties,
    field:   { marginBottom:14 } as React.CSSProperties,
  }

  const TIMEZONES = ["America/Puerto_Rico","America/New_York","America/Chicago","America/Denver",
    "America/Los_Angeles","Europe/London","Europe/Madrid","UTC"]
  const CURRENCIES = ["USD","EUR","GBP","MXN"]

  return (
    <div style={{ maxWidth:680 }}>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:4 }}>{ws_("Workspace settings")}</h2>
        <p style={{ fontSize:13, color:"var(--text-3)" }}>
          {ws_("headerDesc")}
        </p>
      </div>

      {error && (
        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"var(--red)",
          padding:"10px 14px", borderRadius:"var(--radius)", fontSize:13, marginBottom:16 }}>
          {error}
        </div>
      )}

      {/* General */}
      <div style={s.section}>
        <div style={{ fontSize:12, fontWeight:600, color:"var(--text-3)", letterSpacing:".06em",
          textTransform:"uppercase", marginBottom:16, paddingBottom:10, borderBottom:"1px solid var(--border)" }}>
          {ws_("General")}
        </div>
        <div style={s.field}>
          <label style={s.label}>{ws_("Organization name")}</label>
          <input style={s.input} value={form.name} disabled={!canEdit}
            onChange={e => setForm(f => ({ ...f, name:e.target.value }))} />
        </div>
        <div style={s.grid}>
          <div>
            <label style={s.label}>{ws_("Timezone")}</label>
            <select style={{ ...s.input, appearance:"none" as const, cursor:"pointer" }}
              value={form.timezone} disabled={!canEdit}
              onChange={e => setForm(f => ({ ...f, timezone:e.target.value }))}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>{ws_("Currency")}</label>
            <select style={{ ...s.input, appearance:"none" as const, cursor:"pointer" }}
              value={form.currency} disabled={!canEdit}
              onChange={e => setForm(f => ({ ...f, currency:e.target.value }))}>
              {CURRENCIES.map(c => <option key={c} value={c}>{ws_(("cur_"+c) as any)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Branding */}
      <div style={s.section}>
        <div style={{ fontSize:12, fontWeight:600, color:"var(--text-3)", letterSpacing:".06em",
          textTransform:"uppercase", marginBottom:16, paddingBottom:10, borderBottom:"1px solid var(--border)" }}>
          {ws_("Branding")}
        </div>
        <div style={s.field}>
          <label style={s.label}>{ws_("Logo URL")}</label>
          <input style={s.input} placeholder="https://your-org.com/logo.png"
            value={form.logoUrl} disabled={!canEdit}
            onChange={e => setForm(f => ({ ...f, logoUrl:e.target.value }))} />
          <LogoUploader disabled={!canEdit}
            onUploaded={url => setForm(f => ({ ...f, logoUrl: url }))} />
          <div style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>
            {ws_("logoHint")}
          </div>
        </div>
        <div>
          <label style={s.label}>{ws_("Brand color")}</label>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <input type="color" value={form.primaryColor} disabled={!canEdit}
              onChange={e => setForm(f => ({ ...f, primaryColor:e.target.value }))}
              style={{ width:40, height:36, border:"1px solid var(--border)", borderRadius:6,
                cursor:canEdit?"pointer":"default", padding:2 }} />
            <input style={{ ...s.input, flex:1, fontFamily:"monospace" }}
              value={form.primaryColor} disabled={!canEdit} maxLength={7}
              onChange={e => /^#[0-9A-Fa-f]{0,6}$/.test(e.target.value) &&
                setForm(f => ({ ...f, primaryColor:e.target.value }))} />
            <div style={{ width:36, height:36, borderRadius:6, background:form.primaryColor,
              border:"1px solid var(--border)", flexShrink:0 }} />
          </div>
          <div style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>
            {ws_("primaryHint")}
          </div>
          <label style={{ ...s.label, marginTop:12, display:"block" }}>{ws_("Secondary color")}</label>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <input type="color" value={form.secondaryColor} disabled={!canEdit}
              onChange={e => setForm(f => ({ ...f, secondaryColor:e.target.value }))}
              style={{ width:40, height:36, border:"1px solid var(--border)", borderRadius:6,
                cursor:canEdit?"pointer":"default", padding:2 }} />
            <input style={{ ...s.input, flex:1, fontFamily:"monospace" }}
              value={form.secondaryColor} disabled={!canEdit} maxLength={7}
              onChange={e => /^#[0-9A-Fa-f]{0,6}$/.test(e.target.value) &&
                setForm(f => ({ ...f, secondaryColor:e.target.value }))} />
            <div style={{ width:36, height:36, borderRadius:6, background:form.secondaryColor,
              border:"1px solid var(--border)", flexShrink:0 }} />
          </div>
          <div style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>
            {ws_("secondaryHint")}
          </div>
        </div>
      </div>

      {/* Workspace info (readonly) */}
      <div style={s.section}>
        <div style={{ fontSize:12, fontWeight:600, color:"var(--text-3)", letterSpacing:".06em",
          textTransform:"uppercase", marginBottom:16, paddingBottom:10, borderBottom:"1px solid var(--border)" }}>
          {ws_("Workspace info")}
        </div>
        <div style={s.grid}>
          {[
            ["Workspace ID",   workspace.id],
            ["Plan",           workspace.plan],
            ["Created",        new Date(workspace.createdAt).toLocaleDateString(dateLocale(), {dateStyle:"long", timeZone:"UTC" })],
            ["Slug",           workspace.slug],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:3 }}>{ws_(k as any)}</div>
              <div style={{ fontSize:13, fontFamily:k==="Workspace ID"||k==="Slug"?"monospace":"inherit",
                color:"var(--text-2)", background:"var(--surface)", padding:"8px 10px",
                borderRadius:6, border:"1px solid var(--border)" }}>
                {v}
              </div>
            </div>
          ))}
        </div>
      </div>

      {canEdit && (
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={save} disabled={saving}
            style={{ padding:"10px 22px", background:"var(--steel)", color:"#fff", border:"none",
              borderRadius:"var(--radius)", fontSize:14, fontWeight:500, cursor:saving?"wait":"pointer",
              fontFamily:"var(--font)", opacity:saving?0.7:1 }}>
            {saving ? ws_("Saving…") : ws_("Save changes")}
          </button>
          {saved && (
            <span style={{ fontSize:13, color:"var(--green)", display:"flex", alignItems:"center", gap:5 }}>
              {ws_("✓ Saved")}
            </span>
          )}
        </div>
      )}
      {!canEdit && (
        <div style={{ fontSize:13, color:"var(--text-3)", padding:"10px 14px",
          background:"var(--surface)", borderRadius:"var(--radius)", border:"1px solid var(--border)" }}>
          {ws_("noPermission")}
        </div>
      )}
    </div>
  )
}
