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
                serviceDiscountPct: true, bundleInOnboarding: true,
                serviceRetainerPackages: true } as any,
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
      poolHours: (n(contract?.serviceRetainerPackages) + (contract?.bundleInOnboarding ? 1 : 0)) * n(contract?.serviceBundleHours),
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
              bundleInOnboarding: true, serviceRetainerPackages: true,
              serviceHourlyRate: true } as any,
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

      // ── Prepaid service model ──────────────────────────────────────────
      // The contract prepaid N blocks of bH hours (+1 free block if onboarding
      // includes it). Hours are consumed across the term. Anything within the
      // prepaid pool bills $0 here (already paid up front). Overage is billed in
      // WHOLE additional blocks at the block price (hours × rate × (1 − disc)),
      // never hour by hour. Pool usage is re-read inside the transaction so two
      // simultaneous invoices can't both draw the same hours.
      const blocksPurchased = n(contract.serviceRetainerPackages) + (contract.bundleInOnboarding ? 1 : 0)
      const poolHours = bH > 0 ? blocksPurchased * bH : 0
      const svcPct = contract.serviceDiscountPct == null ? 0 : n(contract.serviceDiscountPct)
      const blockPrice = r2(bH * n(contract.serviceHourlyRate) * (1 - svcPct / 100))

      let coveredHours = 0, coveredDisc = 0, overHours = 0, overBlocks = 0, overCharge = 0
      let legacyPctDisc = 0
      if (poolHours > 0 && svcHours > 0) {
        const used = await tx.contractServiceEntry.aggregate({
          where: { contractId: params.contractId, status: "INVOICED", billable: true },
          _sum: { hours: true },
        })
        const alreadyUsed = n(used?._sum?.hours)
        const poolLeft = Math.max(0, poolHours - alreadyUsed)
        coveredHours = Math.min(svcHours, poolLeft)
        coveredDisc  = r2(coveredHours * avgRate)          // waive: prepaid already
        overHours    = svcHours - coveredHours
        if (overHours > 0) {
          // Bill whole blocks; the block covers overHours plus any remainder up
          // to the block boundary (which then sits in the pool for next time).
          overBlocks = Math.ceil(overHours / bH)
          overCharge = r2(overBlocks * blockPrice)
        }
      } else if (svcHours > 0 && svcPct > 0) {
        // No prepaid pool on this contract: plain hourly billing with the
        // negotiated service discount.
        legacyPctDisc = r2(svcAmount * svcPct / 100)
      }

      // Service portion of the invoice = overage blocks (or hourly if no pool);
      // milestones bill as before.
      const msAmount = milestones.reduce((s: number, m: any) => s + n(m.amount), 0)
      const serviceCharge = poolHours > 0 ? overCharge : r2(svcAmount - legacyPctDisc)
      const amount = d.courtesy ? 0 : Math.max(0, r2(serviceCharge + msAmount))

      const noteLines: string[] = []
      if (d.notes) noteLines.push(d.notes)
      if (coveredHours > 0) noteLines.push(
        `Horas prepagadas / Prepaid hours: ${coveredHours} h covered by contract pool (${poolHours} h)`)
      if (overBlocks > 0) noteLines.push(
        `Exceso / Overage: ${overHours} h → ${overBlocks} × ${bH} h block @ ${blockPrice.toFixed(2)}${svcPct > 0 ? ` (−${svcPct}%)` : ""} = ${overCharge.toFixed(2)}`)
      if (legacyPctDisc > 0) noteLines.push(
        `Descuento servicio / Service discount ${svcPct}% → −${legacyPctDisc.toFixed(2)}`)
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
