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

  if (parsed.data.action === "approve") {
    if (r.contractId) {
      const c = await db.customerContract.findUnique({ where: { id: r.contractId },
        select: { paidSeats: true, contributorBundles: true, ocrPageCap: true } })
      if (c) {
        const data: any = {}
        if (r.kind === "SEATS")      data.paidSeats = (c.paidSeats || 0) + r.quantity
        if (r.kind === "BUNDLES")    data.contributorBundles = (c.contributorBundles || 0) + r.quantity
        if (r.kind === "OCR_BLOCKS") data.ocrPageCap = (c.ocrPageCap || 200) + 200 * r.quantity
        await db.customerContract.update({ where: { id: r.contractId }, data })
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
        ${ok && r.contractId ? "<p>The increment will appear on your next invoice, prorated for the remaining term.</p>" : ""}
        <p>— FlowSync PM</p></div>`,
    }).catch(() => {})
  }
  return NextResponse.json({ data: { id: upd.id, status: upd.status } })
}
