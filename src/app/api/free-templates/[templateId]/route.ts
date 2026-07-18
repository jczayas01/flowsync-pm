// src/app/api/free-templates/[templateId]/route.ts
// GET — download a blank PM template. PUBLIC on purpose.
//
// The in-app route (/api/doc-templates/[id]) requires a session, which is right
// for the product. These pages are the opposite: a person searching "project
// charter template" will not create an account to see whether the file is any
// good. Gating the download would earn zero rankings and zero goodwill.
//
// The file is generated on demand from the same builder the app uses, so the
// thing they download is exactly the thing the product round-trips.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getDocTemplate } from "@/lib/doc-templates"
import { buildTemplate } from "@/lib/doc-template-gen"
import { checkRateLimit } from "@/lib/security/rate-limiter"

export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string } },
) {
  // Generous — a human downloading a few templates is normal; this only stops
  // someone hammering the generator.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const rl = checkRateLimit(ip, { keyPrefix: "free-template", windowMs: 10 * 60 * 1000, maxRequests: 40 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many downloads. Try again shortly." }, { status: 429 })
  }

  const template = getDocTemplate(params.templateId)
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 })

  const locale = req.nextUrl.searchParams.get("lang") === "es" ? "es" : "en"

  try {
    const { buf, filename, mime } = await buildTemplate(params.templateId, locale as "en" | "es")
    return new NextResponse(buf as any, {
      headers: {
        "Content-Type":        mime,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "public, max-age=3600",
      },
    })
  } catch (e) {
    console.error("[free-templates]", params.templateId, e)
    return NextResponse.json({ error: "Couldn't generate that template." }, { status: 500 })
  }
}
