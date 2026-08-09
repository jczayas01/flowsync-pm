// src/app/api/admin/contracts/route.ts
// Enterprise Contracts / CLM — list + create. Platform-admin only.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/admin-gate"

const createSchema = z.object({
  workspaceId: z.string().min(1),
  name:        z.string().min(1).max(300),
  status:      z.enum(["DRAFT","ACTIVE","EXPIRED","TERMINATED","RENEWED"]).default("DRAFT"),
  startDate:   z.string(),
  endDate:     z.string(),
  renewalDate: z.string().optional().nullable(),
  autoRenew:   z.boolean().default(false),
  alertDays:   z.number().int().min(1).max(365).default(60),
  paidSeats:   z.number().int().min(0).default(0),
  contributorBundles: z.number().int().min(0).default(0),
  ocrPageCap:  z.number().int().min(0).optional().nullable(),
  billingCycle: z.enum(["MONTHLY","ANNUAL"]).default("ANNUAL"),
  amount:      z.number().min(0).optional().nullable(),
  currency:    z.string().default("USD"),
  supportTier: z.string().max(100).optional().nullable(),
  responseHours: z.number().int().min(0).optional().nullable(),
  uptimePct:   z.number().min(0).max(100).optional().nullable(),
  slaNotes:    z.string().max(3000).optional().nullable(),
  notes:       z.string().max(5000).optional().nullable(),
  serviceHourlyRate: z.number().min(0).optional().nullable(),
  onboardingFee:     z.number().min(0).optional().nullable(),
})

export async function GET() {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const contracts = await db.customerContract.findMany({
    orderBy: { endDate: "asc" },
    include: {
      workspace: { select: { id: true, name: true, slug: true, plan: true } },
      invoices:  { orderBy: { issueDate: "desc" } },
      documents: { orderBy: { createdAt: "desc" },
        select: { id: true, title: true, fileName: true, sizeBytes: true, createdAt: true } },
    },
  })
  // Decimal → number for the client
  const data = contracts.map(c => ({
    ...c,
    amount: c.amount == null ? null : Number(c.amount),
    uptimePct: c.uptimePct == null ? null : Number(c.uptimePct),
    invoices: c.invoices.map(i => ({ ...i, amount: Number(i.amount) })),
  }))
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data

  const ws = await db.workspace.findUnique({ where: { id: d.workspaceId }, select: { id: true } })
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })

  const contract = await db.customerContract.create({
    data: {
      ...d,
      startDate:   new Date(d.startDate),
      endDate:     new Date(d.endDate),
      renewalDate: d.renewalDate ? new Date(d.renewalDate) : null,
    },
  })
  return NextResponse.json({ data: { id: contract.id } }, { status: 201 })
}
