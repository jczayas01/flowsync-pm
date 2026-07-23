// src/app/api/workspace/logo/route.ts
// Workspace logo upload + serving.
//
// POST  multipart form ("file") → validates, stores at a fixed path in the
//       private bucket, sets workspace.logoUrl to this route's GET URL.
// GET   ?ws=<workspaceId>&v=<cachebust> → streams the image. Public on
//       purpose: reports, exports and email templates embed this URL and
//       cannot send a session. The path is derived from the workspace cuid.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { uploadFile, supabase, BUCKET } from "@/lib/storage"

export const dynamic = "force-dynamic"

const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
}
const MAX_BYTES = 1_000_000 // 1 MB

const logoPath = (workspaceId: string) => `branding/${workspaceId}/logo`

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const member = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId: true, role: true },
  })
  if (!member) return NextResponse.json({ error: "No workspace" }, { status: 404 })
  if (!["ADMIN", "SYSTEM_ADMIN"].includes(member.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  let form: FormData
  try { form = await req.formData() }
  catch { return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 }) }

  const file = form.get("file")
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (!ALLOWED[file.type]) {
    return NextResponse.json({ error: "Use a PNG, JPG, SVG or WebP image" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Logo must be under 1 MB" }, { status: 400 })
  }

  const up = await uploadFile(file, logoPath(member.workspaceId), file.type, { upsert: true })
  if (up.error) {
    return NextResponse.json({ error: `Upload failed: ${up.error}` }, { status: 500 })
  }

  // v busts caches (report views, app shell) after each replacement.
  const logoUrl = `/api/workspace/logo?ws=${member.workspaceId}&v=${Date.now()}`
  await db.workspace.update({
    where: { id: member.workspaceId },
    data:  { logoUrl },
  })

  return NextResponse.json({ data: { logoUrl } })
}

export async function GET(req: NextRequest) {
  const ws = req.nextUrl.searchParams.get("ws") || ""
  if (!/^[a-z0-9]{10,40}$/i.test(ws)) {
    return NextResponse.json({ error: "Bad workspace id" }, { status: 400 })
  }

  const { data, error } = await supabase.storage.from(BUCKET).download(logoPath(ws))
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return new NextResponse(data.stream(), {
    headers: {
      "Content-Type": data.type || "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  })
}
