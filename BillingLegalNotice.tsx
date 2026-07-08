"use client"
// src/components/legal/LegalFooter.tsx
// Minimal legal footer shown in the app shell and landing page

import Link from "next/link"

export function LegalFooter({ dark = false }: { dark?: boolean }) {
  const textColor = dark ? "rgba(255,255,255,.3)" : "var(--text-3,#64748B)"
  const linkColor = dark ? "rgba(255,255,255,.45)" : "var(--text-3,#64748B)"
  const borderColor = dark ? "rgba(255,255,255,.08)" : "var(--border,#E2E8F0)"
  const year = new Date().getFullYear()

  const links = [
    { href: "/terms",          label: "Terms of Service" },
    { href: "/privacy",        label: "Privacy Policy"   },
    { href: "/cookies",        label: "Cookie Policy"    },
    { href: "/security",       label: "Security"         },
    { href: "/acceptable-use", label: "Acceptable Use"   },
    { href: "/refund",         label: "Refund Policy"    },
  ]

  return (
    <div style={{
      borderTop: `1px solid ${borderColor}`,
      padding: "12px 20px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 8, flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, color: textColor }}>
        © {year} FlowSync PM, LLC. All rights reserved.
      </span>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        {links.map(l => (
          <Link key={l.href} href={l.href}
            style={{ fontSize: 11, color: linkColor, textDecoration: "none",
              transition: "color .15s" }}
            onMouseOver={e => (e.currentTarget.style.color = dark ? "#fff" : "var(--steel,#1B6CA8)")}
            onMouseOut={e  => (e.currentTarget.style.color = linkColor)}>
            {l.label}
          </Link>
        ))}
        <span style={{ fontSize: 11, color: textColor }}>
          🔒 HIPAA-ready
        </span>
      </div>
    </div>
  )
}
