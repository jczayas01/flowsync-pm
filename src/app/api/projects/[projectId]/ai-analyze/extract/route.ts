// POST /api/projects/:projectId/ai-analyze/extract
// Extracts plain text from an uploaded file so the AI analyzer can read
// formats the browser can't parse client-side (.docx, .pdf).
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"

const MAX_CHARS = 20000

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const name = (file.name || "").toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    let text = ""

    if (name.endsWith(".docx") || name.endsWith(".doc")) {
      const mammoth: any = await import("mammoth")
      const extract = mammoth.extractRawText || mammoth.default?.extractRawText
      const result = await extract({ buffer })
      text = result?.value || ""
    } else if (name.endsWith(".pdf")) {
      const { extractText } = await import("unpdf")
      const result = await extractText(new Uint8Array(buffer), { mergePages: true })
      text = (result?.text as string) || ""
    } else if (name.endsWith(".xlsx")) {
      const ExcelJSmod: any = await import("exceljs")
      const ExcelJS = ExcelJSmod.default || ExcelJSmod
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      const out: string[] = []
      wb.eachSheet((ws: any) => {
        out.push(`## Sheet: ${ws.name}`)
        ws.eachRow((row: any) => {
          const vals = (row.values || []).slice(1).map((v: any) => {
            if (v == null) return ""
            if (v instanceof Date) return v.toISOString().slice(0, 10)
            if (typeof v === "object") {
              return v.text || v.result ||
                (v.richText ? v.richText.map((r: any) => r.text).join("") : "") || ""
            }
            return String(v)
          })
          out.push(vals.join("\t"))
        })
      })
      text = out.join("\n")
    } else if (name.endsWith(".pptx")) {
      const JSZip = ((await import("jszip")) as any).default
      const zip = await JSZip.loadAsync(buffer)
      const num = (n: string) => parseInt(n.match(/slide(\d+)/)?.[1] || "0")
      const slides = Object.keys(zip.files)
        .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => num(a) - num(b))
      const dec = (s: string) => s
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      const out: string[] = []
      for (const sf of slides) {
        const xml = await zip.files[sf].async("string")
        const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)]
          .map(m => dec(m[1])).filter(Boolean)
        out.push(`## Slide ${num(sf)}\n${texts.join(" ")}`)
      }
      text = out.join("\n")
    } else if (name.endsWith(".xls") || name.endsWith(".ppt")) {
      return NextResponse.json(
        { error: "Legacy .xls/.ppt formats aren't supported — save the file as .xlsx or .pptx and try again" },
        { status: 415 },
      )
    } else {
      // Plain-text formats
      text = buffer.toString("utf-8")
    }

    text = (text || "").trim()
    if (!text) {
      return NextResponse.json(
        { error: "No readable text found in this file (it may be a scanned image)" },
        { status: 422 },
      )
    }

    return NextResponse.json({ text: text.slice(0, MAX_CHARS), name: file.name })
  } catch (e: any) {
    return NextResponse.json(
      { error: `Could not extract text: ${e?.message || "unknown error"}` },
      { status: 500 },
    )
  }
}
