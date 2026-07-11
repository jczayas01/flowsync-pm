// src/app/api/intake/[id]/files/route.ts
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { uploadFile, signRef } from "@/lib/storage"
import { mapDbRoleToRbac } from "@/lib/rbac/roles"

// POST /api/intake/:id/files — attach a file to an intake idea
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })

  const intake = await db.projectIntake.findFirst({
    where: { id: params.id, workspaceId }, select: { id: true, submittedById: true },
  })
  if (!intake) return NextResponse.json({ error: "Intake not found" }, { status: 404 })

  // Clients can't attach; submitter or any non-client member can
  const member = await db.workspaceMember.findFirst({ where: { userId: session.user.id, workspaceId }, select: { role: true } })
  if (mapDbRoleToRbac(member?.role) === "CLIENT") {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 })

  const path = `intake/${params.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`
  const { path: storedPath, error } = await uploadFile(file, path, file.type)
  if (error || !storedPath) return NextResponse.json({ error: "Upload failed" }, { status: 500 })

  const rec = await db.intakeFile.create({
    data: { intakeId: params.id, name: file.name, fileUrl: storedPath, fileType: file.type, fileSize: file.size },
  })
  return NextResponse.json({ file: { ...rec, fileUrl: await signRef(rec.fileUrl) } })
}
