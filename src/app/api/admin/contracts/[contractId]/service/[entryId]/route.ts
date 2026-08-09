// src/app/api/admin/contracts/[contractId]/service/[entryId]/route.ts
// Update / delete a service entry.
// NOTE: every field the create route accepts is writable here too — the
// "validated but never written" bug has bitten this project repeatedly when the
// two routes drifted apart. If you add a field, add it in BOTH places.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/admin-gate"

const CATEGORIES = ["ONBOARDING", "TRAINING", "SERVICE_REQUEST", "CHANGE_CONFIG"] as const
const STATUSES = ["DRAFT", "APPROVED", "INVOICED", "WRITTEN_OFF"] as const

const patchSchema = z.object({
  entryDate:   z.string().optional(),
  category:    z.enum(CATEGORIES).optional(),
  description: z.string().min(1).max(1000).optional(),
  hours:       z.number().min(0).max(9999).optional(),
  rate:        z.number().min(0).optional().nullable(),
  billable:    z.boolean().optional(),
  status:      z.enum(STATUSES).optional(),
  performedBy: z.string().max(200).optional().nullable(),
  notes:       z.string().max(3000).optional().nullable(),
  invoiceId:   z.string().optional().nullable(),
})

const ser = (e: any) => ({ ...e, hours: Number(e.hours), rate: Number(e.rate), amount: Number(e.amount) })

export async function PATCH(
  req: NextRequest,
  { params }: { params: { contractId: string; entryId: string } },
) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data

  const existing = await db.contractServiceEntry.findFirst({
    where: { id: params.entryId, contractId: params.contractId },
  })
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  const hours    = d.hours    ?? Number(existing.hours)
  const rate     = d.rate     ?? Number(existing.rate)
  const billable = d.billable ?? existing.billable
  const amount   = billable ? Number((hours * rate).toFixed(2)) : 0

  const entry = await db.contractServiceEntry.update({
    where: { id: params.entryId },
    data: {
      ...(d.entryDate   !== undefined ? { entryDate: new Date(d.entryDate) } : {}),
      ...(d.category    !== undefined ? { category: d.category } : {}),
      ...(d.description !== undefined ? { description: d.description } : {}),
      ...(d.performedBy !== undefined ? { performedBy: d.performedBy || null } : {}),
      ...(d.notes       !== undefined ? { notes: d.notes || null } : {}),
      ...(d.status      !== undefined ? { status: d.status } : {}),
      ...(d.invoiceId   !== undefined ? { invoiceId: d.invoiceId || null } : {}),
      hours, rate, billable, amount,
    },
  })
  return NextResponse.json({ data: { entry: ser(entry) } })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { contractId: string; entryId: string } },
) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const existing = await db.contractServiceEntry.findFirst({
    where:  { id: params.entryId, contractId: params.contractId },
    select: { id: true, status: true },
  })
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 })
  if (existing.status === "INVOICED") {
    return NextResponse.json(
      { error: "This entry has already been invoiced. Void or amend the invoice instead." },
      { status: 409 },
    )
  }

  await db.contractServiceEntry.delete({ where: { id: params.entryId } })
  return NextResponse.json({ data: { ok: true } })
}
