// src/app/api/admin/contracts/[contractId]/onboarding/route.ts
// Fixed-fee, milestone-based onboarding billing — list + create.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/admin-gate"

const STATUSES = ["PENDING", "COMPLETED", "INVOICED"] as const

const createSchema = z.object({
  name:          z.string().min(1).max(300),
  description:   z.string().max(2000).optional().nullable(),
  amount:        z.number().min(0),
  targetDate:    z.string().optional().nullable(),
  completedDate: z.string().optional().nullable(),
  status:        z.enum(STATUSES).default("PENDING"),
  sortOrder:     z.number().int().min(0).default(0),
})

const ser = (m: any) => ({ ...m, amount: Number(m.amount) })

export async function GET(_req: NextRequest, { params }: { params: { contractId: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const milestones = await db.contractOnboardingMilestone.findMany({
    where:   { contractId: params.contractId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })
  return NextResponse.json({ data: milestones.map(ser) })
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
    where: { id: params.contractId }, select: { id: true },
  })
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 })

  const milestone = await db.contractOnboardingMilestone.create({
    data: {
      contractId:    params.contractId,
      name:          d.name,
      description:   d.description || null,
      amount:        d.amount,
      targetDate:    d.targetDate ? new Date(d.targetDate) : null,
      completedDate: d.completedDate ? new Date(d.completedDate) : null,
      status:        d.status,
      sortOrder:     d.sortOrder,
    },
  })
  return NextResponse.json({ data: { milestone: ser(milestone) } }, { status: 201 })
}
