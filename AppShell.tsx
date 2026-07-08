"use client"
// src/components/auth/SignUpForm.tsx — with legal consent checkbox
import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"

export function SignUpForm() {
  const [form, setForm]       = useState({ name: "", email: "", password: "" })
  const [consented, setConsented] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!consented) { setError("You must accept the Terms of Service and Privacy Policy to continue."); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, consentedAt: new Date().toISOString() }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || "Registration failed")
        setLoading(false); return
      }
      await signIn("credentials", { email: form.email, password: form.password, redirect: false })
      window.location.href = "/onboarding"
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px",
    background: "rgba(255,255,255,.07)",
    border: "1.5px solid rgba(255,255,255,.12)",
    borderRadius: "var(--radius,8px)", color: "#fff",
    fontSize: 14, fontFamily: "var(--font)", outline: "none",
    transition: "border-color .15s",
  }

  return (
    <div>
      {error && (
        <div style={{ background: "rgba(220,38,38,.15)", border: "1px solid rgba(220,38,38,.3)",
          color: "#FCA5A5", padding: "10px 14px", borderRadius: "var(--radius,8px)",
          fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input type="text" placeholder="Your full name" required value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
        <input type="email" placeholder="Work email" required value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
        <input type="password" placeholder="Password (8+ characters)" required minLength={8}
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })} style={inputStyle} />

        {/* Legal consent checkbox — required */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
          background: "rgba(255,255,255,.04)", borderRadius: "var(--radius,8px)",
          border: `1.5px solid ${consented ? "rgba(5,150,105,.4)" : "rgba(255,255,255,.12)"}`,
          transition: "border-color .2s", cursor: "pointer" }}
          onClick={() => setConsented(c => !c)}>
          <div style={{
            width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
            border: `2px solid ${consented ? "#059669" : "rgba(255,255,255,.3)"}`,
            background: consented ? "#059669" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .15s", cursor: "pointer",
          }}>
            {consented && <span style={{ color: "#fff", fontSize: 12, lineHeight: 1, fontWeight: 700 }}>✓</span>}
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,.6)", lineHeight: 1.6, margin: 0 }}>
            I agree to FlowSync PM&apos;s{" "}
            <Link href="/terms" target="_blank"
              style={{ color: "var(--amber,#F59E0B)", textDecoration: "none", fontWeight: 500 }}
              onClick={e => e.stopPropagation()}>
              Terms of Service
            </Link>
            {" "}and{" "}
            <Link href="/privacy" target="_blank"
              style={{ color: "var(--amber,#F59E0B)", textDecoration: "none", fontWeight: 500 }}
              onClick={e => e.stopPropagation()}>
              Privacy Policy
            </Link>
            . I understand that my data will be processed as described in the Privacy Policy.
          </p>
        </div>

        <button type="submit" disabled={loading || !consented}
          style={{
            width: "100%", padding: 12,
            background: consented ? "var(--amber,#F59E0B)" : "rgba(255,255,255,.1)",
            color: consented ? "var(--navy,#0D1B2A)" : "rgba(255,255,255,.3)",
            border: "none", borderRadius: "var(--radius,8px)",
            fontSize: 14, fontWeight: 700, cursor: consented ? "pointer" : "not-allowed",
            fontFamily: "var(--font)", marginTop: 4, transition: "all .2s",
          }}>
          {loading ? "Creating account…" : "Create free account →"}
        </button>
      </form>

      <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,.25)",
        marginTop: 14, lineHeight: 1.6 }}>
        Your consent is recorded with a timestamp. You can review our{" "}
        <Link href="/privacy" style={{ color: "rgba(255,255,255,.4)", textDecoration: "none" }}>
          Privacy Policy
        </Link>
        {" "}at any time.
      </p>

      <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,.4)", marginTop: 12 }}>
        Already have an account?{" "}
        <Link href="/auth/signin"
          style={{ color: "var(--amber,#F59E0B)", textDecoration: "none", fontWeight: 500 }}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
