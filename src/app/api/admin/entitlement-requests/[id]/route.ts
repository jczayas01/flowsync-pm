// src/app/api/admin/entitlement-requests/[id]/route.ts
// PATCH { action: "approve" | "reject", note? }
// Approve applies the growth where the truth lives:
//   contract-sourced → increments the ACTIVE contract's quantities
//   plan-sourced     → increments the workspace fields
// and emails the requester either way. Rejection just records + emails.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/admin-gate"
import { sendEmail } from "@/lib/emails/templates"
import { incrementInvoiceLines, sumLines } from "@/lib/contract-math"

const schema = z.object({ action: z.enum(["approve", "reject"]), note: z.string().max(500).optional().nullable() })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

  const r = await (db as any).entitlementRequest.findUnique({
    where: { id: params.id }, include: { workspace: { select: { name: true } } },
  })
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (r.status !== "PENDING") return NextResponse.json({ error: "Already decided" }, { status: 409 })

  let invoice: { id: string; number: string; amount: number } | null = null

  if (parsed.data.action === "approve") {
    if (r.contractId) {
      const c = await db.customerContract.findUnique({ where: { id: r.contractId } }) as any
      if (c) {
        const data: any = {}
        if (r.kind === "SEATS")      data.paidSeats = (c.paidSeats || 0) + r.quantity
        if (r.kind === "BUNDLES")    data.contributorBundles = (c.contributorBundles || 0) + r.quantity
        if (r.kind === "OCR_BLOCKS") data.ocrPageCap = (c.ocrPageCap || 200) + 200 * r.quantity
        await db.customerContract.update({ where: { id: r.contractId }, data })

        // Draft the increment invoice right here — prorated over the months
        // remaining (request month included), same math the composer uses.
        // Approving without billing was the gap: the entitlement grew and the
        // invoice waited on somebody remembering to issue it.
        try {
          const add = {
            seats:         r.kind === "SEATS"      ? r.quantity : 0,
            bundles:       r.kind === "BUNDLES"    ? r.quantity : 0,
            ocrPacks:      r.kind === "OCR_BLOCKS" ? r.quantity : 0,
            serviceBlocks: 0,
          }
          const asOf = new Date(r.createdAt)   // bill from the request date
          const lines = incrementInvoiceLines(c, add, asOf)
          const amount = sumLines(lines)
          if (amount > 0) {
            const labels: Record<string, string> = {
              seats: "Paid seats", bundles: "Contributor bundles (×10)",
              ocr: "Extra OCR packs (+200 pg/mo)", service: "Prepaid service block",
            }
            const n = new Date()
            const number = `FSPM-${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}${String(n.getDate()).padStart(2,"0")}-${String(n.getHours()).padStart(2,"0")}${String(n.getMinutes()).padStart(2,"0")}`
            const inv = await db.contractInvoice.create({
              data: {
                contractId: r.contractId,
                number, amount,
                currency: c.currency || "USD",
                issueDate: asOf,
                dueDate: new Date(asOf.getTime() + 30 * 864e5),
                status: "DRAFT",
                notes: `Increment — approved entitlement request (+${r.quantity} ${String(r.kind).toLowerCase()})`,
                lines: lines.map(l => ({ label: labels[l.item] || l.item, qty: l.qty, unit: l.unit,
                  unitLabel: l.unitLabel, period: l.period, amount: l.amount })),
              } as any,
            })
            invoice = { id: inv.id, number: inv.number, amount }
          }
        } catch { /* entitlement already applied — the invoice can be issued from the record */ }
      }
    } else {
      const w = await db.workspace.findUnique({ where: { id: r.workspaceId },
        select: { seats: true, contributorBundles: true, ocrPageAddons: true } as any }) as any
      const data: any = {}
      if (r.kind === "SEATS")      data.seats = (w?.seats || 0) + r.quantity
      if (r.kind === "BUNDLES")    data.contributorBundles = (w?.contributorBundles || 0) + r.quantity
      if (r.kind === "OCR_BLOCKS") data.ocrPageAddons = (w?.ocrPageAddons || 0) + r.quantity
      await db.workspace.update({ where: { id: r.workspaceId }, data })
    }
  }

  const upd = await (db as any).entitlementRequest.update({
    where: { id: params.id },
    data: { status: parsed.data.action === "approve" ? "APPROVED" : "REJECTED",
            approvedById: (session as any).user?.id || null, decidedAt: new Date(),
            decisionNote: parsed.data.note || null },
  })

  // Notify requester
  const requester = await db.user.findUnique({ where: { id: r.requestedById }, select: { email: true, name: true } })
  if (requester?.email) {
    const label = { SEATS: "seat(s)", BUNDLES: "contributor bundle(s)", OCR_BLOCKS: "OCR pack(s)" }[r.kind as string] || r.kind
    const ok = parsed.data.action === "approve"
    await sendEmail({
      to: requester.email,
      subject: `[FlowSync] Your request for +${r.quantity} ${label} was ${ok ? "approved" : "not approved"}`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#0D1B2A">
        <p>Hi ${requester.name || ""},</p>
        <p>Your request for <b>+${r.quantity} ${label}</b> on <b>${r.workspace?.name}</b> was
           <b>${ok ? "approved and is now active" : "not approved"}</b>.</p>
        ${parsed.data.note ? `<p style="color:#64748B">${parsed.data.note}</p>` : ""}
        ${ok && invoice ? `<p>A draft invoice <b>${invoice.number}</b> for $${invoice.amount.toLocaleString("en-US")} has been prepared, prorated for the remaining term. You'll receive it shortly.</p>` : ok && r.contractId ? "<p>The increment will appear on your next invoice, prorated for the remaining term.</p>" : ""}
        <p>— FlowSync PM</p></div>`,
    }).catch(() => {})
  }
  return NextResponse.json({ data: { id: upd.id, status: upd.status, invoice } })
}
