// src/app/api/admin/contracts/[contractId]/invoices/[invoiceId]/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/admin-gate"

const patchSchema = z.object({
  number:    z.string().min(1).max(100).optional(),
  amount:    z.number().min(0).optional(),
  currency:  z.string().optional(),
  issueDate: z.string().optional(),
  dueDate:   z.string().optional(),
  paidDate:  z.string().optional().nullable(),
  status:    z.enum(["DRAFT","SENT","PAID","OVERDUE","VOID"]).optional(),
  notes:     z.string().max(2000).optional().nullable(),
})

export async function PATCH(req: NextRequest,
  { params }: { params: { contractId: string; invoiceId: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data
  try {
    // Marking PAID without an explicit paidDate stamps today.
    const paidDate =
      d.paidDate !== undefined ? (d.paidDate ? new Date(d.paidDate) : null)
      : d.status === "PAID" ? new Date()
      : undefined
    await db.contractInvoice.update({
      where: { id: params.invoiceId },
      data: {
        ...d,
        issueDate: d.issueDate === undefined ? undefined : new Date(d.issueDate),
        dueDate:   d.dueDate   === undefined ? undefined : new Date(d.dueDate),
        paidDate,
      },
    })
    return NextResponse.json({ data: { id: params.invoiceId } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Update failed" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest,
  { params }: { params: { contractId: string; invoiceId: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await db.contractInvoice.delete({ where: { id: params.invoiceId } }).catch(() => {})
  return NextResponse.json({ data: { deleted: true } })
}
