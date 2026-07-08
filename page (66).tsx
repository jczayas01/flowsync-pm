// src/app/api/invoices/route.ts
// GET  /api/invoices  — list invoices
// POST /api/invoices  — create invoice (manual or from time entries)

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, okList, err, parseBody, getSearchParams, ApiContext } from "@/lib/api"

const invoiceSchema = z.object({
  clientName:    z.string().min(1).max(200),
  clientEmail:   z.string().email(),
  clientAddress: z.string().max(500).optional(),
  projectId:     z.string().cuid().optional(),
  // Date range for auto-populating from time entries
  fromDate:      z.string().datetime().optional(),
  toDate:        z.string().datetime().optional(),
  // Manual line items (if not from time entries)
  lineItems:     z.array(z.object({
    description: z.string(),
    quantity:    z.number(),
    unitPrice:   z.number(),
    amount:      z.number(),
  })).optional(),
  taxRate:       z.number().min(0).max(100).default(0),  // e.g. 11.5 for IVU PR
  currency:      z.string().length(3).default("USD"),
  dueInDays:     z.number().int().min(0).max(365).default(30),
  notes:         z.string().max(1000).optional(),
  fromTimeEntries: z.boolean().default(false),
})

async function listInvoices(ctx: ApiContext) {
  const { page, perPage, skip, take, url } = getSearchParams(ctx.req)
  const status    = url.searchParams.get("status")    || undefined
  const projectId = url.searchParams.get("projectId") || undefined

  const where: any = {
    workspaceId: ctx.workspaceId,
    ...(status    && { status }),
    ...(projectId && { projectId }),
  }

  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      where, skip, take,
      orderBy: { createdAt: "desc" },
      include: {
        project:   { select: { id:true, code:true, name:true } },
        lineItems: true,
      },
    }),
    db.invoice.count({ where }),
  ])

  const totals = await db.invoice.aggregate({
    where,
    _sum: { total: true, amountPaid: true },
  })

  return ok({ invoices, total, page, perPage,
    totals: { total: Number(totals._sum.total||0), paid: Number(totals._sum.amountPaid||0) } })
}

async function createInvoice(ctx: ApiContext) {
  const parsed = await parseBody(ctx.req, invoiceSchema)
  if ("error" in parsed) return parsed.error
  const { data } = parsed

  // Generate invoice number
  const count = await db.invoice.count({ where: { workspaceId: ctx.workspaceId } })
  const invoiceNumber = `INV-${ctx.workspaceId.slice(0,4).toUpperCase()}-${String(count + 1).padStart(4,"0")}`

  let lineItems = data.lineItems || []

  // Auto-generate from time entries
  if (data.fromTimeEntries && data.projectId && data.fromDate && data.toDate) {
    const entries = await db.timeEntry.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        projectId:   data.projectId,
        isBillable:  true,
        invoiceId:   null,
        date: { gte: new Date(data.fromDate), lte: new Date(data.toDate) },
      },
      include: { user: { select: { name:true } } },
    })

    // Group by user + hourly rate
    const grouped = new Map<string, { name:string; hours:number; rate:number }>()
    for (const e of entries) {
      const key = `${e.userId}:${e.hourlyRate}`
      const existing = grouped.get(key)
      if (existing) {
        existing.hours += Number(e.hours)
      } else {
        grouped.set(key, { name: e.user.name, hours: Number(e.hours), rate: Number(e.hourlyRate) })
      }
    }

    lineItems = Array.from(grouped.values()).map(g => ({
      description: `Professional services — ${g.name}`,
      quantity:    g.hours,
      unitPrice:   g.rate,
      amount:      g.hours * g.rate,
    }))
  }

  const subtotal  = lineItems.reduce((sum, li) => sum + li.amount, 0)
  const taxAmount = subtotal * (data.taxRate / 100)
  const total     = subtotal + taxAmount
  const dueDate   = new Date(Date.now() + data.dueInDays * 86400000)

  const ws = await db.workspace.findUnique({
    where:  { id: ctx.workspaceId },
    select: { name:true, logoUrl:true },
  })

  const invoice = await db.$transaction(async tx => {
    const inv = await tx.invoice.create({
      data: {
        workspaceId:    ctx.workspaceId,
        invoiceNumber,
        status:         "DRAFT",
        clientName:     data.clientName,
        clientEmail:    data.clientEmail,
        clientAddress:  data.clientAddress,
        projectId:      data.projectId,
        currency:       data.currency,
        subtotal,
        taxRate:        data.taxRate,
        taxAmount,
        total,
        amountPaid:     0,
        dueDate,
        notes:          data.notes,
        createdById:    ctx.userId,
        issuerName:     ws?.name || "FlowSync PM",
      },
    })

    // Create line items
    await tx.invoiceLineItem.createMany({
      data: lineItems.map((li, i) => ({
        invoiceId:   inv.id,
        order:       i,
        description: li.description,
        quantity:    li.quantity,
        unitPrice:   li.unitPrice,
        amount:      li.amount,
      })),
    })

    // Mark time entries as invoiced
    if (data.fromTimeEntries && data.projectId) {
      await tx.timeEntry.updateMany({
        where: { workspaceId: ctx.workspaceId, projectId: data.projectId, isBillable: true, invoiceId: null },
        data:  { invoiceId: inv.id },
      })
    }

    return inv
  })

  return ok({ ...invoice, lineItems, subtotal, taxAmount, total }, 201)
}

export async function GET(req: NextRequest) { return withWorkspace(req, listInvoices) }
export async function POST(req: NextRequest) { return withWorkspace(req, createInvoice) }
