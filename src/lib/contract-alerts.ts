// src/lib/contract-alerts.ts
// Daily contract lifecycle checks, called from the cron GET handler
// (deliberately outside the automation-rules engine — always runs).
//
// 1. Expiration / renewal alerting: ACTIVE contracts whose endDate (or
//    renewalDate, whichever is sooner) falls within alertDays → email the
//    platform admins. Re-alerts at most every 7 days (lastAlertAt).
// 2. Invoice hygiene: SENT invoices past dueDate → OVERDUE.

import { db } from "@/lib/db"
import { sendEmail } from "@/lib/emails/templates"

const DAY = 864e5

export async function runContractAlerts(): Promise<{ alerted: number; overdue: number }> {
  const now = Date.now()
  let alerted = 0, overdue = 0

  // ── 1. Expiring / renewal-due contracts ──
  const contracts = await db.customerContract.findMany({
    where: { status: "ACTIVE" },
    include: { workspace: { select: { name: true } } },
  }).catch(() => [])

  const admins = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",").map(e => e.trim()).filter(Boolean)

  for (const c of contracts) {
    const anchor = Math.min(
      c.endDate.getTime(),
      c.renewalDate ? c.renewalDate.getTime() : Infinity,
    )
    const daysLeft = Math.ceil((anchor - now) / DAY)
    const withinWindow = daysLeft <= c.alertDays
    const recentlyAlerted = c.lastAlertAt && now - c.lastAlertAt.getTime() < 7 * DAY
    if (!withinWindow || recentlyAlerted || !admins.length) continue

    const which = c.renewalDate && c.renewalDate.getTime() === anchor ? "renewal decision" : "expiration"
    const dateStr = new Date(anchor).toLocaleDateString("en-US",
      { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })

    for (const to of admins) {
      await sendEmail({
        to,
        subject: `[FlowSync CLM] ${c.workspace.name}: contract ${which} in ${Math.max(daysLeft, 0)} days`,
        html: `<p>Contract <b>${c.name}</b> for customer <b>${c.workspace.name}</b> reaches its ${which} date on <b>${dateStr}</b> (${Math.max(daysLeft, 0)} days).</p>
<p>Seats: ${c.paidSeats} · Contributor bundles: ${c.contributorBundles} · ${c.billingCycle} ${c.amount ? `$${Number(c.amount).toLocaleString()}` : ""} · Auto-renew: ${c.autoRenew ? "yes" : "no"}</p>
<p>Manage it in Platform Admin → Contracts.</p>`,
      }).catch(() => {})
    }
    await db.customerContract.update({
      where: { id: c.id }, data: { lastAlertAt: new Date() },
    }).catch(() => {})
    alerted++
  }

  // ── 2. Overdue invoices ──
  const res = await db.contractInvoice.updateMany({
    where: { status: "SENT", dueDate: { lt: new Date() } },
    data:  { status: "OVERDUE" },
  }).catch(() => ({ count: 0 }))
  overdue = res.count

  return { alerted, overdue }
}
