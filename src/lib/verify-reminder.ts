// src/lib/verify-reminder.ts
// One polite verification reminder, sent by the daily cron to accounts that
// registered 24h–14d ago and never clicked their link. Exactly one per user
// (stamped via User.verifyReminderAt) — we nudge once, we don't nag.

import { db } from "@/lib/db"
import { createVerificationToken, sendVerificationEmail } from "@/lib/auth/verification"
import { sendEmail } from "@/lib/emails/templates"

const DAY = 864e5

export type VerifyReminderResult = { candidates: number; sent: number; failures: string[] }

export async function sendVerificationReminders(): Promise<VerifyReminderResult> {
  const now = Date.now()
  // No blind catch here: if this query fails (missing column, stale client),
  // the caller must see the error instead of a silent "0 users".
  const users = await db.user.findMany({
    where: {
      emailVerified:    null,
      verifyReminderAt: null,
      createdAt: { lt: new Date(now - 1 * DAY), gt: new Date(now - 14 * DAY) },
    },
    select: { id: true, email: true, name: true },
    take: 100,
  })

  const failures: string[] = []
  let sent = 0
  for (const u of users) {
    try {
      const raw = await createVerificationToken(u.id)
      const base = process.env.NEXT_PUBLIC_APP_URL || "https://flowsyncpm.com"
      const link = `${base}/api/auth/verify-email?token=${raw}`
      const first = (u.name || "").split(" ")[0] || "there"
      const ok = await sendEmail({
        to: u.email,
        subject: "Your FlowSync PM account is one click away",
        html: `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1E293B">
  <div style="padding:22px 0 14px">
    <span style="font-size:20px;font-weight:800;color:#0D1B2A">FlowSync <span style="color:#F59E0B">PM</span></span>
  </div>
  <p style="font-size:15px;line-height:1.6">Hi ${first},</p>
  <p style="font-size:15px;line-height:1.6">You created a FlowSync PM account but the email was never confirmed —
  it may have landed in your spam folder. One click finishes it:</p>
  <p style="margin:26px 0">
    <a href="${link}" style="background:#1B6CA8;color:#fff;text-decoration:none;
      padding:12px 22px;border-radius:8px;font-size:14px;font-weight:700">Confirm my email</a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#64748B">Once confirmed you can sign in, create your workspace,
  and import your first project from a Word, Excel or PDF document — the AI builds it for you.
  Your free 2-month trial starts when you do.</p>
  <p style="font-size:12px;color:#94A3B8">If you didn't create this account, you can ignore this email —
  we won't write again.</p>
</div>`,
      })
      if (ok) {
        // Stamp only on a real send — a failed send must stay retryable.
        await db.user.update({ where: { id: u.id }, data: { verifyReminderAt: new Date() } })
        sent++
      } else {
        failures.push(`${u.email}: email provider rejected the send`)
      }
    } catch (e: any) {
      failures.push(`${u.email}: ${e?.message || String(e)}`)
      console.error("[VerifyReminder] failed for", u.email, e)
    }
  }
  const result = { candidates: users.length, sent, failures }
  console.log("[VerifyReminder]", JSON.stringify(result))
  return result
}
