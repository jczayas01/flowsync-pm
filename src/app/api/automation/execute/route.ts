// src/app/api/automation/execute/route.ts
// POST /api/automation/execute — fire a trigger event
// Called internally by other API routes when events happen

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { processTrigger } from "@/lib/automation/engine"
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
