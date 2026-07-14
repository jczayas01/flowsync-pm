"use client"
// src/components/layout/LocaleSwitcher.tsx — EN/ES toggle (cookie + refresh)
import { useLocale } from "next-intl"
import { useRouter } from "next/navigation"

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()

  const set = (l: "en" | "es") => {
    if (l === locale) return
    document.cookie = `fs_locale=${l}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
  }

  const btn = (l: "en" | "es", label: string) => (
    <button onClick={() => set(l)}
      style={{ flex: 1, padding: "5px 0", border: "none", cursor: "pointer",
        fontSize: 11, fontWeight: 700, fontFamily: "var(--font)", letterSpacing: ".04em",
        background: locale === l ? "var(--steel)" : "transparent",
        color: locale === l ? "#fff" : "rgba(255,255,255,.55)" }}>
      {label}
    </button>
  )

  return (
    <div style={{ display: "flex", borderRadius: 6, overflow: "hidden",
      border: "1px solid rgba(255,255,255,.18)", margin: "8px 14px" }}>
      {btn("en", "EN")}
      {btn("es", "ES")}
    </div>
  )
}
