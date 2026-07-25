// src/app/api/admin/contracts/[contractId]/documents/[docId]/route.ts
// GET streams the stored file (platform-admin only). DELETE removes DB row
// and storage object.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/admin-gate"
import { supabase, BUCKET, deleteFile } from "@/lib/storage"

export async function GET(_req: NextRequest,
  { params }: { params: { contractId: string; docId: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const doc = await db.contractDocument.findFirst({
    where: { id: params.docId, contractId: params.contractId },
  })
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data, error } = await supabase.storage.from(BUCKET).download(doc.storagePath)
  if (error || !data) return NextResponse.json({ error: "File missing in storage" }, { status: 404 })

  return new NextResponse(data.stream(), {
    headers: {
      "Content-Type": doc.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${doc.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  })
}

export async function DELETE(_req: NextRequest,
  { params }: { params: { contractId: string; docId: string } }) {
  const session = await requirePlatformAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const doc = await db.contractDocument.findFirst({
    where: { id: params.docId, contractId: params.contractId },
    select: { id: true, storagePath: true },
  })
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await deleteFile(doc.storagePath).catch(() => {})
  await db.contractDocument.delete({ where: { id: doc.id } })
  return NextResponse.json({ data: { deleted: true } })
}
