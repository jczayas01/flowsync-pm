// src/app/api/internal/tenant-by-host/route.ts
// Called by the Edge middleware to map a custom domain to its workspace.
// Guarded by INTERNAL_API_KEY. Returns only the id — nothing else leaks.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-internal-key") || ""
  if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const host = (new URL(req.url).searchParams.get("host") || "").toLowerCase()
  if (!host) return NextResponse.json({ workspaceId: null })
  const ws = await db.workspace.findFirst({
    where: { customDomain: host, customDomainStatus: "ACTIVE" } as any,
    select: { id: true },
  }).catch(() => null)
  return NextResponse.json({ workspaceId: ws?.id || null },
    { headers: { "Cache-Control": "private, max-age=300" } })
}
