// src/app/api/automation/execute/route.ts
// POST /api/automation/execute — fire a trigger event
// Called internally by other API routes when events happen

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { processTrigger } from "@/lib/automation/engine"
import { reconcileAllEV } from "@/lib/evm-auto"
import { runContractAlerts } from "@/lib/contract-alerts"
import { postRecurringBudgetItems, postLaborActuals } from "@/lib/budget-cron"
import { sendVerificationReminders } from "@/lib/verify-reminder"
import { runScheduledScans } from "@/lib/automation/engine"
import type { TriggerEvent } from "@/lib/automation/types"

// Simple API key auth for internal calls.
// A missing INTERNAL_API_KEY used to 401 every event trigger in total silence —
// the automation engine looked "built but never firing" for weeks. Now the
// misconfiguration announces itself in the logs instead of hiding.
function validateInternalKey(req: NextRequest): boolean {
  const expected = process.env.INTERNAL_API_KEY
  if (!expected) {
    console.error(
      "[Automation] INTERNAL_API_KEY is not set — every event trigger will be " +
      "rejected. Set it in the deployment environment and redeploy."
    )
    return false
  }
  const key = req.headers.get("x-internal-key")
  if (key !== expected) {
    console.warn("[Automation] event trigger rejected: bad or missing x-internal-key")
    return false
  }
  return true
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
  // Honour the cron's trigger: the weekly and monthly crons must not re-run the
  // whole daily batch, and monthly rules only fire on the monthly schedule.
  const trig = (new URL(req.url).searchParams.get("trigger") || "SCHEDULE_DAILY").toUpperCase()
  const kind = trig.includes("MONTHLY") ? "monthly" : trig.includes("WEEKLY") ? "weekly" : "daily"

  const counts = await runScheduledScans(new Date(), kind)
  if (kind !== "daily") {
    return NextResponse.json({ ok: true, kind, counts })
  }
  await reconcileAllEV().catch(() => {})
  // Every sub-job reports: a blind `.catch(() => {})` hid a broken verification
  // reminder for days — silent failure is worse than a loud one in a cron.
  const jobs: Record<string, any> = {}
  const run = async (name: string, fn: () => Promise<any>) => {
    try { jobs[name] = (await fn()) ?? "ok" }
    catch (e: any) {
      jobs[name] = `ERROR: ${e?.message || String(e)}`
      console.error(`[Automation] ${name} failed:`, e)
    }
  }
  await run("contractAlerts",  () => runContractAlerts())
  await run("recurringBudget", () => postRecurringBudgetItems())
  await run("laborActuals",    () => postLaborActuals())
  await run("verifyReminders", () => sendVerificationReminders())
  console.log("[Automation] daily jobs:", JSON.stringify(jobs))
  return NextResponse.json({ ok: !!counts, kind, counts, jobs })
}
