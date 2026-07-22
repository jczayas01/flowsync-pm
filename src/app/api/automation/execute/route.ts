// src/app/api/automation/execute/route.ts
// POST /api/automation/execute — fire a trigger event
// Called internally by other API routes when events happen

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { processTrigger } from "@/lib/automation/engine"
import { runScheduledScans } from "@/lib/automation/engine"
import type { TriggerEvent } from "@/lib/automation/types"

// Simple API key auth for internal calls
function validateInternalKey(req: NextRequest): boolean {
  const key = req.headers.get("x-internal-key")
  return key === process.env.INTERNAL_API_KEY
}

export async function POST(req: NextRequest) {
  if (!validateInternalKey(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const event: TriggerEvent = await req.json()

  // Process asynchronously — don't block the response
  processTrigger(event).catch(e => console.error("[Automation]", e))

  return NextResponse.json({ accepted: true })
}

// Daily scheduled scans — Vercel Cron hits this with GET.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const provided = new URL(req.url).searchParams.get("secret") ||
      (req.headers.get("authorization") || "").replace("Bearer ", "")
    if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const counts = await runScheduledScans().catch(e => {
    console.error("[Automation] scheduled scan failed", e); return null
  })
  return NextResponse.json({ ok: !!counts, counts })
}
