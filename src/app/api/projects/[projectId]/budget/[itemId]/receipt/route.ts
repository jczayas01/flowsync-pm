// src/app/api/projects/[projectId]/budget/[itemId]/receipt/route.ts
// Budget automation #5: photograph or scan an invoice/receipt → AI extracts
// vendor, date and total → an Expense is posted on this budget line with the
// file attached. Business-tier (same gate as document OCR) and counted
// against the workspace's monthly OCR page cap.
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, verifyProjectAccess, audit, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"
import { uploadFile } from "@/lib/storage"
import { monthlyOcrPagesUsed, resolveOcrCap, recordOcrPages, ocrAllowed } from "@/lib/ocr"
import { aiGuard, AI_DISABLED_ERROR } from "@/lib/ai-guard"

const IMG = new Set(["image/png", "image/jpeg", "image/webp"])
// Invoices arrive as PDF far more often than as a phone photo. Claude reads
// PDFs natively (text layer or scan), so the same extractor handles both.
const PDF = "application/pdf"
const MAX_BYTES = 10_000_000

async function extractReceipt(imageB64: string, mediaType: string): Promise<{
  vendor: string; date: string | null; amount: number | null; currency: string; summary: string
  /** The invoice's own charge lines. A document covering two budget lines already
   *  says so on the page; making the PM post it twice loses the link between the
   *  halves and invites a double-count. */
  lines: { description: string; amount: number }[]
} | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: [
        mediaType === "application/pdf"
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: imageB64 } }
          : { type: "image",    source: { type: "base64", media_type: mediaType,        data: imageB64 } },
        { type: "text", text:
          `This is a receipt or invoice (it may be a multi-page PDF; use the grand total, not a subtotal or a page total). ` +
          `Extract and respond with ONLY a JSON object, no markdown fences, no commentary: ` +
          `{"vendor": string, "date": "YYYY-MM-DD" or null, "amount": number (grand total) or null, ` +
          `"currency": 3-letter code (default "USD"), "summary": short description of what was purchased, ` +
          `"lines": [{"description": string, "amount": number}] — one entry per charge line printed on the ` +
          `document, excluding subtotals, tax and the grand total; return an empty array when the document ` +
          `is not itemised}` },
      ]}],
    }),
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  const text = (data?.content || []).map((c: any) => c.type === "text" ? c.text : "").join("").trim()
  try {
    const clean = text.replace(/```json|```/g, "").trim()
    const j = JSON.parse(clean)
    return {
      vendor:   String(j.vendor || "Unknown vendor").slice(0, 120),
      date:     typeof j.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.date) ? j.date : null,
      amount:   typeof j.amount === "number" && j.amount > 0 ? Math.round(j.amount * 100) / 100 : null,
      lines:    Array.isArray(j.lines)
        ? j.lines
            .filter((l: any) => l && typeof l.amount === "number" && l.amount > 0)
            .slice(0, 20)
            .map((l: any) => ({
              description: String(l.description || "").slice(0, 200),
              amount: Math.round(l.amount * 100) / 100,
            }))
        : [],
      currency: typeof j.currency === "string" ? j.currency.slice(0, 3).toUpperCase() : "USD",
      summary:  String(j.summary || "").slice(0, 300),
    }
  } catch { return null }
}

async function post(ctx: ApiContext, params?: Record<string, string>) {
  { const _g = await requirePermission(ctx as any, "budget:edit" as any); if (_g) return _g }
  const { projectId, itemId } = params || {}
  if (!projectId || !itemId) return err("IDs required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  if (!(await aiGuard(ctx.workspaceId, "receipt-ocr", ctx.userId, projectId)))
    return err(AI_DISABLED_ERROR, 403)

  const ws = await db.workspace.findUnique({
    where: { id: ctx.workspaceId }, select: { plan: true } })
  if (!ws || !ocrAllowed(String(ws.plan))) {
    return err("Receipt scanning is included in the Business plan. Upgrade in Settings → Billing.", 402)
  }

  const item = await db.budgetItem.findFirst({
    where: { id: itemId, projectId }, select: { id: true } })
  if (!item) return notFound("Budget item")

  // Cap check — a receipt counts as one page.
  const [used, cap] = await Promise.all([
    monthlyOcrPagesUsed(ctx.workspaceId),
    resolveOcrCap(ctx.workspaceId, String(ws.plan)),
  ])
  if (used >= cap) {
    return err(`You've used ${used} of your ${cap} AI-read pages this month. Add 200 more for $10/mo in Settings → Billing.`, 402)
  }

  let form: FormData
  try { form = await ctx.req.formData() }
  catch { return err("Expected multipart form data") }
  const file = form.get("file")
  if (!(file instanceof File)) return err("No file provided")
  if (!IMG.has(file.type) && file.type !== PDF) {
    return err("Upload a receipt or invoice — PDF, PNG, JPG or WebP")
  }
  if (file.size > MAX_BYTES) return err("Image must be under 10 MB")

  const buf = Buffer.from(await file.arrayBuffer())
  const parsed = await extractReceipt(buf.toString("base64"), file.type)
  if (!parsed) return err("AI couldn't read this receipt — try a clearer photo", 422)

  // Store the receipt image next to project documents.
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 100)
  const path = `receipts/${projectId}/${Date.now()}-${safeName}`
  const up = await uploadFile(file, path, file.type)


  const amount = parsed.amount ?? 0

  // An invoice can cover several budget lines. When the caller sends a split,
  // each part posts its own expense against its own line, all pointing at the
  // same stored document — so the paper trail stays whole instead of becoming
  // two unrelated receipts that nobody can reconcile later.
  let split: { budgetItemId: string; amount: number; note?: string }[] = []
  const splitRaw = form.get("split")
  if (typeof splitRaw === "string" && splitRaw.trim()) {
    try {
      const arr = JSON.parse(splitRaw)
      if (Array.isArray(arr)) {
        split = arr
          .filter((x: any) => x?.budgetItemId && Number(x.amount) > 0)
          .slice(0, 20)
          .map((x: any) => ({
            budgetItemId: String(x.budgetItemId),
            amount: Math.round(Number(x.amount) * 100) / 100,
            note: x.note ? String(x.note).slice(0, 200) : undefined,
          }))
      }
    } catch { /* a malformed split falls back to a single posting */ }
  }
  if (split.length) {
    const lines = await db.budgetItem.findMany({
      where: { projectId, id: { in: split.map(x => x.budgetItemId) } },
      select: { id: true },
    })
    const valid = new Set(lines.map(l => l.id))
    split = split.filter(x => valid.has(x.budgetItemId))
    const sum = split.reduce((a, b) => a + b.amount, 0)
    if (amount > 0 && Math.abs(sum - amount) > 0.5) {
      return err(`The split adds up to $${sum.toLocaleString()} but the document totals $${amount.toLocaleString()}. Adjust the amounts so they match.`, 400)
    }
  }

  // Duplicate guard: the same receipt drafted onto a second line silently
  // double-counts spend. Same amount + same vendor wording anywhere in this
  // project => 409 unless the client confirms with ?force=1.
  const force = new URL(ctx.req.url).searchParams.get("force") === "1"
  if (!force && amount > 0) {
    const normV = (x: string) => String(x || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim()
    const dupe = await db.expense.findFirst({
      where: { budgetItem: { projectId }, amount },
      include: { budgetItem: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    })
    if (dupe) {
      const a = new Set(normV(dupe.description).split(/\s+/).filter(w => w.length > 3))
      const b = new Set(normV(parsed.vendor || "").split(/\s+/).filter(w => w.length > 3))
      let hit = 0; a.forEach(w => { if (b.has(w)) hit++ })
      if (!b.size || hit > 0) {
        return err(`This receipt looks already posted on "${dupe.budgetItem.name}" ($${Number(amount).toLocaleString()}). Delete it there or confirm to post again.`, 409)
      }
    }
  }
  // An itemised invoice with no split supplied posts nothing yet. Posting first
  // and asking afterwards is how the confirmation ends up creating a second copy
  // of the same expense — the split call would post again on top of it.
  if (!split.length && !force && (parsed.lines?.length || 0) > 1) {
    return NextResponse.json({
      needsSplit: true,
      vendor: parsed.vendor,
      amount,
      currency: parsed.currency,
      date: parsed.date,
      lines: parsed.lines,
      message: "This invoice lists several charges. Assign each to a budget line, or confirm to post the whole amount here.",
    }, { status: 409 })
  }

  const postings = split.length
    ? split
    : [{ budgetItemId: itemId, amount, note: undefined as string | undefined }]

  const expense = await db.$transaction(async tx => {
    let e: any = null
    for (const post of postings) {
      if (!(post.amount > 0)) continue
      const created = await tx.expense.create({ data: {
        budgetItemId: post.budgetItemId,
        description:  `${parsed.vendor}${post.note ? ` — ${post.note}` : parsed.summary ? ` — ${parsed.summary}` : ""} (AI-drafted from receipt — verify)`,
        amount:       post.amount,
        currency:     parsed.currency,
        date:         parsed.date ? new Date(parsed.date + "T00:00:00Z") : new Date(),
        receiptUrl:   up.error ? null : path,
        createdById:  ctx.userId,
      }})
      e = e || created
      await tx.budgetItem.update({
        where: { id: post.budgetItemId },
        data:  { actualCost: { increment: post.amount } },
      })
    }
    if (amount > 0) {
      const agg = await tx.budgetItem.aggregate({ where: { projectId }, _sum: { actualCost: true } })
      await tx.project.update({ where: { id: projectId },
        data: { budgetSpent: agg._sum.actualCost ?? 0 } })
    }
    return e
  })

  await recordOcrPages(ctx.workspaceId, ctx.userId, 1, `receipt:${file.name}`).catch(() => {})
  await audit(ctx.workspaceId, ctx.userId, "budget.expense_posted" as any, "budgetItem", itemId,
    { source: "receipt-ocr", amount, vendor: parsed.vendor }).catch(() => {})

  return ok({
    expenseId: expense.id,
    vendor: parsed.vendor, amount, currency: parsed.currency,
    date: parsed.date, summary: parsed.summary,
    needsAmount: parsed.amount == null,
  })
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string; itemId: string } }) {
  return withWorkspace(req, post, params)
}
