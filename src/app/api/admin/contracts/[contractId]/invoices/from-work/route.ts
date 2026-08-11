// src/app/api/admin/contracts/[contractId]/invoices/from-work/route.ts
// Turn logged work into an invoice: select unbilled service entries and completed
// onboarding milestones, and get one ContractInvoice with those rows attached and
// flipped to INVOICED — in a single transaction, so a partial failure can never
// leave work marked billed against an invoice that doesn't exist.
//
// The amount is computed server-side from the selected rows. It is deliberately
// NOT taken from the request: a client-supplied total is a client-supplied
// invoice, and this is the one place in the product where a wrong number is
// money out the door.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/admin-gate"

const bodySchema = z.object({
  entryIds:     z.array(z.string()).default([]),
  milestoneIds: z.array(z.string()).default([]),
  number:       z.string().min(1).max(100),
  issueDate:    z.string(),
  dueDate:      z.string(),
  notes:        z.string().max(2000).optional().nullable(),
  // Prepaid hours bundle (e.g. 10 h at $125): each whole bundle of selected
  // service hours is billed at the bundle price instead of hours × rate.
  applyBundle:  z.boolean().default(false),
  // Courtesy invoice — first-customer freebie: work is marked INVOICED and the
  // paper trail exists, but the total is $0.
  courtesy:     z.boolean().default(false),
})

const n = (v: any) => Number(v ?? 0)

/** Preview: what would be billed, and what it would come to. */
export async function GET(_req: NextRequest, { params }: { params: { contractId: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const [entries, milestones, contract, invoicedAgg] = await Promise.all([
    db.contractServiceEntry.findMany({
      where:   { contractId: params.contractId, billable: true, status: { in: ["DRAFT", "APPROVED"] } },
      orderBy: { entryDate: "asc" },
    }),
    db.contractOnboardingMilestone.findMany({
      where:   { contractId: params.contractId, status: "COMPLETED" },
      orderBy: [{ sortOrder: "asc" }],
    }),
    db.customerContract.findUnique({
      where: { id: params.contractId },
      select: { currency: true, serviceHourlyRate: true,
                serviceBundleHours: true, serviceBundlePrice: true,
                serviceDiscountPct: true, bundleInOnboarding: true } as any,
    }) as any,
    db.contractServiceEntry.aggregate({
      where: { contractId: params.contractId, status: "INVOICED", billable: true },
      _sum: { hours: true },
    }),
  ])

  return NextResponse.json({
    data: {
      currency: contract?.currency || "USD",
      serviceHourlyRate:  contract?.serviceHourlyRate  == null ? null : n(contract.serviceHourlyRate),
      serviceBundleHours: contract?.serviceBundleHours == null ? null : n(contract.serviceBundleHours),
      serviceBundlePrice: contract?.serviceBundlePrice == null ? null : n(contract.serviceBundlePrice),
      serviceDiscountPct: contract?.serviceDiscountPct == null ? null : n(contract.serviceDiscountPct),
      bundleInOnboarding: !!contract?.bundleInOnboarding,
      hoursAlreadyInvoiced: n(invoicedAgg?._sum?.hours),
      entries: entries.map(e => ({
        id: e.id, entryDate: e.entryDate, category: e.category, description: e.description,
        hours: n(e.hours), rate: n(e.rate), amount: n(e.amount), status: e.status,
      })),
      milestones: milestones.map(m => ({
        id: m.id, name: m.name, amount: n(m.amount), completedDate: m.completedDate,
      })),
      total: entries.reduce((s, e) => s + n(e.amount), 0)
           + milestones.reduce((s, m) => s + n(m.amount), 0),
    },
  })
}

export async function POST(req: NextRequest, { params }: { params: { contractId: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data

  if (!d.entryIds.length && !d.milestoneIds.length) {
    return NextResponse.json({ error: "Select at least one service entry or milestone to bill." }, { status: 400 })
  }

  const contract = await db.customerContract.findUnique({
    where: { id: params.contractId },
    select: { id: true, currency: true, serviceBundleHours: true,
              serviceBundlePrice: true, serviceDiscountPct: true,
              bundleInOnboarding: true } as any,
  }) as any
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 })

  try {
    const result = await db.$transaction(async (tx: any) => {
      // Re-read inside the transaction and re-check eligibility. Two admins
      // billing the same work at once would otherwise both succeed, and the
      // second invoice would silently steal the rows off the first.
      const entries = d.entryIds.length
        ? await tx.contractServiceEntry.findMany({
            where: { id: { in: d.entryIds }, contractId: params.contractId },
          })
        : []
      const milestones = d.milestoneIds.length
        ? await tx.contractOnboardingMilestone.findMany({
            where: { id: { in: d.milestoneIds }, contractId: params.contractId },
          })
        : []

      if (entries.length !== d.entryIds.length || milestones.length !== d.milestoneIds.length) {
        throw new Error("NOT_FOUND")
      }
      const badEntry = entries.find(
        (e: any) => e.status === "INVOICED" || e.status === "WRITTEN_OFF" || !e.billable)
      if (badEntry) throw new Error("ENTRY_NOT_BILLABLE")
      const badMs = milestones.find((m: any) => m.status !== "COMPLETED")
      if (badMs) throw new Error("MILESTONE_NOT_READY")

      const grossAmount = Math.round(
        (entries.reduce((s: number, e: any) => s + n(e.amount), 0)
       + milestones.reduce((s: number, m: any) => s + n(m.amount), 0)) * 100) / 100

      const r2 = (x: number) => Math.round(x * 100) / 100
      const svcHours  = entries.reduce((s: number, e: any) => s + n(e.hours), 0)
      const svcAmount = entries.reduce((s: number, e: any) => s + n(e.amount), 0)
      const avgRate   = svcHours > 0 ? svcAmount / svcHours : 0
      const bH = n(contract.serviceBundleHours)
      const bP = contract.serviceBundlePrice == null ? null : n(contract.serviceBundlePrice)

      // (1) Onboarding includes the first bH service hours free — a one-time
      // allowance measured against hours already INVOICED on this contract,
      // re-read inside the transaction so two simultaneous invoices can't
      // both claim it.
      let freeHours = 0, freeDisc = 0
      if (contract.bundleInOnboarding && bH > 0 && svcHours > 0) {
        const used = await tx.contractServiceEntry.aggregate({
          where: { contractId: params.contractId, status: "INVOICED", billable: true },
          _sum: { hours: true },
        })
        freeHours = Math.min(svcHours, Math.max(0, bH - n(used?._sum?.hours)))
        freeDisc  = r2(freeHours * avgRate)
      }

      // (2) Prepaid bundle on the hours that remain chargeable: pay the
      // bundle price instead of hours × rate. Never negative.
      let bundleDisc = 0, bundleCount = 0
      const chargeableHours = svcHours - freeHours
      if (d.applyBundle && bH > 0 && bP != null && chargeableHours > 0) {
        bundleCount = Math.floor(chargeableHours / bH)
        if (bundleCount > 0) {
          bundleDisc = Math.max(0, r2(bundleCount * (bH * avgRate - bP)))
        }
      }

      // (3) Negotiated service % on the service value still being charged.
      const pct = contract.serviceDiscountPct == null ? 0 : n(contract.serviceDiscountPct)
      const svcCharged = Math.max(0, svcAmount - freeDisc - bundleDisc)
      const pctDisc = pct > 0 ? r2(svcCharged * pct / 100) : 0

      const discount = r2(freeDisc + bundleDisc + pctDisc)
      const amount = d.courtesy ? 0 : Math.max(0, r2(grossAmount - discount))

      const noteLines: string[] = []
      if (d.notes) noteLines.push(d.notes)
      if (freeDisc > 0) noteLines.push(
        `Onboarding: ${freeHours} h incluidas / included → −${freeDisc.toFixed(2)}`)
      if (bundleDisc > 0) noteLines.push(
        `Bundle: ${bundleCount} × ${bH} h @ ${bP} → −${bundleDisc.toFixed(2)}`)
      if (pctDisc > 0) noteLines.push(
        `Descuento servicio / Service discount ${pct}% → −${pctDisc.toFixed(2)}`)
      if (d.courtesy) noteLines.push(`Cortesía / Courtesy — ${grossAmount.toFixed(2)} waived`)

      const invoice = await tx.contractInvoice.create({
        data: {
          contractId: params.contractId,
          number:     d.number,
          amount,
          currency:   contract.currency || "USD",
          issueDate:  new Date(d.issueDate),
          dueDate:    new Date(d.dueDate),
          status:     "DRAFT",
          notes:      noteLines.length ? noteLines.join("\n") : null,
        },
      })

      if (entries.length) {
        await tx.contractServiceEntry.updateMany({
          where: { id: { in: entries.map((e: any) => e.id) } },
          data:  { status: "INVOICED", invoiceId: invoice.id },
        })
      }
      if (milestones.length) {
        await tx.contractOnboardingMilestone.updateMany({
          where: { id: { in: milestones.map((m: any) => m.id) } },
          data:  { status: "INVOICED", invoiceId: invoice.id },
        })
      }

      return { id: invoice.id, amount, entries: entries.length, milestones: milestones.length }
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (e: any) {
    const map: Record<string, [string, number]> = {
      NOT_FOUND:            ["Some of the selected work no longer exists on this contract.", 404],
      ENTRY_NOT_BILLABLE:   ["Some selected entries are already invoiced, written off, or non-billable.", 409],
      MILESTONE_NOT_READY:  ["Only completed milestones can be billed.", 409],
    }
    const hit = map[e?.message]
    if (hit) return NextResponse.json({ error: hit[0] }, { status: hit[1] })
    // A duplicate invoice number is the likeliest real-world failure here.
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "That invoice number is already in use." }, { status: 409 })
    }
    console.error("[CLM] from-work invoice failed", e)
    return NextResponse.json({ error: "Couldn't create the invoice." }, { status: 500 })
  }
}
