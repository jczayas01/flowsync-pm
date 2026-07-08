"use client"
// src/components/legal/CookieBanner.tsx
// GDPR-compliant cookie consent banner
// Stores consent in localStorage + sets a cookie for server-side reading

import { useState, useEffect } from "react"
import Link from "next/link"

type ConsentLevel = "all" | "necessary" | null

const CONSENT_KEY = "flowsync_cookie_consent"
const CONSENT_VERSION = "1.0"

export function CookieBanner() {
  const [visible,  setVisible]  = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [prefs, setPrefs] = useState({
    necessary: true,   // always on
    functional: true,
    analytics: false,
  })

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY)
      if (!stored) { setVisible(true); return }
      const parsed = JSON.parse(stored)
      if (parsed.version !== CONSENT_VERSION) { setVisible(true) }
    } catch { setVisible(true) }
  }, [])

  function saveConsent(level: ConsentLevel) {
    const consent = {
      version:   CONSENT_VERSION,
      level,
      timestamp: new Date().toISOString(),
      prefs:     level === "all"
        ? { necessary:true, functional:true, analytics:true }
        : { necessary:true, functional:false, analytics:false },
    }
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
    // Also set a cookie for server-side middleware
    document.cookie = `${CONSENT_KEY}=${level}; path=/; max-age=${365*24*3600}; SameSite=Lax; Secure`
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000,
      background: "var(--navy,#0D1B2A)",
      borderTop: "1px solid rgba(255,255,255,.1)",
      boxShadow: "0 -8px 32px rgba(0,0,0,.4)",
      fontFamily: "var(--font)",
      animation: "slideUp .3s ease",
    }}>
      <style>{`@keyframes slideUp { from { transform:translateY(100%); opacity:0; } to { transform:none; opacity:1; } }`}</style>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 24px" }}>
        {/* Main row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>🍪</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                We use cookies
              </span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,.6)", lineHeight: 1.6, margin: 0 }}>
              FlowSync PM uses cookies to keep you signed in, remember your preferences, and
              improve the platform. You can choose which cookies to allow.{" "}
              <Link href="/cookies" style={{ color: "var(--amber,#F59E0B)", textDecoration: "none", fontWeight: 500 }}>
                Cookie Policy
              </Link>
              {" · "}
              <Link href="/privacy" style={{ color: "var(--amber,#F59E0B)", textDecoration: "none", fontWeight: 500 }}>
                Privacy Policy
              </Link>
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ padding: "8px 14px", background: "rgba(255,255,255,.08)",
                border: "1px solid rgba(255,255,255,.15)", borderRadius: 8,
                color: "rgba(255,255,255,.7)", fontSize: 12, fontWeight: 500,
                cursor: "pointer", fontFamily: "var(--font)", whiteSpace: "nowrap" }}>
              {expanded ? "Hide options" : "Manage preferences"}
            </button>
            <button
              onClick={() => saveConsent("necessary")}
              style={{ padding: "8px 14px", background: "rgba(255,255,255,.08)",
                border: "1px solid rgba(255,255,255,.15)", borderRadius: 8,
                color: "rgba(255,255,255,.7)", fontSize: 12, fontWeight: 500,
                cursor: "pointer", fontFamily: "var(--font)", whiteSpace: "nowrap" }}>
              Necessary only
            </button>
            <button
              onClick={() => saveConsent("all")}
              style={{ padding: "8px 18px", background: "var(--amber,#F59E0B)",
                border: "none", borderRadius: 8, color: "#0D1B2A",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                fontFamily: "var(--font)", whiteSpace: "nowrap" }}>
              Accept all
            </button>
          </div>
        </div>

        {/* Expanded preferences */}
        {expanded && (
          <div style={{ marginTop: 16, paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,.1)",
            display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
            {[
              { key: "necessary", label: "Strictly necessary", always: true,
                desc: "Required for the platform to function. Includes session, authentication, and security cookies." },
              { key: "functional", label: "Functional", always: false,
                desc: "Remember your preferences, workspace selection, and UI settings." },
              { key: "analytics", label: "Analytics", always: false,
                desc: "Help us understand how you use the platform so we can improve it. Data is aggregated." },
            ].map(cat => (
              <div key={cat.key} style={{ display: "flex", gap: 12, alignItems: "flex-start",
                background: "rgba(255,255,255,.05)", borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 3 }}>
                    {cat.label}
                    {cat.always && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px",
                        borderRadius: 4, background: "rgba(5,150,105,.3)", color: "#34D399",
                        marginLeft: 8 }}>Always on</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", lineHeight: 1.5 }}>
                    {cat.desc}
                  </div>
                </div>
                <button
                  disabled={cat.always}
                  onClick={() => setPrefs(p => ({ ...p, [cat.key]: !p[cat.key as keyof typeof p] }))}
                  style={{
                    width: 40, height: 22, borderRadius: 11, border: "none",
                    cursor: cat.always ? "default" : "pointer",
                    position: "relative", flexShrink: 0, marginTop: 2,
                    transition: "background .2s",
                    background: (cat.always || prefs[cat.key as keyof typeof prefs])
                      ? "#059669" : "rgba(255,255,255,.2)",
                  }}>
                  <div style={{
                    position: "absolute", top: 3,
                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    transition: "left .2s",
                    left: (cat.always || prefs[cat.key as keyof typeof prefs]) ? 21 : 3,
                  }}/>
                </button>
              </div>
            ))}

            <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => saveConsent("necessary")}
                style={{ padding: "8px 16px", background: "rgba(255,255,255,.08)",
                  border: "1px solid rgba(255,255,255,.15)", borderRadius: 8,
                  color: "rgba(255,255,255,.7)", fontSize: 12, fontWeight: 500,
                  cursor: "pointer", fontFamily: "var(--font)" }}>
                Save preferences
              </button>
              <button
                onClick={() => saveConsent("all")}
                style={{ padding: "8px 18px", background: "var(--amber,#F59E0B)",
                  border: "none", borderRadius: 8, color: "#0D1B2A",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font)" }}>
                Accept all
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
