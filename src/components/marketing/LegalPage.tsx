"use client"
// src/components/marketing/LegalPage.tsx
import Link from "next/link"
import { useState } from "react"
import { LEGAL_ES } from "@/lib/legal-es"

interface Section { title:string; content:string }

export function LegalPage({ title, lastUpdated, sections, docKey }: {
  title:string; lastUpdated:string; sections:Section[]
  /** Key into the Spanish translations (e.g. "privacy"). Omit when none exists. */
  docKey?:string
}) {
  const es = docKey ? LEGAL_ES[docKey] : undefined
  const [lang, setLang] = useState<"en"|"es">("en")
  const showEs = lang === "es" && !!es
  const shown  = showEs ? es!.sections : sections
  const heading = showEs ? es!.title : title

  return (
    <div style={{ fontFamily:"system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh" }}>
      <nav style={{ background:"#1a3a5c", padding:"0 40px", height:60,
        display:"flex", alignItems:"center", gap:20 }}>
        <Link href="/" style={{ fontSize:18, fontWeight:800, color:"#fff", textDecoration:"none" }}>
          FlowSync <span style={{ color:"#60A5FA" }}>PM</span>
        </Link>
        <Link href="/legal" style={{ fontSize:13, color:"rgba(255,255,255,.6)", textDecoration:"none" }}>
          {showEs ? "← Todos los documentos" : "← All legal docs"}
        </Link>
        {es && (
          <div style={{ marginLeft:"auto", display:"flex", gap:2, background:"rgba(255,255,255,.12)",
            borderRadius:7, padding:2 }}>
            {(["en","es"] as const).map(l => (
              <button key={l} onClick={() => setLang(l)}
                style={{ padding:"4px 12px", borderRadius:5, border:"none", cursor:"pointer",
                  fontSize:12, fontWeight:700, fontFamily:"inherit",
                  background: lang === l ? "#fff" : "transparent",
                  color: lang === l ? "#1a3a5c" : "rgba(255,255,255,.75)" }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </nav>
      <div style={{ maxWidth:720, margin:"0 auto", padding:"60px 20px 80px" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase",
          letterSpacing:".08em", marginBottom:8 }}>
          FlowSync PM Legal
        </div>
        <h1 style={{ fontSize:34, fontWeight:800, color:"#1E293B", marginBottom:8, lineHeight:1.1 }}>
          {heading}
        </h1>
        <div style={{ fontSize:13, color:"#94A3B8", marginBottom: showEs ? 20 : 40 }}>
          {showEs ? "Última actualización: " : "Last updated: "}{lastUpdated}
        </div>

        {/* A translated contract is a convenience, never the governing text. */}
        {showEs && (
          <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:8,
            padding:"12px 16px", marginBottom:36, fontSize:12.5, color:"#92400E", lineHeight:1.7 }}>
            Esta es una <strong>traducción de cortesía</strong>. En caso de discrepancia entre esta
            versión y el original en inglés, <strong>prevalece la versión en inglés</strong>, que es
            el texto legalmente vinculante.
          </div>
        )}
        {!showEs && es && (
          <div style={{ fontSize:12.5, color:"#64748B", marginBottom:36 }}>
            Este documento también está disponible en español — use el selector ES arriba.
          </div>
        )}

        {shown.map((sec,i) => (
          <div key={i} style={{ marginBottom:28 }}>
            <h2 style={{ fontSize:16, fontWeight:700, color:"#1E293B", marginBottom:8,
              paddingBottom:6, borderBottom:"1px solid #E2E8F0" }}>
              {sec.title}
            </h2>
            <p style={{ fontSize:14, color:"#374151", lineHeight:1.8, margin:0 }}>
              {sec.content}
            </p>
          </div>
        ))}
        <div style={{ marginTop:48, padding:"20px", background:"#EFF6FF",
          borderRadius:8, textAlign:"center" }}>
          <div style={{ fontSize:13, color:"#1B6CA8" }}>
            {showEs ? "¿Preguntas? Escríbanos a " : "Questions? Contact us at "}
            <a href="mailto:legal@flowsyncpm.com" style={{ color:"#1B6CA8", fontWeight:600 }}>
              legal@flowsyncpm.com
            </a>
          </div>
        </div>
        <div style={{ marginTop:24, fontSize:11, color:"#94A3B8", textAlign:"center" }}>
          © 2026 FlowSync PM. {showEs ? "Todos los derechos reservados." : "All rights reserved."}
        </div>
      </div>
    </div>
  )
}
