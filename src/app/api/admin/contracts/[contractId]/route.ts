// src/app/api/admin/contracts/[contractId]/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/admin-gate"

const patchSchema = z.object({
  name:        z.string().min(1).max(300).optional(),
  status:      z.enum(["DRAFT","ACTIVE","EXPIRED","TERMINATED","RENEWED"]).optional(),
  startDate:   z.string().optional(),
  endDate:     z.string().optional(),
  renewalDate: z.string().optional().nullable(),
  autoRenew:   z.boolean().optional(),
  alertDays:   z.number().int().min(1).max(365).optional(),
  paidSeats:   z.number().int().min(0).optional(),
  contributorBundles: z.number().int().min(0).optional(),
  ocrPageCap:  z.number().int().min(0).optional().nullable(),
  billingCycle: z.enum(["MONTHLY","ANNUAL"]).optional(),
  amount:      z.number().min(0).optional().nullable(),
  currency:    z.string().optional(),
  supportTier: z.string().max(100).optional().nullable(),
  responseHours: z.number().int().min(0).optional().nullable(),
  uptimePct:   z.number().min(0).max(100).optional().nullable(),
  slaNotes:    z.string().max(3000).optional().nullable(),
  notes:       z.string().max(5000).optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: { contractId: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data
  try {
    await db.customerContract.update({
      where: { id: params.contractId },
      data: {
        ...d,
        startDate:   d.startDate   === undefined ? undefined : new Date(d.startDate),
        endDate:     d.endDate     === undefined ? undefined : new Date(d.endDate),
        renewalDate: d.renewalDate === undefined ? undefined : (d.renewalDate ? new Date(d.renewalDate) : null),
      },
    })
    return NextResponse.json({ data: { id: params.contractId } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Update failed" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { contractId: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await db.customerContract.delete({ where: { id: params.contractId } }).catch(() => {})
  return NextResponse.json({ data: { deleted: true } })
}
