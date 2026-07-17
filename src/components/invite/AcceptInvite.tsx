"use client"
// src/components/invite/AcceptInvite.tsx
import { useState } from "react"
import { useRouter } from "next/navigation"
import { signOut, signIn } from "next-auth/react"

export function AcceptInvite({ token, state, workspaceName, role, email, signedIn, signedInEmail, hasAccount }: {
  token: string; state: "valid"|"accepted"|"expired"|"not_found"
  workspaceName: string; role: string; email: string
  signedIn: boolean; signedInEmail: string; hasAccount: boolean
}) {
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
      if (!res.ok) { setError(d?.error || "Couldn't create your account."); setBusy(false); return }

      const signInRes = await signIn("credentials", { email, password, redirect: false })
      if (signInRes?.error) {
        // Account exists and they're in the workspace — just can't auto-sign-in.
        router.push("/auth/signin?callbackUrl=/dashboard")
        return
      }
      window.location.href = "/dashboard"
    } catch {
      setError("Connection lost — try again")
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
    } catch { setError("Connection lost — try again") }
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
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: "#0D1B2A" }}>
          FlowSync <span style={{ color: "#F59E0B" }}>PM</span>
        </div>

        {state === "not_found" && (
          <p style={{ color: "#475569", fontSize: 14 }}>This invitation link is invalid or was removed.</p>
        )}
        {state === "accepted" && (
          <>
            <p style={{ color: "#475569", fontSize: 14 }}>This invitation was already accepted.</p>
            <a href="/auth/signin" style={{ color: "#1B6CA8", fontSize: 13 }}>Sign in →</a>
          </>
        )}
        {state === "expired" && (
          <p style={{ color: "#475569", fontSize: 14 }}>
            This invitation has expired. Ask your workspace admin to send a new one.
          </p>
        )}

        {state === "valid" && (
          <>
            <h1 style={{ fontSize: 18, color: "#0D1B2A", margin: "16px 0 6px" }}>
              You&apos;re invited to <strong>{workspaceName}</strong>
            </h1>
            <p style={{ color: "#64748B", fontSize: 13, marginBottom: 20 }}>
              as <strong>{role.replace(/_/g, " ").toLowerCase()
                .replace(/\b\w/g, c => c.toUpperCase())}</strong> · sent to {email}
            </p>

            {/* Not signed in, no account yet → join right here. No detour. */}
            {!signedIn && !hasAccount && (
              <form onSubmit={registerAndJoin}
                style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "#64748B" }}>
                  Your name
                  <input value={name} onChange={e => setName(e.target.value)} required autoFocus
                    placeholder="Alex Rivera" style={field} />
                </label>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "#64748B" }}>
                  Create a password
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    required minLength={8} placeholder="At least 8 characters" style={field} />
                </label>
                <button type="submit" disabled={busy}
                  style={{ padding: "11px 22px", background: "#1B6CA8", color: "#fff", border: "none",
                    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: busy ? "wait" : "pointer",
                    fontFamily: "inherit", marginTop: 4 }}>
                  {busy ? "Joining…" : `Join ${workspaceName} →`}
                </button>
                <div style={{ position: "relative", margin: "10px 0 6px", textAlign: "center" }}>
                  <div style={{ height: 1, background: "#E2E8F0" }} />
                  <span style={{ position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%,-50%)", background: "#fff", padding: "0 10px",
                    fontSize: 11, color: "#94A3B8" }}>or</span>
                </div>
                <button type="button" onClick={() => signIn("google", { callbackUrl: `/invite/${token}` })}
                  style={{ padding: "10px", background: "#fff", border: "1px solid #E2E8F0",
                    borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
                    fontFamily: "inherit", color: "#0D1B2A" }}>
                  Continue with Google
                </button>
                <button type="button" onClick={() => signIn("microsoft-entra-id", { callbackUrl: `/invite/${token}` })}
                  style={{ padding: "10px", background: "#fff", border: "1px solid #E2E8F0",
                    borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
                    fontFamily: "inherit", color: "#0D1B2A" }}>
                  Continue with Microsoft
                </button>
                <p style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 4, lineHeight: 1.5 }}>
                  Use the same email the invitation was sent to.
                </p>
              </form>
            )}

            {/* Already has an account → sign in, then land back here. */}
            {!signedIn && hasAccount && (
              <>
                <p style={{ color: "#475569", fontSize: 13, marginBottom: 16 }}>
                  You already have an account with <strong>{email}</strong>. Sign in to accept.
                </p>
                <a href={`/auth/signin?callbackUrl=/invite/${token}`}
                  style={{ display: "inline-block", padding: "10px 22px", background: "#1B6CA8",
                    color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>
                  Sign in to accept →
                </a>
              </>
            )}

            {wrongAccount && (
              <>
                <p style={{ color: "#B45309", fontSize: 13, background: "#FFFBEB",
                  border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 12px",
                  textAlign: "left", lineHeight: 1.55, marginBottom: 14 }}>
                  You&apos;re signed in as <strong>{signedInEmail}</strong>, but this invitation
                  was sent to <strong>{email}</strong>.
                </p>
                {/* Telling someone to "sign out and come back" without a button strands
                    them: they'd have to find sign-out, then dig the invite link back
                    out of their email. Do it for them and return to this exact page. */}
                <button onClick={() => signOut({ callbackUrl: `/invite/${token}` })}
                  style={{ padding: "10px 22px", background: "#1B6CA8", color: "#fff",
                    border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500,
                    cursor: "pointer", fontFamily: "inherit" }}>
                  Sign out & continue as {email.split("@")[0]} →
                </button>
                <p style={{ color: "#94A3B8", fontSize: 11.5, marginTop: 10 }}>
                  You&apos;ll come straight back here to accept.
                </p>
              </>
            )}

            {signedIn && !wrongAccount && (
              <button onClick={accept} disabled={busy}
                style={{ padding: "10px 26px", background: "#1B6CA8", color: "#fff", border: "none",
                  borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: busy ? "wait" : "pointer" }}>
                {busy ? "Joining…" : "Accept invitation →"}
              </button>
            )}
            {error && <p style={{ color: "#B91C1C", fontSize: 13, marginTop: 12 }}>✗ {error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
