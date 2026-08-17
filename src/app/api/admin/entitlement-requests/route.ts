// src/app/api/admin/entitlement-requests/route.ts
// Platform admin queue. GET lists pending (and recent decided) requests.
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/admin-gate"

export async function GET() {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const rows = await (db as any).entitlementRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { workspace: { select: { id: true, name: true, plan: true } } },
  })
  const userIds = Array.from(new Set(rows.map((r: any) => r.requestedById)))
  const users = await db.user.findMany({ where: { id: { in: userIds as string[] } }, select: { id: true, name: true, email: true } })
  const umap = new Map(users.map(u => [u.id, u]))
  return NextResponse.json({ data: rows.map((r: any) => ({
    ...r, unitPrice: r.unitPrice == null ? null : Number(r.unitPrice),
    requestedBy: umap.get(r.requestedById) || null,
  })) })
}
