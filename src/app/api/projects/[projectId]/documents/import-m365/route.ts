// src/app/api/projects/[projectId]/documents/import-m365/route.ts
// Copies selected OneDrive/SharePoint files into the project's Docs.
// One-way snapshot import (true sync is a separate roadmap item): the file is
// downloaded server-side from Graph and stored in our own bucket, so it
// behaves exactly like an uploaded document — AI analyzer included.
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, verifyProjectAccess, audit, ApiContext } from "@/lib/api"
import { requireFeature } from "@/lib/stripe/guards"
import { requirePermission } from "@/lib/rbac/guards"
import { uploadBuffer } from "@/lib/storage"
import { downloadDriveItem } from "@/lib/m365/files"

const MAX_BYTES = 25_000_000 // 25 MB per file
const schema = z.object({
  files: z.array(z.object({
    driveId: z.string().min(1),
    itemId:  z.string().min(1),
  })).min(1).max(12),
})

async function post(ctx: ApiContext, params?: Record<string, string>) {
  { const g = await requirePermission(ctx as any, "files:upload" as any); if (g) return g }
  const gate = await requireFeature(ctx.workspaceId, "m365")
  if (gate) return gate

  const projectId = params?.projectId
  if (!projectId) return notFound("Project")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const body = await ctx.req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return err("Invalid input")

  const imported: any[] = []
  const failed: { name: string; reason: string }[] = []

  for (const f of parsed.data.files) {
    let name = f.itemId
    try {
      const file = await downloadDriveItem(ctx.userId, f.driveId, f.itemId)
      name = file.name
      if (file.size > MAX_BYTES) { failed.push({ name, reason: "over 25 MB" }); continue }

      const safe = file.name.replace(/[^\w.\- ()]+/g, "_").slice(0, 140)
      const path = `projects/${projectId}/${Date.now()}-${safe}`
      const up = await uploadBuffer(file.buffer, path, file.mimeType)
      if (up.error) { failed.push({ name, reason: up.error }); continue }

      const doc = await db.document.create({
        data: {
          projectId,
          name:         file.name,
          description:  "Imported from Microsoft 365",
          fileUrl:      path,
          fileType:     file.mimeType,
          fileSize:     file.size,
          uploadedById: ctx.userId,
        },
        include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
      })
      imported.push(doc)
    } catch (e: any) {
      failed.push({ name, reason:
        e?.code === "needs_reconnect" ? "reconnect Microsoft 365 to grant file access"
        : e?.code === "not_connected" ? "Microsoft 365 not connected"
        : e?.message || "download failed" })
    }
  }

  if (imported.length) {
    await audit(ctx.workspaceId, ctx.userId, "document.imported_m365" as any, "project", projectId,
      { count: imported.length }).catch(() => {})
  }
  return ok({ imported, failed })
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, post, params)
}
