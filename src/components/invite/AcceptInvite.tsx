"use client"
import { useTranslations } from "next-intl"
// src/components/invite/AcceptInvite.tsx
import { sendGAEvent } from "@next/third-parties/google"
import { LogoMark, Wordmark } from "@/components/shared/Logo"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { signOut, signIn } from "next-auth/react"

export function AcceptInvite({ token, state, workspaceName, role, email, signedIn, signedInEmail, hasAccount }: {
  token: string; state: "valid"|"accepted"|"expired"|"not_found"
  workspaceName: string; role: string; email: string
  signedIn: boolean; signedInEmail: string; hasAccount: boolean
}) {
  const ai = useTranslations("acceptInvite")
  const router = useRouter()
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState("")
  const [name, setName]         = useState("")
  const [password, setPassword] = useState("")

  // Register + accept + sign in, from this page. The invite token proves which
  // email was invited, so there's no reason to send anyone on a sign-in detour.
  async function registerAndJoin(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError("")
    try {
      const res = await fetch(`/api/invite/${token}/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d?.error || ai("couldNotCreate")); setBusy(false); return }

      const signInRes = await signIn("credentials", { email, password, redirect: false })
      if (signInRes?.error) {
        // Account exists and they're in the workspace — just can't auto-sign-in.
        router.push("/auth/signin?callbackUrl=/dashboard")
        return
      }
      sendGAEvent('event', 'invite_accepted', {})
      window.location.href = "/dashboard"
    } catch {
      setError(ai("connectionLost"))
      setBusy(false)
    }
  }

  async function accept() {
    setBusy(true); setError("")
    try {
      const res = await fetch(`/api/invite/${token}`, { method: "POST" })
      const d = await res.json().catch(() => null)
      if (!res.ok) { setError(d?.error || `Failed (${res.status})`); return }
      router.push(d?.data?.redirectTo || "/dashboard")
    } catch { setError(ai("connectionLost")) }
    finally { setBusy(false) }
  }

  const card: React.CSSProperties = {
    maxWidth: 460, margin: "80px auto", padding: "36px 32px", background: "#fff",
    border: "1px solid #E2E8F0", borderRadius: 12, textAlign: "center",
    fontFamily: "'DM Sans', Inter, sans-serif",
  }
  const field: React.CSSProperties = {
    width: "100%", padding: "10px 12px", border: "1px solid #E2E8F0", borderRadius: 8,
    fontSize: 14, fontFamily: "inherit", outline: "none", marginTop: 5, color: "#0D1B2A",
  }
  const wrongAccount = signedIn && email && signedInEmail.toLowerCase() !== email.toLowerCase()

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
          gap: 9, marginBottom: 6 }}>
          <LogoMark size={26} radius={7} />
          <Wordmark size={18} tone="light" />
        </div>

        {state === "not_found" && (
          <p style={{ color: "#475569", fontSize: 14 }}>{ai("linkInvalid")}</p>
        )}
        {state === "accepted" && (
          <>
            <p style={{ color: "#475569", fontSize: 14 }}>{ai("alreadyAccepted")}</p>
            <a href="/auth/signin" style={{ color: "#1B6CA8", fontSize: 13 }}>{ai("Sign in →")}</a>
          </>
        )}
        {state === "expired" && (
          <p style={{ color: "#475569", fontSize: 14 }}>
            {ai("expired")}
          </p>
        )}

        {state === "valid" && (
          <>
            <h1 style={{ fontSize: 18, color: "#0D1B2A", margin: "16px 0 6px" }}>
              {ai("invitedTo")} <strong>{workspaceName}</strong>
            </h1>
            <p style={{ color: "#64748B", fontSize: 13, marginBottom: 20 }}>
              {ai("asRole")} <strong>{role.replace(/_/g, " ").toLowerCase()
                .replace(/\b\w/g, c => c.toUpperCase())}</strong> {ai("sentTo", { email })}
            </p>

            {/* Not signed in, no account yet → join right here. No detour. */}
            {!signedIn && !hasAccount && (
              <form onSubmit={registerAndJoin}
                style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "#64748B" }}>
                  {ai("Your name")}
                  <input value={name} onChange={e => setName(e.target.value)} required autoFocus
                    placeholder={ai("namePlaceholder")} style={field} />
                </label>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "#64748B" }}>
                  {ai("Create a password")}
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    required minLength={8} placeholder={ai("passwordPlaceholder")} style={field} />
                </label>
                <button type="submit" disabled={busy}
                  style={{ padding: "11px 22px", background: "#1B6CA8", color: "#fff", border: "none",
                    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: busy ? "wait" : "pointer",
                    fontFamily: "inherit", marginTop: 4 }}>
                  {busy ? ai("Joining…") : ai("joinWorkspace", { workspace: workspaceName })}
                </button>
                <div style={{ position: "relative", margin: "10px 0 6px", textAlign: "center" }}>
                  <div style={{ height: 1, background: "#E2E8F0" }} />
                  <span style={{ position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%,-50%)", background: "#fff", padding: "0 10px",
                    fontSize: 11, color: "#94A3B8" }}>{ai("or")}</span>
                </div>
                <button type="button" onClick={() => signIn("google", { callbackUrl: `/invite/${token}` })}
                  style={{ padding: "10px", background: "#fff", border: "1px solid #E2E8F0",
                    borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
                    fontFamily: "inherit", color: "#0D1B2A" }}>
                  {ai("Continue with Google")}
                </button>
                <button type="button" onClick={() => signIn("microsoft-entra-id", { callbackUrl: `/invite/${token}` })}
                  style={{ padding: "10px", background: "#fff", border: "1px solid #E2E8F0",
                    borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
                    fontFamily: "inherit", color: "#0D1B2A" }}>
                  {ai("Continue with Microsoft")}
                </button>
                <p style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 4, lineHeight: 1.5 }}>
                  {ai("sameEmailNotice")}{" "}
                  <a href="/legal/terms" target="_blank" rel="noopener" style={{ color: "#1B6CA8" }}>{ai("Terms")}</a> {ai("and")}{" "}
                  <a href="/legal/privacy" target="_blank" rel="noopener" style={{ color: "#1B6CA8" }}>{ai("Privacy Policy")}</a>.
                </p>
              </form>
            )}

            {/* Already has an account → sign in, then land back here. */}
            {!signedIn && hasAccount && (
              <>
                <p style={{ color: "#475569", fontSize: 13, marginBottom: 16 }}>
                  {ai("hasAccount")} <strong>{email}</strong>. {ai("signInToAccept")}
                </p>
                <a href={`/auth/signin?callbackUrl=/invite/${token}`}
                  style={{ display: "inline-block", padding: "10px 22px", background: "#1B6CA8",
                    color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>
                  {ai("Sign in to accept →")}
                </a>
              </>
            )}

            {wrongAccount && (
              <>
                <p style={{ color: "#B45309", fontSize: 13, background: "#FFFBEB",
                  border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 12px",
                  textAlign: "left", lineHeight: 1.55, marginBottom: 14 }}>
                  {ai("wrongAccountA")} <strong>{signedInEmail}</strong>{ai("wrongAccountB")} <strong>{email}</strong>.
                </p>
                {/* Telling someone to "sign out and come back" without a button strands
                    them: they'd have to find sign-out, then dig the invite link back
                    out of their email. Do it for them and return to this exact page. */}
                <button onClick={() => signOut({ callbackUrl: `/invite/${token}` })}
                  style={{ padding: "10px 22px", background: "#1B6CA8", color: "#fff",
                    border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500,
                    cursor: "pointer", fontFamily: "inherit" }}>
                  {ai("signOutContinue", { name: email.split("@")[0] })}
                </button>
                <p style={{ color: "#94A3B8", fontSize: 11.5, marginTop: 10 }}>
                  {ai("comeBackHere")}
                </p>
              </>
            )}

            {signedIn && !wrongAccount && (
              <button onClick={accept} disabled={busy}
                style={{ padding: "10px 26px", background: "#1B6CA8", color: "#fff", border: "none",
                  borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: busy ? "wait" : "pointer" }}>
                {busy ? ai("Joining…") : ai("Accept invitation →")}
              </button>
            )}
            {error && <p style={{ color: "#B91C1C", fontSize: 13, marginTop: 12 }}>✗ {error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
