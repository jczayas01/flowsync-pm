// src/app/api/doc-templates/[templateId]/route.ts
// GET — generate a blank PM document template and stream it back.
// Nothing is stored; the file is built per request in the requested language.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { buildTemplate } from "@/lib/doc-template-gen"
import { getDocTemplate } from "@/lib/doc-templates"

export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string } },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const t = getDocTemplate(params.templateId)
  if (!t) return NextResponse.json({ error: "Template not found" }, { status: 404 })

  const locale = req.nextUrl.searchParams.get("locale") === "es" ? "es" : "en"

  try {
    const { buf, filename, mime } = await buildTemplate(params.templateId, locale)
    return new NextResponse(buf as any, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    console.error("[DocTemplate]", params.templateId, e)
    return NextResponse.json({ error: "Could not generate that template." }, { status: 500 })
  }
}
