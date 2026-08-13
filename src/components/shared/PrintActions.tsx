"use client"
// Shared toolbar for printable document pages. Hidden by @media print via the
// fs-inv-chrome class. Language links reload the server-rendered page.

import { usePathname } from "next/navigation"

export function PrintActions({ lang }: { lang: "es" | "en" }) {
  const pathname = usePathname()
  const btn: React.CSSProperties = {
    padding: "7px 14px", fontSize: 12, fontWeight: 600, borderRadius: 6,
    cursor: "pointer", fontFamily: "inherit",
  }
  return (
    <div className="fs-inv-chrome" style={{ width: 760, margin: "0 auto 14px",
      display: "flex", gap: 8, alignItems: "center" }}>
      <button onClick={() => window.print()}
        style={{ ...btn, background: "#0D1B2A", color: "#fff", border: "none" }}>
        {lang === "es" ? "🖨 Imprimir / Guardar PDF" : "🖨 Print / Save PDF"}
      </button>
      <a href={`${pathname}?lang=es`}
        style={{ ...btn, textDecoration: "none", color: lang === "es" ? "#0D1B2A" : "#64748B",
          background: "#fff", border: `1px solid ${lang === "es" ? "#0D1B2A" : "#E2E8F0"}` }}>
        ES
      </a>
      <a href={`${pathname}?lang=en`}
        style={{ ...btn, textDecoration: "none", color: lang === "en" ? "#0D1B2A" : "#64748B",
          background: "#fff", border: `1px solid ${lang === "en" ? "#0D1B2A" : "#E2E8F0"}` }}>
        EN
      </a>
      <button onClick={() => window.close()}
        style={{ ...btn, marginLeft: "auto", background: "#fff",
          border: "1px solid #E2E8F0", color: "#64748B" }}>
        {lang === "es" ? "Cerrar" : "Close"}
      </button>
    </div>
  )
}
