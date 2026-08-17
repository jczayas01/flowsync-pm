// src/app/api/admin/contracts/[contractId]/invoices/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/admin-gate"

const createSchema = z.object({
  number:    z.string().min(1).max(100),
  amount:    z.number().min(0),
  currency:  z.string().default("USD"),
  issueDate: z.string(),
  dueDate:   z.string(),
  paidDate:  z.string().optional().nullable(),
  status:    z.enum(["DRAFT","SENT","PAID","OVERDUE","VOID"]).default("DRAFT"),
  notes:     z.string().max(2000).optional().nullable(),
  lines:     z.array(z.object({ label: z.string().max(200), qty: z.number(), unit: z.number(),
               unitLabel: z.string().max(20).optional(), period: z.string().max(40).optional(),
               amount: z.number() })).max(50).optional(),
})

/** List invoices with the work each one billed, so the record can show provenance. */
export async function GET(_req: NextRequest, { params }: { params: { contractId: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const invoices = await db.contractInvoice.findMany({
    where:   { contractId: params.contractId },
    orderBy: { issueDate: "desc" },
    include: {
      serviceEntries:       { select: { id: true } },
      onboardingMilestones: { select: { id: true } },
    },
  })
  return NextResponse.json({
    data: invoices.map(i => ({ ...i, amount: Number(i.amount) })),
  })
}

export async function POST(req: NextRequest, { params }: { params: { contractId: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data
  const contract = await db.customerContract.findUnique({
    where: { id: params.contractId }, select: { id: true } })
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 })

  const inv = await db.contractInvoice.create({
    data: {
      contractId: params.contractId,
      ...d,
      issueDate: new Date(d.issueDate),
      dueDate:   new Date(d.dueDate),
      paidDate:  d.paidDate ? new Date(d.paidDate) : null,
    },
  })
  return NextResponse.json({ data: { id: inv.id } }, { status: 201 })
}
