"use client"
// src/components/invite/AcceptInvite.tsx
import { useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"

export function AcceptInvite({ token, state, workspaceName, role, email, signedIn, signedInEmail }: {
  token: string; state: "valid"|"accepted"|"expired"|"not_found"
  workspaceName: string; role: string; email: string
  signedIn: boolean; signedInEmail: string
}) {
  const router = useRouter()
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState("")

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

            {!signedIn && (
              <>
                <p style={{ color: "#475569", fontSize: 13, marginBottom: 16 }}>
                  Sign in or create an account with <strong>{email}</strong> to accept.
                </p>
                <a href={`/auth/signin?callbackUrl=/invite/${token}`}
                  style={{ display: "inline-block", padding: "10px 22px", background: "#1B6CA8",
                    color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>
                  Sign in / Register →
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
