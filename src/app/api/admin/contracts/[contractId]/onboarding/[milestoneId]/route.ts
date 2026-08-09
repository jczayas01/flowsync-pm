// src/app/api/admin/contracts/[contractId]/onboarding/[milestoneId]/route.ts
// Update / delete an onboarding milestone.
// Every field the create route accepts is writable here too — keep the two in
// sync, this is the recurring create/edit drift bug.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/admin-gate"

const STATUSES = ["PENDING", "COMPLETED", "INVOICED"] as const

const patchSchema = z.object({
  name:          z.string().min(1).max(300).optional(),
  description:   z.string().max(2000).optional().nullable(),
  amount:        z.number().min(0).optional(),
  targetDate:    z.string().optional().nullable(),
  completedDate: z.string().optional().nullable(),
  status:        z.enum(STATUSES).optional(),
  sortOrder:     z.number().int().min(0).optional(),
  invoiceId:     z.string().optional().nullable(),
})

const ser = (m: any) => ({ ...m, amount: Number(m.amount) })

export async function PATCH(
  req: NextRequest,
  { params }: { params: { contractId: string; milestoneId: string } },
) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data

  const existing = await db.contractOnboardingMilestone.findFirst({
    where: { id: params.milestoneId, contractId: params.contractId },
  })
  if (!existing) return NextResponse.json({ error: "Milestone not found" }, { status: 404 })

  // Marking COMPLETED without a date stamps today, so the billing trigger is
  // never left ambiguous.
  const completedDate =
    d.completedDate !== undefined
      ? (d.completedDate ? new Date(d.completedDate) : null)
      : d.status === "COMPLETED" && !existing.completedDate
        ? new Date()
        : existing.completedDate

  const milestone = await db.contractOnboardingMilestone.update({
    where: { id: params.milestoneId },
    data: {
      ...(d.name        !== undefined ? { name: d.name } : {}),
      ...(d.description !== undefined ? { description: d.description || null } : {}),
      ...(d.amount      !== undefined ? { amount: d.amount } : {}),
      ...(d.targetDate  !== undefined ? { targetDate: d.targetDate ? new Date(d.targetDate) : null } : {}),
      ...(d.status      !== undefined ? { status: d.status } : {}),
      ...(d.sortOrder   !== undefined ? { sortOrder: d.sortOrder } : {}),
      ...(d.invoiceId   !== undefined ? { invoiceId: d.invoiceId || null } : {}),
      completedDate,
    },
  })
  return NextResponse.json({ data: { milestone: ser(milestone) } })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { contractId: string; milestoneId: string } },
) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const existing = await db.contractOnboardingMilestone.findFirst({
    where:  { id: params.milestoneId, contractId: params.contractId },
    select: { id: true, status: true },
  })
  if (!existing) return NextResponse.json({ error: "Milestone not found" }, { status: 404 })
  if (existing.status === "INVOICED") {
    return NextResponse.json(
      { error: "This milestone has already been invoiced. Void or amend the invoice instead." },
      { status: 409 },
    )
  }

  await db.contractOnboardingMilestone.delete({ where: { id: params.milestoneId } })
  return NextResponse.json({ data: { ok: true } })
}
