// POST /api/locale — set the UI language cookie
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const locale = body?.locale === "es" ? "es" : "en"
  cookies().set("fs_locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" })
  return NextResponse.json({ locale })
}
