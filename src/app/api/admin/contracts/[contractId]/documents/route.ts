// src/app/api/admin/contracts/[contractId]/documents/route.ts
// Signed MSA / invoice PDFs attached to a customer contract.
// POST multipart ("file", optional "title") → private storage; GET → list.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/admin-gate"
import { uploadFile } from "@/lib/storage"

const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png", "image/jpeg",
])
const MAX_BYTES = 4_000_000 // 4 MB — Vercel body cap is 4.5 MB; see projects documents route

export async function POST(req: NextRequest, { params }: { params: { contractId: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const contract = await db.customerContract.findUnique({
    where: { id: params.contractId }, select: { id: true } })
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 })

  let form: FormData
  try { form = await req.formData() }
  catch { return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 }) }

  const file = form.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 })
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "PDF, Word, PNG or JPG only" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds the 4 MB upload limit — compress the PDF (e.g. Acrobat > Reduce File Size) or split it / El archivo excede el límite de 4 MB — comprime el PDF (Acrobat > Reducir tamaño) o divídelo" }, { status: 400 })
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120)
  const path = `contracts/${params.contractId}/${Date.now()}-${safeName}`
  const up = await uploadFile(file, path, file.type)
  if (up.error) return NextResponse.json({ error: `Upload failed: ${up.error}` }, { status: 500 })

  const doc = await db.contractDocument.create({
    data: {
      contractId:   params.contractId,
      title:        String(form.get("title") || file.name),
      fileName:     file.name,
      storagePath:  path,
      contentType:  file.type,
      sizeBytes:    file.size,
      uploadedById: session.user.id,
    },
  })
  return NextResponse.json({ data: { id: doc.id } }, { status: 201 })
}

export async function GET(_req: NextRequest, { params }: { params: { contractId: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const docs = await db.contractDocument.findMany({
    where: { contractId: params.contractId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, fileName: true, sizeBytes: true, createdAt: true },
  })
  return NextResponse.json({ data: docs })
}
