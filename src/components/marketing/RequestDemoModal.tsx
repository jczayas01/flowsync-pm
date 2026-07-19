// src/components/marketing/RequestDemoModal.tsx
"use client"
import { sendGAEvent } from "@next/third-parties/google"
import { useState, useEffect } from "react"

const NAVY = "#0D1B2A", STEEL = "#1B6CA8", GREEN = "#059669"

const TEAM_SIZES = ["1–10", "11–50", "51–200", "201–1,000", "1,000+"]

export function RequestDemoModal({
  open, onClose, source = "landing", locale = "en",
}: {
  open: boolean; onClose: () => void; source?: string; locale?: "en" | "es"
}) {
  const es = locale === "es"
  const [f, setF] = useState({ name:"", email:"", company:"", teamSize:"", phone:"", message:"", website:"" })
  const [loading, setLoading] = useState(false)
  const [err, setErr]   = useState("")
  const [done, setDone] = useState(false)

  // Esc to close — expected behaviour for any modal
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [open, onClose])

  if (!open) return null

  const set = (k: string) => (e: any) => setF(p => ({ ...p, [k]: e.target.value }))
  const ready = f.name.trim() && f.email.trim() && f.company.trim()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(""); setLoading(true)
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, locale, source }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(d?.error || (es ? "Algo salió mal. Inténtalo de nuevo." : "Something went wrong. Please try again.")); setLoading(false); return }
      sendGAEvent("event", "demo_request", { source })
      setDone(true)
    } catch {
      setErr(es ? "Algo salió mal. Inténtalo de nuevo." : "Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(13,27,42,.6)", zIndex:200,
        display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:"#fff", borderRadius:12, width:"100%", maxWidth:460,
          maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(0,0,0,.3)" }}>

        {done ? (
          <div style={{ padding:"36px 28px", textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:10 }}>✅</div>
            <div style={{ fontSize:18, fontWeight:700, color:NAVY, marginBottom:8 }}>
              {es ? "¡Solicitud recibida!" : "Request received!"}
            </div>
            <div style={{ fontSize:13.5, color:"#475569", lineHeight:1.6, marginBottom:22 }}>
              {es
                ? "Te contactaremos dentro de un día hábil para coordinar tu demo de 15 minutos. Revisa tu correo — te enviamos una confirmación."
                : "We'll reach out within one business day to set up your 15-minute demo. Check your inbox — we sent a confirmation."}
            </div>
            <button onClick={onClose}
              style={{ padding:"10px 24px", background:NAVY, color:"#fff", border:"none",
                borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" }}>
              {es ? "Cerrar" : "Close"}
            </button>
          </div>
        ) : (
          <>
            <div style={{ padding:"22px 24px 0", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:18, fontWeight:700, color:NAVY }}>
                  {es ? "Solicita una demo" : "Request a demo"}
                </div>
                <div style={{ fontSize:12.5, color:"#64748B", marginTop:3, lineHeight:1.5 }}>
                  {es
                    ? "15 minutos, con un proyecto real — no una presentación genérica."
                    : "15 minutes, walked through a real project — not a canned deck."}
                </div>
              </div>
              <button onClick={onClose} aria-label="Close"
                style={{ background:"none", border:"none", fontSize:22, color:"#94A3B8",
                  cursor:"pointer", lineHeight:1, padding:0 }}>×</button>
            </div>

            <form onSubmit={submit} style={{ padding:"18px 24px 24px", display:"flex", flexDirection:"column", gap:11 }}>
              {err && (
                <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8,
                  padding:"9px 12px", fontSize:12.5, color:"#B91C1C" }}>{err}</div>
              )}

              <Field label={es ? "Nombre *" : "Name *"}>
                <input required value={f.name} onChange={set("name")} style={inp} autoFocus />
              </Field>
              <Field label={es ? "Correo de trabajo *" : "Work email *"}>
                <input required type="email" value={f.email} onChange={set("email")} style={inp} />
              </Field>
              <Field label={es ? "Empresa *" : "Company *"}>
                <input required value={f.company} onChange={set("company")} style={inp} />
              </Field>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <Field label={es ? "Tamaño del equipo" : "Team size"}>
                  <select value={f.teamSize} onChange={set("teamSize")} style={inp}>
                    <option value="">{es ? "Selecciona…" : "Select…"}</option>
                    {TEAM_SIZES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label={es ? "Teléfono" : "Phone"}>
                  <input value={f.phone} onChange={set("phone")} style={inp} />
                </Field>
              </div>

              <Field label={es ? "¿Qué te gustaría resolver?" : "What are you hoping to solve?"}>
                <textarea rows={3} value={f.message} onChange={set("message")}
                  style={{ ...inp, resize:"vertical", minHeight:64 }}
                  placeholder={es ? "Opcional — nos ayuda a preparar la demo." : "Optional — helps us tailor the demo."} />
              </Field>

              {/* honeypot — hidden from humans, irresistible to bots */}
              <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")}
                style={{ position:"absolute", left:-9999, width:1, height:1, opacity:0 }} aria-hidden="true" />

              <button type="submit" disabled={loading || !ready}
                style={{ marginTop:4, padding:"11px", background: ready ? STEEL : "#CBD5E1",
                  color:"#fff", border:"none", borderRadius:8, fontSize:13.5, fontWeight:600,
                  cursor: ready ? "pointer" : "not-allowed" }}>
                {loading ? (es ? "Enviando…" : "Sending…") : (es ? "Solicitar demo" : "Request demo")}
              </button>

              <div style={{ fontSize:11, color:"#94A3B8", textAlign:"center", lineHeight:1.5 }}>
                {es ? "Sin compromiso. No compartimos tu información." : "No commitment. We never share your information."}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display:"block" }}>
      <div style={{ fontSize:11.5, fontWeight:600, color:"#475569", marginBottom:4 }}>{label}</div>
      {children}
    </label>
  )
}

const inp: React.CSSProperties = {
  width:"100%", padding:"9px 11px", border:"1px solid #E2E8F0", borderRadius:8,
  fontSize:13, fontFamily:"inherit", color:"#0D1B2A", outline:"none", background:"#fff",
}
