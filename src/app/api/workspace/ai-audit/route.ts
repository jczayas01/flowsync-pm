// src/app/api/workspace/ai-audit/route.ts
// AI usage audit for the member's workspace: every AI call and every policy
// block, straight from AuditLog ("ai.*" actions written by aiGuard). Read-only,
// admin-gated — this is the page a customer's compliance reviewer gets shown.
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const member = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId: true, role: true },
  })
  if (!member) return NextResponse.json({ error: "No workspace" }, { status: 404 })
  if (!["ADMIN", "SYSTEM_ADMIN"].includes(member.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  const [ws, rows] = await Promise.all([
    db.workspace.findUnique({
      where: { id: member.workspaceId }, select: { aiEnabled: true } as any,
    }) as any,
    db.auditLog.findMany({
      where:   { workspaceId: member.workspaceId, action: { startsWith: "ai." } },
      orderBy: { createdAt: "desc" },
      take:    200,
      select:  { id: true, action: true, entityId: true, createdAt: true,
                 user: { select: { name: true, email: true } } },
    }),
  ])

  return NextResponse.json({
    data: {
      aiEnabled: ws?.aiEnabled !== false,
      logs: rows.map(r => ({
        id: r.id, action: r.action, feature: r.entityId,
        at: r.createdAt, by: r.user?.name || r.user?.email || "—",
      })),
    },
  })
}
