"use client"
// EN | ES language switcher — sets the fs_locale cookie and refreshes server components
import { useLocale } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function setLocale(l: "en" | "es") {
    if (l === locale || busy) return
    setBusy(true)
    try {
      await fetch("/api/locale", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: l }),
      })
      router.refresh()
    } finally { setBusy(false) }
  }

  const pill = (l: "en" | "es", label: string) => (
    <button key={l} onClick={() => setLocale(l)} disabled={busy}
      style={{ padding: compact ? "3px 8px" : "4px 10px", fontSize: 11, fontWeight: 700,
        border: "none", cursor: "pointer", fontFamily: "var(--font)",
        background: locale === l ? "rgba(255,255,255,.18)" : "transparent",
        color: locale === l ? "#fff" : "rgba(255,255,255,.5)",
        borderRadius: 5, letterSpacing: ".04em" }}>
      {label}
    </button>
  )

  return (
    <div style={{ display: "inline-flex", gap: 2, padding: 2,
      background: "rgba(255,255,255,.06)", borderRadius: 7 }}>
      {pill("en", "EN")}{pill("es", "ES")}
    </div>
  )
}
