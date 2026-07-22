// src/app/api/projects/[projectId]/ai-analyze/ledger/route.ts
// GET — distribution ledger for this project (optionally one document):
// what was created from which source, for the Docs tab history panels.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { verifyProjectAccess } from "@/lib/api"

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  const workspaceId = req.headers.get("x-workspace-id") ||
    url.searchParams.get("workspaceId") || (session.user as any).activeWorkspaceId
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })
  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const documentId = url.searchParams.get("documentId")
  const rows = await db.documentExtraction.findMany({
    where:   { projectId: params.projectId, ...(documentId ? { documentId } : {}) },
    orderBy: { createdAt: "desc" },
    take:    200,
    select:  { id: true, documentId: true, sourceLabel: true, itemType: true,
               itemCode: true, title: true, createdAt: true },
  })
  return NextResponse.json({ data: rows })
}
