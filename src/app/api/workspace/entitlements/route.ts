// src/app/api/workspace/entitlements/route.ts
// What this workspace is entitled to, what it's using, and any pending
// requests — feeds the capacity card in Settings → Team.
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { resolveEntitlements, countSeatUsage } from "@/lib/entitlements"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const member = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId: true, role: true },
  })
  if (!member) return NextResponse.json({ error: "No workspace" }, { status: 404 })

  const [ent, usage, pending] = await Promise.all([
    resolveEntitlements(member.workspaceId),
    countSeatUsage(member.workspaceId),
    (db as any).entitlementRequest.findMany({
      where: { workspaceId: member.workspaceId, status: "PENDING" },
      select: { id: true, kind: true, quantity: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }).catch(() => []),
  ])
  return NextResponse.json({ data: { ...ent, ...usage, pending,
    canRequest: ["OWNER", "ADMIN", "SUPER_ADMIN", "PMO_DIRECTOR"].includes(member.role) } })
}
