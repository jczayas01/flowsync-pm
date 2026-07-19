// src/app/api/cron/trial-reminders/route.ts
// Daily (13:00 UTC / 9am AST): the two promised trial emails.
//   T-7  — "your trial ends in a week"
//   T-0  — "your trial ends today"
// Sent to OWNER/ADMIN members of FREE workspaces. Deduped via AuditLog markers
// (trial.email7 / trial.email0), so re-runs and retries never double-send.
// If CRON_SECRET is set, requests must include ?secret=... (or Bearer).
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/emails/templates"
import { SITE_URL } from "@/lib/site-url"

function windowFor(daysFromNow: number): { gte: Date; lt: Date } {
  const start = new Date(); start.setUTCHours(0, 0, 0, 0)
  const gte = new Date(start.getTime() + daysFromNow * 86_400_000)
  return { gte, lt: new Date(gte.getTime() + 86_400_000) }
}

function trialEmailHtml(kind: "week" | "today", name: string, wsName: string, endDate: string) {
  const headline = kind === "week"
    ? `Your FlowSync PM trial ends in 7 days`
    : `Your FlowSync PM trial ends today`
  const body = kind === "week"
    ? `Your free trial of <strong>${wsName}</strong> ends on <strong>${endDate}</strong>. Nothing is charged unless you subscribe — and if you subscribe now, your card still isn't charged until the trial actually ends, so there's no reason to wait.`
    : `Today is the last day of your free trial for <strong>${wsName}</strong>. After today the workspace becomes read-only: your data stays safe and exportable, but editing stops until you subscribe. No charges happen either way.`
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <div style="font-size:18px;font-weight:700;color:#0D1B2A;margin-bottom:12px">${headline}</div>
    <p style="font-size:14px;color:#334155;line-height:1.65">Hi ${name},</p>
    <p style="font-size:14px;color:#334155;line-height:1.65">${body}</p>
    <a href="${SITE_URL}/settings/billing"
      style="display:inline-block;background:#F59E0B;color:#0D1B2A;padding:11px 22px;border-radius:8px;
      font-weight:700;font-size:14px;text-decoration:none;margin:14px 0">Choose a plan →</a>
    <p style="font-size:12px;color:#94A3B8;line-height:1.6">Questions? Just reply — a human reads this inbox.<br/>— Juan, founder of FlowSync PM</p>
  </div>`
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const provided = new URL(req.url).searchParams.get("secret") ||
      (req.headers.get("authorization") || "").replace("Bearer ", "")
    if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: Record<string, number> = { week: 0, today: 0 }

  for (const [kind, days, marker] of [["week", 7, "trial.email7"], ["today", 0, "trial.email0"]] as const) {
    const win = windowFor(days)
    const workspaces = await db.workspace.findMany({
      where: { plan: "FREE", trialEndsAt: { gte: win.gte, lt: win.lt } },
      select: {
        id: true, name: true, trialEndsAt: true,
        members: {
          where: { role: { in: ["OWNER", "ADMIN"] } },
          select: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    })

    for (const ws of workspaces) {
      const already = await db.auditLog.findFirst({
        where: { workspaceId: ws.id, action: marker }, select: { id: true },
      })
      if (already) continue

      const endDate = ws.trialEndsAt!.toLocaleDateString("en-US",
        { month: "long", day: "numeric", year: "numeric" })

      for (const m of ws.members) {
        if (!m.user.email) continue
        await sendEmail({
          to: m.user.email,
          subject: kind === "week"
            ? `Your FlowSync PM trial ends in 7 days`
            : `Last day of your FlowSync PM trial`,
          html: trialEmailHtml(kind, m.user.name || "there", ws.name, endDate),
        })
      }

      await db.auditLog.create({ data: {
        workspaceId: ws.id,
        userId: ws.members[0]?.user.id || "system",
        action: marker, entityType: "workspace", entityId: ws.id,
      }}).catch(() => {})
      results[kind]++
    }
  }

  return NextResponse.json({ data: { sent: results } })
}
