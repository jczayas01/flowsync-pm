"use client"
// src/components/settings/WorkspaceSettingsForm.tsx
import { useState } from "react"
import { isWorkspaceAdmin } from "@/lib/rbac/roles"
import { LogoUploader } from "./LogoUploader"

export function WorkspaceSettingsForm({ workspace, role }: { workspace: any; role: string }) {
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
      if (!res.ok) throw new Error((await res.json()).error || "Save failed")
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
  const CURRENCIES = [{ code:"USD", label:"USD — US Dollar" },{ code:"EUR", label:"EUR — Euro" },
    { code:"GBP", label:"GBP — British Pound" },{ code:"MXN", label:"MXN — Mexican Peso" }]

  return (
    <div style={{ maxWidth:680 }}>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:4 }}>Workspace settings</h2>
        <p style={{ fontSize:13, color:"var(--text-3)" }}>
          Manage your organization name, branding, and regional defaults.
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
          General
        </div>
        <div style={s.field}>
          <label style={s.label}>Organization name</label>
          <input style={s.input} value={form.name} disabled={!canEdit}
            onChange={e => setForm(f => ({ ...f, name:e.target.value }))} />
        </div>
        <div style={s.grid}>
          <div>
            <label style={s.label}>Timezone</label>
            <select style={{ ...s.input, appearance:"none" as const, cursor:"pointer" }}
              value={form.timezone} disabled={!canEdit}
              onChange={e => setForm(f => ({ ...f, timezone:e.target.value }))}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Currency</label>
            <select style={{ ...s.input, appearance:"none" as const, cursor:"pointer" }}
              value={form.currency} disabled={!canEdit}
              onChange={e => setForm(f => ({ ...f, currency:e.target.value }))}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Branding */}
      <div style={s.section}>
        <div style={{ fontSize:12, fontWeight:600, color:"var(--text-3)", letterSpacing:".06em",
          textTransform:"uppercase", marginBottom:16, paddingBottom:10, borderBottom:"1px solid var(--border)" }}>
          Branding
        </div>
        <div style={s.field}>
          <label style={s.label}>Logo URL</label>
          <input style={s.input} placeholder="https://your-org.com/logo.png"
            value={form.logoUrl} disabled={!canEdit}
            onChange={e => setForm(f => ({ ...f, logoUrl:e.target.value }))} />
          <LogoUploader disabled={!canEdit}
            onUploaded={url => setForm(f => ({ ...f, logoUrl: url }))} />
          <div style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>
            Used in reports and client-facing exports. Recommended: 200×50px PNG.
            Uploading stores the image and fills the URL for you — remember to Save.
          </div>
        </div>
        <div>
          <label style={s.label}>Brand color</label>
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
            Primary — headers and accents on generated reports and Present mode.
          </div>
          <label style={{ ...s.label, marginTop:12, display:"block" }}>Secondary color</label>
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
            Secondary — highlights (milestones, callouts) on the same outputs.
          </div>
        </div>
      </div>

      {/* Workspace info (readonly) */}
      <div style={s.section}>
        <div style={{ fontSize:12, fontWeight:600, color:"var(--text-3)", letterSpacing:".06em",
          textTransform:"uppercase", marginBottom:16, paddingBottom:10, borderBottom:"1px solid var(--border)" }}>
          Workspace info
        </div>
        <div style={s.grid}>
          {[
            ["Workspace ID",   workspace.id],
            ["Plan",           workspace.plan],
            ["Created",        new Date(workspace.createdAt).toLocaleDateString("en-US", {dateStyle:"long", timeZone:"UTC" })],
            ["Slug",           workspace.slug],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:3 }}>{k}</div>
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
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span style={{ fontSize:13, color:"var(--green)", display:"flex", alignItems:"center", gap:5 }}>
              ✓ Saved
            </span>
          )}
        </div>
      )}
      {!canEdit && (
        <div style={{ fontSize:13, color:"var(--text-3)", padding:"10px 14px",
          background:"var(--surface)", borderRadius:"var(--radius)", border:"1px solid var(--border)" }}>
          You need Admin role to edit workspace settings.
        </div>
      )}
    </div>
  )
}
