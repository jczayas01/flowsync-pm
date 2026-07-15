// src/components/auth/ForgotPasswordForm.tsx
"use client"
import { useTranslations } from "next-intl"
import { useState } from "react"
import Link from "next/link"

export function ForgotPasswordForm() {
  const t = useTranslations("auth")
  const [email, setEmail]     = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch("/api/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      })
    } catch { /* endpoint is intentionally silent — show the same result either way */ }
    setLoading(false)
    setSent(true)
  }

  if (sent) {
    return (
      <div>
        <div style={{ background:"rgba(5,150,105,.12)", border:"1px solid rgba(5,150,105,.4)",
          borderRadius:"var(--radius)", padding:"14px 16px", marginBottom:18 }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#34D399", marginBottom:4 }}>
            ✉️ {t("checkYourEmail")}
          </div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,.7)", lineHeight:1.55 }}>
            {t("resetLinkSent")}
          </div>
        </div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,.45)", lineHeight:1.6, marginBottom:18 }}>
          {t("resetLinkExpires")}
        </div>
        <Link href="/auth/signin" style={{ color:"var(--steel)", fontSize:13, fontWeight:600, textDecoration:"none" }}>
          ← {t("backToSignIn")}
        </Link>
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontSize:13, color:"rgba(255,255,255,.6)", lineHeight:1.6, marginBottom:18 }}>
        {t("forgotIntro")}
      </p>
      <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <input type="email" placeholder={t("workEmail")} required autoFocus value={email}
          onChange={e => setEmail(e.target.value)} style={inputStyle} />
        <button type="submit" disabled={loading || !email} style={btnStyle}>
          {loading ? t("sending") : t("sendResetLink")}
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
