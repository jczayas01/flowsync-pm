// src/app/api/invoices/[invoiceId]/route.ts
// GET   /api/invoices/:id         — get invoice
// PATCH /api/invoices/:id         — update status (send, mark paid, cancel)

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, ApiContext } from "@/lib/api"

const updateSchema = z.object({
  status:       z.enum(["DRAFT","SENT","VIEWED","PAID","OVERDUE","CANCELLED"]).optional(),
  amountPaid:   z.number().min(0).optional(),
  paidAt:       z.string().datetime().optional(),
  notes:        z.string().max(1000).optional(),
}).strict()

async function getInvoice(ctx: ApiContext, params?: Record<string,string>) {
  const id = params?.invoiceId
  if (!id) return err("Invoice ID required")

  const invoice = await db.invoice.findFirst({
    where:   { id, workspaceId: ctx.workspaceId },
    include: { lineItems: { orderBy: { order:"asc" } }, project: true },
  })
  if (!invoice) return notFound("Invoice")
  return ok(invoice)
}

async function updateInvoice(ctx: ApiContext, params?: Record<string,string>) {
  const id = params?.invoiceId
  if (!id) return err("Invoice ID required")

  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error

  const invoice = await db.invoice.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  })
  if (!invoice) return notFound("Invoice")

  const updates: any = { ...parsed.data }
  if (parsed.data.status === "SENT" && !invoice.sentAt) {
    updates.sentAt = new Date()
    // Send email to client
    await sendInvoiceEmail(invoice, ctx.workspaceId)
  }
  if (parsed.data.status === "PAID") {
    updates.paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date()
    updates.amountPaid = invoice.total
  }

  const updated = await db.invoice.update({ where: { id }, data: updates,
    include: { lineItems: true } })
  return ok(updated)
}

async function sendInvoiceEmail(invoice: any, workspaceId: string) {
  try {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL!,
      to:      invoice.clientEmail,
      subject: `Invoice ${invoice.invoiceNumber} from ${invoice.issuerName}`,
      html: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2>Invoice ${invoice.invoiceNumber}</h2>
        <p>Dear ${invoice.clientName},</p>
        <p>Please find your invoice attached. Total due: <strong>$${Number(invoice.total).toFixed(2)}</strong></p>
        <p>Due date: ${new Date(invoice.dueDate).toDateString()}</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoice.id}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#1B6CA8;color:#fff;border-radius:6px;text-decoration:none">View & Pay Invoice</a>
      </div>`,
    })
  } catch(e) { console.error("[Invoice Email]", e) }
}

export async function GET(req: NextRequest, { params }: { params: { invoiceId: string } }) {
  return withWorkspace(req, getInvoice, params)
}
export async function PATCH(req: NextRequest, { params }: { params: { invoiceId: string } }) {
  return withWorkspace(req, updateInvoice, params)
}
