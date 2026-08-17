"use client"
// src/components/settings/CustomDomainCard.tsx
// Real custom-domain flow: save hostname → customer adds CNAME → "Verify DNS"
// does an actual lookup → on success the domain is registered on Vercel (SSL
// automatic) and requests on that host route to this workspace.

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

type State = { domain: string | null; status: string | null; verifiedAt: string | null;
  error: string | null; appHost: string }

export function CustomDomainCard({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("customDomain")
  const [st, setSt] = useState<State | null>(null)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState<"" | "save" | "verify" | "remove">("")
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "warn"; text: string } | null>(null)

  const load = () => fetch("/api/workspace/domain").then(r => r.json())
    .then(d => { setSt(d?.data || null); setDraft(d?.data?.domain || "") }).catch(() => {})
  useEffect(() => { load() }, [])

  async function save() {
    setBusy("save"); setMsg(null)
    try {
      const r = await fetch("/api/workspace/domain", { method: "PUT",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: draft }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ kind: "err", text: d?.error || t("errSave") }); return }
      setSt(d.data); setMsg({ kind: "ok", text: t("saved") })
    } finally { setBusy("") }
  }
  async function verify() {
    setBusy("verify"); setMsg(null)
    try {
      const r = await fetch("/api/workspace/domain?action=verify", { method: "POST" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ kind: "err", text: d?.error || t("errVerify") }); await load(); return }
      setSt(d.data)
      if (d.data?.status === "ACTIVE") setMsg({ kind: "ok", text: t("active") })
      else setMsg({ kind: "warn", text: d.data?.error || t("pending") })
    } finally { setBusy("") }
  }
  async function remove() {
    if (!confirm(t("removeConfirm"))) return
    setBusy("remove"); setMsg(null)
    try {
      const r = await fetch("/api/workspace/domain", { method: "DELETE" })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setSt(d.data); setDraft(""); setMsg({ kind: "ok", text: t("removed") }) }
    } finally { setBusy("") }
  }

  const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: 20, marginBottom: 16 }
  const inp: React.CSSProperties = { padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    fontSize: 13, fontFamily: "var(--font)", background: "#fff", color: "var(--text)" }
  const btn = (primary?: boolean): React.CSSProperties => ({ padding: "9px 14px", fontSize: 12, fontWeight: 600,
    borderRadius: "var(--radius)", cursor: "pointer", fontFamily: "var(--font)", whiteSpace: "nowrap",
    background: primary ? "var(--steel)" : "var(--surface)", color: primary ? "#fff" : "var(--text-2)",
    border: primary ? "none" : "1px solid var(--border)" })
  const status = st?.status
  const chip = status === "ACTIVE" ? { c: "var(--green,#059669)", bg: "#ECFDF5", l: t("stActive") }
    : status === "ERROR" ? { c: "#DC2626", bg: "#FEF2F2", l: t("stError") }
    : status ? { c: "#B45309", bg: "#FFFBEB", l: t("stPending") } : null
  const appHost = st?.appHost || "app.flowsyncpm.com"
  const dirty = draft.trim().toLowerCase() !== (st?.domain || "")

  return (
    <div style={card}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase",
        letterSpacing: ".06em", marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 10 }}>
        {t("title")}
        {chip && <span style={{ fontSize: 10.5, fontWeight: 700, color: chip.c, background: chip.bg,
          padding: "2px 8px", borderRadius: 10, textTransform: "none", letterSpacing: 0 }}>{chip.l}</span>}
        {st?.verifiedAt && status === "ACTIVE" && <span style={{ fontSize: 10.5, color: "var(--text-3)", textTransform: "none", letterSpacing: 0 }}>
          {t("since", { d: new Date(st.verifiedAt).toLocaleDateString() })}</span>}
      </div>

      <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 5 }}>{t("domainLabel")}</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={draft} disabled={!canEdit || busy !== ""} placeholder="pm.yourcompany.com"
          onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && dirty) save() }}
          style={{ ...inp, flex: 1, minWidth: 220 }} />
        {dirty || !st?.domain ? (
          <button onClick={save} disabled={!canEdit || !draft.trim() || busy !== ""} style={btn(true)}>
            {busy === "save" ? "…" : t("save")}</button>
        ) : (<>
          <button onClick={verify} disabled={!canEdit || busy !== ""} style={btn(status !== "ACTIVE")}>
            {busy === "verify" ? t("checking") : status === "ACTIVE" ? t("recheck") : t("verify")}</button>
          <button onClick={remove} disabled={!canEdit || busy !== ""} style={{ ...btn(), color: "#DC2626" }}>
            {busy === "remove" ? "…" : t("remove")}</button>
        </>)}
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600,
        color: msg.kind === "ok" ? "var(--green,#059669)" : msg.kind === "warn" ? "#B45309" : "#DC2626" }}>{msg.text}</div>}
      {!msg && st?.error && status !== "ACTIVE" && <div style={{ marginTop: 8, fontSize: 12, color: "#B45309" }}>{st.error}</div>}

      <div style={{ background: "var(--surface)", borderRadius: 8, padding: "12px 14px", fontSize: 12,
        color: "var(--text-3)", lineHeight: 1.8, marginTop: 14 }}>
        <strong style={{ color: "var(--text-2)" }}>{t("stepsTitle")}</strong><br />
        1. {t("step1a")} <code style={{ background: "#fff", padding: "1px 6px", borderRadius: 3, color: "var(--text)" }}>CNAME</code>{" "}
        <code style={{ background: "#fff", padding: "1px 6px", borderRadius: 3, color: "var(--text)" }}>{st?.domain || "pm.yourcompany.com"}</code>
        {" → "}<code style={{ background: "#fff", padding: "1px 6px", borderRadius: 3, color: "var(--text)" }}>{appHost}</code><br />
        2. {t("step2")}<br />
        3. {t("step3")}<br />
        <span style={{ color: "var(--text-3)" }}>{t("note")}</span>
      </div>
      {!canEdit && <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text-3)" }}>{t("planNote")}</div>}
    </div>
  )
}
