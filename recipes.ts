// src/app/api/templates/[templateId]/route.ts
// GET /api/templates/:id — get template detail with full phase/task data

import { NextRequest, NextResponse } from "next/server"
import { SYSTEM_TEMPLATES } from "@/lib/templates/library"
import { db } from "@/lib/db"

export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const { templateId } = params

  // Check system templates first
  const systemTemplate = SYSTEM_TEMPLATES.find(t => t.id === templateId)
  if (systemTemplate) {
    return NextResponse.json({ data: { ...systemTemplate, source: "system" } })
  }

  // Check database
  const dbTemplate = await db.template.findUnique({
    where:   { id: templateId },
    include: { workspace: { select: { name: true, logoUrl: true, primaryColor: true } } },
  })

  if (!dbTemplate) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  return NextResponse.json({ data: { ...dbTemplate, source: "workspace" } })
}
