// src/app/api/security/sessions/route.ts
// GET    /api/security/sessions     — list active sessions
// DELETE /api/security/sessions/:id — revoke a session

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { listUserSessions, revokeSession, revokeAllSessions } from "@/lib/security/sessions"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get current session token from cookie
  const currentToken = req.cookies.get("next-auth.session-token")?.value
    || req.cookies.get("__Secure-next-auth.session-token")?.value
    || ""

  const sessions = await listUserSessions(session.user.id, currentToken)
  return NextResponse.json({ data: sessions })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url       = new URL(req.url)
  const revokeAll = url.searchParams.get("all") === "true"
  const sessionId = url.searchParams.get("sessionId")

  const currentToken = req.cookies.get("next-auth.session-token")?.value || ""

  if (revokeAll) {
    const count = await revokeAllSessions(session.user.id, currentToken, session.user.id)
    return NextResponse.json({ success: true, revoked: count })
  }

  if (sessionId) {
    const { db } = await import("@/lib/db")
    const s = await db.session.findFirst({
      where: { id: sessionId, userId: session.user.id },
    })
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    await revokeSession(s.sessionToken, session.user.id)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Specify sessionId or all=true" }, { status: 400 })
}
