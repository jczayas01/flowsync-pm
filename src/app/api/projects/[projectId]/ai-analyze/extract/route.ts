// POST /api/projects/:projectId/ai-analyze/extract
// Extracts plain text from an uploaded file so the AI analyzer can read
// formats the browser can't parse client-side (.docx, .pdf, .xlsx, .pptx, .msg).
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"
import { downloadBuffer } from "@/lib/storage"
import { extractTextFromBuffer } from "@/lib/extract"
import { ocrScannedPdf, OCR_MONTHLY_PAGE_CAP } from "@/lib/ocr"

const MAX_CHARS = 20000
const PER_DOC_CHARS = 8000

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.locked) {
      return NextResponse.json(
        { error: "Your trial has ended — this workspace is read-only until you subscribe in Settings → Billing.", locked: true },
        { status: 402 })
    }
  // ── Mode A: JSON body with stored project document ids ──
  const contentType = req.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body?.documentIds) ? body.documentIds.filter(Boolean) : []
    if (!ids.length) return NextResponse.json({ error: "No documents selected" }, { status: 400 })

    const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } })
    const plan = ws?.plan || "FREE"

    const docs = await db.document.findMany({
      where: { projectId: params.projectId, id: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, fileUrl: true },
    })
    if (!docs.length) return NextResponse.json({ error: "Documents not found" }, { status: 404 })

    const chunks: string[] = []
    const used: string[] = []
    const failed: { name: string; reason: string }[] = []
    let total = 0
    for (const d of docs) {
      if (total >= MAX_CHARS) break
      try {
        if (!d.fileUrl) { failed.push({ name: d.name, reason: "no file attached to this entry" }); continue }
        const buf = await downloadBuffer(d.fileUrl)
        if (!buf) {
          // downloadBuffer is null for BOTH "storage env broken" and "object missing" —
          // the log line below is what tells us which when this fires in prod.
          console.error("[ai-extract] download failed", { doc: d.id, name: d.name, ref: d.fileUrl })
          failed.push({ name: d.name, reason: "couldn't download from storage" })
          continue
        }
        let t = (await extractTextFromBuffer(d.name, buf)).slice(0, PER_DOC_CHARS)
        let viaOcr = false
        if (!t.trim() && d.name.toLowerCase().endsWith(".pdf")) {
          // Scanned PDF — no text layer. Business+ gets AI transcription;
          // Starter gets the upgrade moment.
          const ocr = await ocrScannedPdf({
            buf, docName: d.name, workspaceId, userId: session.user.id, plan,
          })
          if (ocr.ok) {
            t = ocr.text.slice(0, PER_DOC_CHARS)
            viaOcr = true
          } else if (ocr.reason === "plan") {
            failed.push({ name: d.name,
              reason: "scanned PDF — AI reading of scans is included in the Business plan" })
            ;(failed as any).upsell = true
            continue
          } else if (ocr.reason === "cap") {
            failed.push({ name: d.name,
              reason: `scanned PDF — this workspace has used its ${OCR_MONTHLY_PAGE_CAP} AI-read pages this month` })
            continue
          } else {
            failed.push({ name: d.name, reason: "scanned PDF — AI couldn't read these pages" })
            continue
          }
        }
        if (!t.trim()) {
          failed.push({ name: d.name, reason: "no readable text found" })
          continue
        }
        chunks.push(`## Document: ${d.name}${viaOcr ? " (read from scan by AI)" : ""}\n${t}`)
        used.push(d.name)
        total += t.length
      } catch (e) {
        console.error("[ai-extract] extraction crashed", { doc: d.id, name: d.name }, e)
        failed.push({ name: d.name, reason: "file couldn't be parsed" })
      }
    }
    if (!chunks.length) {
      const detail = failed.map(f => `${f.name}: ${f.reason}`).join(" · ")
      return NextResponse.json(
        { error: detail || "Could not read any of the selected documents", failed,
          upsell: !!(failed as any).upsell },
        { status: 422 })
    }
    return NextResponse.json({
      text: chunks.join("\n\n").slice(0, MAX_CHARS),
      name: used.join(", "),
      usedDocuments: used,
    })
  }

  // ── Mode B: multipart upload from the user's computer ──
  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const text = await extractTextFromBuffer(file.name || "", buffer)
    if (!text) {
      return NextResponse.json(
        { error: "No readable text found in this file (it may be a scanned image)" },
        { status: 422 },
      )
    }
    return NextResponse.json({ text: text.slice(0, MAX_CHARS), name: file.name })
  } catch (e: any) {
    const msg = e?.message || "unknown error"
    const status = msg.includes("Legacy") ? 415 : 500
    return NextResponse.json({ error: status === 415 ? msg : `Could not extract text: ${msg}` }, { status })
  }
}
