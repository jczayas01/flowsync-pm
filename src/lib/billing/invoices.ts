// src/lib/billing/invoices.ts
// Invoice generation, PDF creation, Stripe payment links

import { db } from "@/lib/db"

export interface InvoiceLineItem {
  description: string
  quantity:    number
  unit:        string
  unitPrice:   number
  amount:      number
  timeEntryIds?: string[]
}

export interface CreateInvoiceOptions {
  workspaceId:   string
  projectId?:    string
  clientName:    string
  clientEmail:   string
  clientAddress?: string
  lineItems:     InvoiceLineItem[]
  currency:      string
  taxRate:       number      // percentage, e.g. 11.5 for 11.5%
  notes?:        string
  dueDate:       Date
  createdById:   string
}

// ── Auto-generate invoice number ──
async function nextInvoiceNumber(workspaceId: string): Promise<string> {
  const last = await db.$queryRaw<any[]>`
    SELECT number FROM invoices
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC LIMIT 1
  `.catch(() => [])

  if (!last[0]) return "INV-001"
  const num = parseInt(last[0].number.replace("INV-", ""), 10) + 1
  return `INV-${String(num).padStart(3, "0")}`
}

// ── Create invoice from time entries ──
export async function createInvoiceFromTimeEntries(
  workspaceId:  string,
  projectId:    string,
  clientName:   string,
  clientEmail:  string,
  dueDate:      Date,
  currency:     string,
  taxRate:      number,
  createdById:  string,
  notes?:       string
): Promise<string> {
  // Fetch unbilled billable time entries for this project
  const entries = await db.timeEntry.findMany({
    where: {
      projectId,
      billable: true,
      project:  { workspaceId },
    },
    include: {
      user: { select: { name: true } },
      task: { select: { title: true, code: true } },
    },
    orderBy: { date: "asc" },
  })

  if (!entries.length) throw new Error("No billable time entries found for this project")

  // Group by user + rate
  const grouped = new Map<string, { name: string; hours: number; rate: number; entryIds: string[] }>()
  for (const e of entries) {
    const key   = `${e.userId}:${e.hourlyRate}`
    const rate  = Number(e.hourlyRate) || 0
    const hours = Number(e.hours)
    if (!grouped.has(key)) {
      grouped.set(key, { name: e.user.name, hours: 0, rate, entryIds: [] })
    }
    const g = grouped.get(key)!
    g.hours += hours
    g.entryIds.push(e.id)
  }

  const lineItems: InvoiceLineItem[] = [...grouped.values()].map(g => ({
    description:  `Professional services — ${g.name}`,
    quantity:     Math.round(g.hours * 100) / 100,
    unit:         "hours",
    unitPrice:    g.rate,
    amount:       Math.round(g.hours * g.rate * 100) / 100,
    timeEntryIds: g.entryIds,
  }))

  return createInvoice({
    workspaceId,
    projectId,
    clientName,
    clientEmail,
    lineItems,
    currency,
    taxRate,
    dueDate,
    createdById,
    notes,
  })
}

// ── Core invoice creation ──
export async function createInvoice(opts: CreateInvoiceOptions): Promise<string> {
  const number   = await nextInvoiceNumber(opts.workspaceId)
  const subtotal = opts.lineItems.reduce((s, l) => s + l.amount, 0)
  const taxAmt   = Math.round(subtotal * opts.taxRate / 100 * 100) / 100
  const total    = subtotal + taxAmt

  const invoiceId = crypto.randomUUID()

  await db.$executeRaw`
    INSERT INTO invoices (
      id, workspace_id, project_id, number, client_name, client_email,
      client_address, status, currency, subtotal, tax_rate, tax_amount,
      total, notes, due_date, created_by_id, created_at, updated_at
    ) VALUES (
      ${invoiceId}, ${opts.workspaceId}, ${opts.projectId || null},
      ${number}, ${opts.clientName}, ${opts.clientEmail},
      ${opts.clientAddress || null}, 'DRAFT', ${opts.currency},
      ${subtotal}, ${opts.taxRate}, ${taxAmt}, ${total},
      ${opts.notes || null}, ${opts.dueDate}, ${opts.createdById},
      NOW(), NOW()
    )
  `

  // Insert line items
  for (const item of opts.lineItems) {
    await db.$executeRaw`
      INSERT INTO invoice_line_items (
        id, invoice_id, description, quantity, unit, unit_price, amount, time_entry_ids
      ) VALUES (
        ${crypto.randomUUID()}, ${invoiceId}, ${item.description},
        ${item.quantity}, ${item.unit}, ${item.unitPrice}, ${item.amount},
        ${item.timeEntryIds || []}
      )
    `
  }

  return invoiceId
}

// ── Generate PDF (simplified — real impl uses puppeteer or pdf-lib) ──
export function buildInvoiceHTML(invoice: any, workspace: any, lineItems: any[]): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(n)

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Inter, Arial, sans-serif; font-size: 13px; color: #0F172A; padding: 40px; max-width: 700px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .logo { font-size: 20px; font-weight: 700; color: #0D1B2A; }
  .logo span { color: #F59E0B; }
  .invoice-meta { text-align: right; }
  .invoice-num { font-size: 22px; font-weight: 700; color: #1B6CA8; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; background: #ECFDF5; color: #059669; margin-top: 4px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
  .party-label { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #64748B; margin-bottom: 6px; }
  .party-name { font-size: 15px; font-weight: 600; color: #0F172A; }
  .party-detail { font-size: 12px; color: #64748B; margin-top: 2px; }
  .dates { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #F8FAFC; border-radius: 8px; padding: 14px 16px; margin-bottom: 28px; }
  .date-item { }
  .date-label { font-size: 10px; color: #64748B; margin-bottom: 3px; }
  .date-val { font-size: 13px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { padding: 9px 12px; background: #F8FAFC; text-align: left; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #64748B; border-bottom: 2px solid #E2E8F0; }
  thead th:last-child { text-align: right; }
  tbody td { padding: 11px 12px; border-bottom: 1px solid #F1F5F9; font-size: 12px; }
  tbody td:last-child { text-align: right; font-weight: 500; }
  .totals { width: 240px; margin-left: auto; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #F1F5F9; }
  .totals-total { display: flex; justify-content: space-between; padding: 10px 0; font-size: 16px; font-weight: 700; border-top: 2px solid #0F172A; margin-top: 4px; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center; }
  .notes { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 14px; margin-bottom: 20px; font-size: 12px; color: #92400E; }
  .pay-btn { display: block; text-align: center; background: #1B6CA8; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 20px 0; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">FlowSync <span>PM</span></div>
      <div style="font-size:11px;color:#64748B;margin-top:4px">${workspace?.name || "Your Organization"}</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-num">${invoice.number}</div>
      <div class="status-badge">${invoice.status}</div>
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="party-label">Bill from</div>
      <div class="party-name">${workspace?.name || "Your Organization"}</div>
    </div>
    <div>
      <div class="party-label">Bill to</div>
      <div class="party-name">${invoice.client_name}</div>
      <div class="party-detail">${invoice.client_email}</div>
      ${invoice.client_address ? `<div class="party-detail">${invoice.client_address}</div>` : ""}
    </div>
  </div>

  <div class="dates">
    <div class="date-item"><div class="date-label">Invoice date</div><div class="date-val">${new Date(invoice.created_at).toLocaleDateString("en-US", { dateStyle: "long", timeZone:"UTC" })}</div></div>
    <div class="date-item"><div class="date-label">Due date</div><div class="date-val" style="color:${new Date(invoice.due_date) < new Date() && invoice.status !== "PAID" ? "#DC2626" : "#0F172A"}">${new Date(invoice.due_date).toLocaleDateString("en-US", { dateStyle: "long", timeZone:"UTC" })}</div></div>
  </div>

  <table>
    <thead>
      <tr><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr>
    </thead>
    <tbody>
      ${lineItems.map(l => `
        <tr>
          <td>${l.description}</td>
          <td>${l.quantity}</td>
          <td>${l.unit}</td>
          <td>${fmt(l.unit_price)}</td>
          <td>${fmt(l.amount)}</td>
        </tr>`).join("")}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>${fmt(invoice.subtotal)}</span></div>
    ${invoice.tax_rate > 0 ? `<div class="totals-row"><span>Tax (${invoice.tax_rate}%)</span><span>${fmt(invoice.tax_amount)}</span></div>` : ""}
    <div class="totals-total"><span>Total due</span><span>${fmt(invoice.total)}</span></div>
  </div>

  ${invoice.stripe_invoice_url ? `<a class="pay-btn" href="${invoice.stripe_invoice_url}">Pay online →</a>` : ""}

  ${invoice.notes ? `<div class="notes">📝 ${invoice.notes}</div>` : ""}

  <div class="footer">Generated by FlowSync PM · flowsyncpm.com · Questions? ${workspace?.email || "billing@flowsyncpm.com"}</div>
</body>
</html>`
}

// ── Send invoice via email ──
export async function sendInvoice(invoiceId: string, workspaceId: string): Promise<void> {
  const invoice = await db.$queryRaw<any[]>`
    SELECT i.*, array_agg(row_to_json(il.*)) as line_items
    FROM invoices i
    LEFT JOIN invoice_line_items il ON il.invoice_id = i.id
    WHERE i.id = ${invoiceId} AND i.workspace_id = ${workspaceId}
    GROUP BY i.id
  `.then(r => r[0])

  if (!invoice) throw new Error("Invoice not found")

  const workspace = await db.workspace.findUnique({
    where:  { id: workspaceId },
    select: { name: true },
  })

  const html = buildInvoiceHTML(invoice, workspace, invoice.line_items || [])

  const { Resend } = await import("resend")
  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from:    process.env.RESEND_FROM_EMAIL!,
    to:      invoice.client_email,
    subject: `Invoice ${invoice.number} from ${workspace?.name} — ${new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(invoice.total)} due ${new Date(invoice.due_date).toLocaleDateString()}`,
    html,
  })

  await db.$executeRaw`
    UPDATE invoices SET status = 'SENT', sent_at = NOW() WHERE id = ${invoiceId}
  `
}
