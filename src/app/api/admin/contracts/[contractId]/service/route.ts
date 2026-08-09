// src/app/api/admin/contracts/[contractId]/service/route.ts
// Billable service delivery (non-SLA / non-error) — list + create.
// Rate is snapshot from the contract at entry time so re-rating a contract
// never rewrites the value of work already logged.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/admin-gate"

const CATEGORIES = ["ONBOARDING", "TRAINING", "SERVICE_REQUEST", "CHANGE_CONFIG"] as const
const STATUSES = ["DRAFT", "APPROVED", "INVOICED", "WRITTEN_OFF"] as const

const createSchema = z.object({
  entryDate:   z.string(),
  category:    z.enum(CATEGORIES).default("SERVICE_REQUEST"),
  description: z.string().min(1).max(1000),
  hours:       z.number().min(0).max(9999),
  rate:        z.number().min(0).optional().nullable(),
  billable:    z.boolean().default(true),
  status:      z.enum(STATUSES).default("DRAFT"),
  performedBy: z.string().max(200).optional().nullable(),
  notes:       z.string().max(3000).optional().nullable(),
})

const serializeEntry = (e: any) => ({
  ...e,
  hours:  Number(e.hours),
  rate:   Number(e.rate),
  amount: Number(e.amount),
})

export async function GET(_req: NextRequest, { params }: { params: { contractId: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const entries = await db.contractServiceEntry.findMany({
    where:   { contractId: params.contractId },
    orderBy: { entryDate: "desc" },
  })
  return NextResponse.json({ data: entries.map(serializeEntry) })
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
    where:  { id: params.contractId },
    select: { id: true, serviceHourlyRate: true },
  })
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 })

  // Explicit rate wins; otherwise snapshot the contract rate. A contract with no
  // rate set logs at 0 so the hours are still captured — the amount can be
  // corrected once a rate exists rather than blocking the entry.
  const rate = d.rate != null ? d.rate : Number(contract.serviceHourlyRate ?? 0)
  const amount = d.billable ? Number((d.hours * rate).toFixed(2)) : 0

  const entry = await db.contractServiceEntry.create({
    data: {
      contractId:  params.contractId,
      entryDate:   new Date(d.entryDate),
      category:    d.category,
      description: d.description,
      hours:       d.hours,
      rate,
      amount,
      billable:    d.billable,
      status:      d.status,
      performedBy: d.performedBy || null,
      notes:       d.notes || null,
    },
  })
  return NextResponse.json({ data: { entry: serializeEntry(entry) } }, { status: 201 })
}
