// src/app/api/projects/[projectId]/documents/route.ts
// GET  — list project documents
// POST — upload a file to Supabase Storage, record metadata in DB
// PUT  — update wiki blocks (existing doc editor behavior)

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess, audit, ok, err } from "@/lib/api"
import { can, mapDbRoleToRbac } from "@/lib/rbac/roles"
import { uploadFile, BUCKET } from "@/lib/storage"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId

  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const documents = await db.document.findMany({
    where:   { projectId: params.projectId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id:true, name:true, avatarUrl:true } } },
  })

  return NextResponse.json({ data: documents })
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId

  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const uMember = await db.workspaceMember.findFirst({
    where: { userId: session.user.id, workspaceId }, select: { role: true },
  })
  if (!can(mapDbRoleToRbac(uMember?.role), "files:upload")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const description = formData.get("description") as string | null

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large — maximum 50 MB" }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 })
  }

  // Upload to Supabase Storage
  const ext  = file.name.split(".").pop() || "bin"
  const path = `${params.projectId}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "_")}`

  const { url, error: uploadError } = await uploadFile(file, path, file.type)
  if (uploadError) {
    console.error("[Documents] Storage upload failed:", uploadError)
    return NextResponse.json({ error: `Upload failed: ${uploadError}` }, { status: 500 })
  }

  // Record in DB
  try {
    const document = await db.document.create({
      data: {
        projectId:    params.projectId,
        name:         file.name,
        description:  description || null,
        fileUrl:      url,
        fileType:     file.type,
        fileSize:     file.size,
        uploadedById: session.user.id,
      },
      include: { uploadedBy: { select: { id:true, name:true, avatarUrl:true } } },
    })

    await audit(workspaceId, session.user.id, "document.uploaded", "project", params.projectId,
      undefined, { fileName: file.name, fileSize: file.size })

    return NextResponse.json({ data: document }, { status: 201 })
  } catch (dbErr: any) {
    console.error("[Documents] DB insert failed:", dbErr?.message)
    return NextResponse.json({ error: `Database error: ${dbErr?.message}` }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { projectId: string } }) {
  // Wiki block editor save (existing behavior)
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { blocks } = await req.json()

  await db.$executeRaw`
    INSERT INTO project_documents (project_id, content, updated_by)
    VALUES (${params.projectId}, ${JSON.stringify(blocks)}, ${session.user.id})
    ON CONFLICT DO NOTHING
  `
  await db.$executeRaw`
    UPDATE project_documents
    SET content = ${JSON.stringify(blocks)}, updated_at = NOW(), updated_by = ${session.user.id}
    WHERE project_id = ${params.projectId}
  `

  return NextResponse.json({ success: true })
}
