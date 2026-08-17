// src/app/api/admin/contracts/portfolio/route.ts
// CLM portfolio rollup — the numbers behind the command center.
// One query pass, computed server-side so the client never re-derives money.
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/admin-gate"

const DAY = 864e5
const n = (v: any) => (v == null ? 0 : Number(v))

/** Annualised contract value. MONTHLY contracts are ×12; ANNUAL taken as-is. */
function annualised(amount: number, cycle: string) {
  return cycle === "MONTHLY" ? amount * 12 : amount
}

export async function GET() {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const contracts = await db.customerContract.findMany({
    orderBy: { endDate: "asc" },
    include: {
      workspace: { select: { id: true, name: true, slug: true, plan: true } },
      invoices:  { select: { id: true, amount: true, status: true, dueDate: true, paidDate: true } },
      serviceEntries: {
        select: { id: true, hours: true, amount: true, billable: true, status: true, category: true },
      },
      onboardingMilestones: { select: { id: true, amount: true, status: true } },
      _count: { select: { documents: true } },
    },
  })

  const now = Date.now()

  const rows = contracts.map(c => {
    const amount = n(c.amount)
    const acv = annualised(amount, c.billingCycle)

    // Renewal anchor: whichever comes first, the renewal decision or the end date.
    const anchor = Math.min(
      new Date(c.endDate).getTime(),
      c.renewalDate ? new Date(c.renewalDate).getTime() : Infinity,
    )
    const daysToRenewal = Math.ceil((anchor - now) / DAY)

    const overdueInvoices = c.invoices.filter(
      i => !i.paidDate && i.status !== "VOID" && i.status !== "PAID" && new Date(i.dueDate).getTime() < now,
    )
    const overdueAmount = overdueInvoices.reduce((s, i) => s + n(i.amount), 0)

    // Unbilled = billable work that has not yet reached an invoice.
    const unbilled = c.serviceEntries.filter(
      e => e.billable && (e.status === "DRAFT" || e.status === "APPROVED"),
    )
    const unbilledAmount = unbilled.reduce((s, e) => s + n(e.amount), 0)
    const unbilledHours  = unbilled.reduce((s, e) => s + n(e.hours), 0)

    const onbTotal = c.onboardingMilestones.reduce((s, m) => s + n(m.amount), 0)
    const onbBilled = c.onboardingMilestones
      .filter(m => m.status === "INVOICED")
      .reduce((s, m) => s + n(m.amount), 0)
    const onbReady = c.onboardingMilestones
      .filter(m => m.status === "COMPLETED")
      .reduce((s, m) => s + n(m.amount), 0)

    return {
      id: c.id,
      name: c.name,
      workspace: c.workspace,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      renewalDate: c.renewalDate,
      autoRenew: c.autoRenew,
      alertDays: c.alertDays,
      billingCycle: c.billingCycle,
      currency: c.currency,
      amount,
      acv,
      daysToRenewal,
      inAlertWindow: daysToRenewal >= 0 && daysToRenewal <= c.alertDays,
      expired: daysToRenewal < 0,
      paidSeats: c.paidSeats,
      contributorBundles: c.contributorBundles,
      ocrPageCap: c.ocrPageCap,
      supportTier: c.supportTier,
      responseHours: c.responseHours,
      uptimePct: c.uptimePct == null ? null : Number(c.uptimePct),
      serviceHourlyRate: c.serviceHourlyRate == null ? null : Number(c.serviceHourlyRate),
      // Full pricing surface — the invoice composer, Calculate breakdown and the
      // printable agreement all read from this row. Anything omitted here
      // silently disappears from invoices.
      onboardingFee:           c.onboardingFee == null ? null : Number(c.onboardingFee),
      serviceBundleHours:      c.serviceBundleHours ?? null,
      serviceBundlePrice:      c.serviceBundlePrice == null ? null : Number(c.serviceBundlePrice),
      serviceRetainerPackages: c.serviceRetainerPackages ?? null,
      seatUnitPrice:           c.seatUnitPrice == null ? null : Number(c.seatUnitPrice),
      contributorBundlePrice:  c.contributorBundlePrice == null ? null : Number(c.contributorBundlePrice),
      ocrPackPrice:            c.ocrPackPrice == null ? null : Number(c.ocrPackPrice),
      subscriptionDiscountPct: c.subscriptionDiscountPct == null ? null : Number(c.subscriptionDiscountPct),
      onboardingDiscountPct:   c.onboardingDiscountPct == null ? null : Number(c.onboardingDiscountPct),
      serviceDiscountPct:      c.serviceDiscountPct == null ? null : Number(c.serviceDiscountPct),
      bundleInOnboarding:      !!c.bundleInOnboarding,
      slaNotes: c.slaNotes ?? null,
      notes: c.notes ?? null,
      documentCount: c._count.documents,
      invoiceCount: c.invoices.length,
      overdueCount: overdueInvoices.length,
      overdueAmount,
      unbilledAmount,
      unbilledHours,
      onboarding: { total: onbTotal, billed: onbBilled, readyToBill: onbReady,
                    count: c.onboardingMilestones.length },
    }
  })

  const active = rows.filter(r => r.status === "ACTIVE")

  const summary = {
    total: rows.length,
    byStatus: rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {}),
    // ARR counts ACTIVE contracts only — draft and expired are not revenue.
    arr: active.reduce((s, r) => s + r.acv, 0),
    renewals30: active.filter(r => r.daysToRenewal >= 0 && r.daysToRenewal <= 30).length,
    renewals60: active.filter(r => r.daysToRenewal >= 0 && r.daysToRenewal <= 60).length,
    renewals90: active.filter(r => r.daysToRenewal >= 0 && r.daysToRenewal <= 90).length,
    expiredUnrenewed: rows.filter(r => r.expired && r.status === "ACTIVE").length,
    overdueAmount: rows.reduce((s, r) => s + r.overdueAmount, 0),
    overdueCount:  rows.reduce((s, r) => s + r.overdueCount, 0),
    unbilledAmount: rows.reduce((s, r) => s + r.unbilledAmount, 0),
    unbilledHours:  rows.reduce((s, r) => s + r.unbilledHours, 0),
    onboardingReadyToBill: rows.reduce((s, r) => s + r.onboarding.readyToBill, 0),
  }

  return NextResponse.json({ data: { summary, contracts: rows } })
}
