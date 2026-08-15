// src/app/api/ideas/scan/route.ts
// Scan an uploaded document with AI to prefill an initiative.
//
// Two modes, same endpoint:
//   mode=idea   — a proposal/brief/email: extract title, summary, problem,
//                 goal, sponsor, cost/benefit estimates, target date.
//   mode=option — a vendor quote/spec sheet: extract one or more comparison
//                 options (name, vendor, cost, specs map, pros, cons).
//
// The file arrives directly as multipart (ideas live outside projects, so the
// project-docs scan pipeline doesn't apply). 4 MB cap — Vercel's body limit.
// Honors the workspace AI kill switch via aiGuard, feature "ideas-scan".
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { withWorkspace, ok, err, ApiContext } from "@/lib/api"
import { extractTextFromBuffer } from "@/lib/extract"
import { aiGuard, AI_DISABLED_ERROR } from "@/lib/ai-guard"

const MAX_BYTES = 4 * 1024 * 1024   // Vercel serverless body cap is 4.5 MB
const MAX_CHARS = 60_000

const IDEA_PROMPT = `You read a business document (proposal, brief, email thread, one-pager) and prefill a pre-project idea record.
Return ONLY a JSON object, no markdown fences, with these keys (null when the document doesn't say):
{"title": string|null, "summary": string|null (2-3 sentences), "problem": string|null, "goal": string|null, "sponsor": string|null, "estCost": number|null, "estBenefit": number|null, "targetDate": "YYYY-MM-DD"|null}
Write text fields in the same language as the document. Do not invent numbers — only extract figures the document states.`

const OPTION_PROMPT = `You read a vendor quote, product brochure or spec sheet and extract the product/solution options it describes for a comparison matrix.
Return ONLY a JSON object, no markdown fences:
{"options": [{"name": string, "vendor": string|null, "cost": number|null, "costNote": string|null (e.g. "per month", "one-time"), "specs": {"<spec label>": "<value>", ...}, "pros": string|null, "cons": string|null}]}
1-4 options. Specs: 4-10 concrete attributes actually stated (capacity, warranty, delivery time, dimensions, support terms…). Same language as the document. Never invent figures.`

async function scan(ctx: ApiContext) {
  if (!(await aiGuard(ctx.workspaceId, "ideas-scan", ctx.userId, null)))
    return err(AI_DISABLED_ERROR, 403)

  const form = await ctx.req.formData()
  const file = form.get("file") as File | null
  const mode = String(form.get("mode") || "idea")
  if (!file) return err("No file uploaded", 400)
  if (file.size > MAX_BYTES)
    return err("File exceeds the 4 MB upload limit / El archivo excede el límite de 4 MB", 400)

  const buf = Buffer.from(await file.arrayBuffer())
  const full = await extractTextFromBuffer(file.name, buf)
  if (!full?.trim()) return err("Could not extract text from this file", 422)
  const text = full.length <= MAX_CHARS ? full
    : full.slice(0, Math.floor(MAX_CHARS * 0.7))
      + "\n\n[… middle of document truncated …]\n\n"
      + full.slice(-Math.floor(MAX_CHARS * 0.3))

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: mode === "option" ? OPTION_PROMPT : IDEA_PROMPT,
      messages: [{ role: "user", content: `Document: ${file.name}\n\n${text}` }],
    }),
  })
  if (!res.ok) return err("AI request failed", 502)
  const data = await res.json()
  const raw = (data?.content || []).map((c: any) => c?.text || "").join("")
  try {
    const clean = raw.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)
    return ok({ mode, result: parsed, sourceDoc: file.name })
  } catch {
    return err("AI returned an unreadable result — try again", 502)
  }
}

export async function POST(req: NextRequest) { return withWorkspace(req, scan) }
