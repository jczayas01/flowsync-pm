// src/components/auth/ResetPasswordForm.tsx
"use client"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export function ResetPasswordForm({ token }: { token?: string }) {
  const t = useTranslations("auth")
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm]   = useState("")
  const [loading, setLoading]   = useState(false)
  const [err, setErr]           = useState("")
  const [done, setDone]         = useState(false)

  const tooShort = password.length > 0 && password.length < 8
  const mismatch = confirm.length > 0 && password !== confirm
  const ready    = password.length >= 8 && password === confirm && !!token

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(d?.error || t("resetFailed")); setLoading(false); return }
      setDone(true)
      setTimeout(() => router.push("/auth/signin"), 2200)
    } catch {
      setErr(t("resetFailed"))
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div>
        <div style={errBox}>{t("resetLinkInvalid")}</div>
        <Link href="/auth/forgot-password" style={{ color:"var(--steel)", fontSize:13, fontWeight:600, textDecoration:"none" }}>
          {t("requestNewLink")} →
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ background:"rgba(5,150,105,.12)", border:"1px solid rgba(5,150,105,.4)",
        borderRadius:"var(--radius)", padding:"14px 16px" }}>
        <div style={{ fontSize:14, fontWeight:600, color:"#34D399", marginBottom:4 }}>
          ✓ {t("passwordUpdated")}
        </div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,.7)" }}>{t("redirectingToSignIn")}</div>
      </div>
    )
  }

  return (
    <div>
      {err && <div style={errBox}>{err}</div>}
      <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <input type="password" placeholder={t("newPassword")} required autoFocus value={password}
          onChange={e => setPassword(e.target.value)} style={inputStyle} />
        <input type="password" placeholder={t("confirmPassword")} required value={confirm}
          onChange={e => setConfirm(e.target.value)} style={inputStyle} />

        <div style={{ fontSize:11, color: tooShort ? "#F87171" : "rgba(255,255,255,.45)", minHeight:14 }}>
          {tooShort ? t("passwordTooShort") : mismatch ? "" : t("passwordHint")}
        </div>
        {mismatch && <div style={{ fontSize:11, color:"#F87171", marginTop:-8 }}>{t("passwordsDontMatch")}</div>}

        <button type="submit" disabled={loading || !ready} style={{ ...btnStyle, opacity: ready ? 1 : .5 }}>
          {loading ? t("updating") : t("updatePassword")}
        </button>
      </form>
      <div style={{ marginTop:18, textAlign:"center" }}>
        <Link href="/auth/signin" style={{ color:"rgba(255,255,255,.55)", fontSize:13, textDecoration:"none" }}>
          ← {t("backToSignIn")}
        </Link>
      </div>
    </div>
  )
}

const errBox: React.CSSProperties = {
  background:"rgba(220,38,38,.12)", border:"1px solid rgba(220,38,38,.4)",
  borderRadius:"var(--radius)", padding:"11px 14px", marginBottom:16,
  fontSize:13, color:"#FCA5A5", lineHeight:1.5,
}

const inputStyle: React.CSSProperties = {
  width:"100%", padding:"11px 14px", background:"rgba(255,255,255,.07)",
  border:"1.5px solid rgba(255,255,255,.12)", borderRadius:"var(--radius)",
  color:"#fff", fontSize:14, fontFamily:"var(--font)", outline:"none",
}

const btnStyle: React.CSSProperties = {
  width:"100%", padding:12, background:"var(--steel)", color:"#fff", border:"none",
  borderRadius:"var(--radius)", fontSize:14, fontWeight:600, cursor:"pointer",
  fontFamily:"var(--font)", marginTop:4,
}
