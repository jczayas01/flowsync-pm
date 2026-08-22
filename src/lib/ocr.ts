// src/lib/ocr.ts
// AI reading of scanned PDFs — a Business-plan feature (Model A).
//
// Pipeline: PDF pages → PNG (unpdf + @napi-rs/canvas, prebuilt binaries that run
// on Vercel) → claude-sonnet-4-6 vision → transcribed text into the same
// extraction pipeline normal documents use.
//
// Cost control, three layers:
//   1. Plan gate — Starter never OCRs; it gets an upgrade prompt instead.
//   2. Per-document page cap (OCR_DOC_PAGE_CAP) — a 200-page scan won't run away.
//   3. Monthly workspace cap (OCR_MONTHLY_PAGE_CAP) — bounds our vision spend to
//      a few dollars against a $39+ subscription.
//
// Usage ledger: AuditLog has no metadata column and adding one means a migration,
// so pages ride in the action string ("ocr.pages:5") and get summed over the
// month window. The [workspaceId, createdAt] index keeps that query cheap.

import { db } from "@/lib/db"
import { PLANS, type PlanId } from "@/lib/stripe/client"

export const OCR_DOC_PAGE_CAP     = 15    // pages read per document per run
export const OCR_MONTHLY_PAGE_CAP = 200   // base pages per workspace per calendar month
export const OCR_PACK_PAGES       = 200   // pages added per purchased add-on pack

/**
 * Effective monthly cap for a workspace:
 *  - Enterprise: the CLM contract's custom ocrPageCap when set, else the base.
 *  - Everyone else: base + 200 per purchased add-on pack (Workspace.ocrPageAddons).
 */
/** Monthly OCR page cap. Delegates to resolveEntitlements so the number that
 *  is ENFORCED is the same one Settings → Team and Billing display.
 *
 *  The old version had a real hole: an ENTERPRISE workspace with no ACTIVE
 *  contract fell through to the flat 200 and ignored purchased packs, so an
 *  approved pack was billed but never honored. */
export async function resolveOcrCap(workspaceId: string, _plan?: string): Promise<number> {
  const { resolveEntitlements } = await import("@/lib/entitlements")
  const ent = await resolveEntitlements(workspaceId).catch(() => null)
  return ent?.ocrPages || OCR_MONTHLY_PAGE_CAP
}
const PAGES_PER_CALL = 4                  // vision images per Claude request

export function ocrAllowed(plan: string): boolean {
  return !!(PLANS[plan as PlanId] ?? PLANS.FREE).limits.ocr
}

export async function monthlyOcrPagesUsed(workspaceId: string): Promise<number> {
  const monthStart = new Date()
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
  const rows = await db.auditLog.findMany({
    where:  { workspaceId, createdAt: { gte: monthStart }, action: { startsWith: "ocr.pages:" } },
    select: { action: true },
  })
  return rows.reduce((n, r) => n + (parseInt(r.action.split(":")[1] || "0", 10) || 0), 0)
}

export async function recordOcrPages(workspaceId: string, userId: string, pages: number, docName: string) {
  await db.auditLog.create({
    data: {
      workspaceId, userId,
      action:     `ocr.pages:${pages}`,
      entityType: "document",
      entityId:   docName.slice(0, 180),
    },
  }).catch(() => {})   // a ledger hiccup must not fail the read itself
}

/** Render up to `maxPages` pages of a PDF to PNG buffers. */
async function renderPages(buf: Buffer, maxPages: number): Promise<Buffer[]> {
  const { getDocumentProxy, renderPageAsImage } = await import("unpdf")
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  const n = Math.min(pdf.numPages, maxPages)
  const out: Buffer[] = []
  for (let p = 1; p <= n; p++) {
    const img = await renderPageAsImage(new Uint8Array(buf), p, {
      scale: 2,
      canvasImport: () => import("@napi-rs/canvas"),
    })
    out.push(Buffer.from(img))
  }
  return out
}

/** Transcribe rendered pages with Claude vision. Returns plain text. */
async function transcribePages(pages: Buffer[], docName: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("AI is not configured")
  const chunks: string[] = []

  for (let i = 0; i < pages.length; i += PAGES_PER_CALL) {
    const batch = pages.slice(i, i + PAGES_PER_CALL)
    const content: any[] = batch.map(b => ({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: b.toString("base64") },
    }))
    content.push({
      type: "text",
      text: `These are scanned pages ${i + 1}–${i + batch.length} of the document "${docName}". ` +
            `Transcribe ALL text you can read, preserving structure (headings, lists, tables as ` +
            `plain text rows). Include numbers, dates and names exactly as written. ` +
            `Output only the transcription — no commentary.`,
    })

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{ role: "user", content }],
      }),
    })
    if (!res.ok) {
      console.error("[ocr] vision call failed", res.status, await res.text())
      throw new Error("AI transcription failed")
    }
    const data = await res.json()
    const text = (data.content || []).map((c: any) => c.type === "text" ? c.text : "").join("\n").trim()
    if (text) chunks.push(text)
  }
  return chunks.join("\n\n")
}

export type OcrOutcome =
  | { ok: true;  text: string; pagesRead: number; truncated: boolean }
  | { ok: false; reason: "plan" | "failed" }
  | { ok: false; reason: "cap"; used: number; cap: number }

/**
 * OCR a scanned PDF, enforcing plan + caps. Call only after normal text
 * extraction returned nothing.
 */
export async function ocrScannedPdf(opts: {
  buf: Buffer; docName: string
  workspaceId: string; userId: string; plan: string
}): Promise<OcrOutcome> {
  if (!ocrAllowed(opts.plan)) return { ok: false, reason: "plan" }

  const cap  = await resolveOcrCap(opts.workspaceId, opts.plan)
  const used = await monthlyOcrPagesUsed(opts.workspaceId)
  if (used >= cap) return { ok: false, reason: "cap", used, cap }

  const budget = Math.min(OCR_DOC_PAGE_CAP, cap - used)
  try {
    const pages = await renderPages(opts.buf, budget)
    if (!pages.length) return { ok: false, reason: "failed" }
    const text = await transcribePages(pages, opts.docName)
    if (!text.trim()) return { ok: false, reason: "failed" }
    await recordOcrPages(opts.workspaceId, opts.userId, pages.length, opts.docName)
    return { ok: true, text, pagesRead: pages.length, truncated: pages.length >= budget }
  } catch (e) {
    console.error("[ocr]", opts.docName, e)
    return { ok: false, reason: "failed" }
  }
}

/** Guard for routes that hand a scanned PDF/image straight to the model as a
 *  visual document (no text layer). Those bypass ocrScannedPdf, so without
 *  this they read pages for free and the monthly counter under-reports.
 *  Returns whether the read may proceed, and records the pages when it does.
 *  `pages` is an estimate (a scanned PDF costs roughly its page count). */
export async function reserveVisionPages(opts: {
  workspaceId: string; userId: string; plan: string; docName: string; pages?: number
}): Promise<{ ok: true; charged: number } | { ok: false; reason: "plan" | "cap"; used: number; cap: number }> {
  if (!ocrAllowed(opts.plan)) return { ok: false, reason: "plan", used: 0, cap: 0 }
  const [used, cap] = await Promise.all([
    monthlyOcrPagesUsed(opts.workspaceId),
    resolveOcrCap(opts.workspaceId, opts.plan),
  ])
  if (used >= cap) return { ok: false, reason: "cap", used, cap }
  const want = Math.max(1, Math.min(opts.pages ?? PAGES_PER_CALL, cap - used))
  await recordOcrPages(opts.workspaceId, opts.userId, want, opts.docName)
  return { ok: true, charged: want }
}
