// src/lib/pdf-report.ts — branded status-report PDF via pdf-lib (Vercel-safe, in-process)
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib"

const PAGE_W = 612, PAGE_H = 792           // US Letter
const M = 54                                // margins
const NAVY  = rgb(13/255, 27/255, 42/255)
const STEEL = rgb(27/255, 108/255, 168/255)
const GRAY  = rgb(100/255, 116/255, 139/255)
const TEXT  = rgb(30/255, 41/255, 59/255)

function hexToRgb(hex?: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "")
  if (!m) return STEEL
  const n = parseInt(m[1], 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = []
  for (const raw of String(text || "").split("\n")) {
    const words = raw.split(/\s+/).filter(Boolean)
    if (!words.length) { out.push(""); continue }
    let line = ""
    for (const w of words) {
      const probe = line ? line + " " + w : w
      if (font.widthOfTextAtSize(probe, size) <= maxW) line = probe
      else { if (line) out.push(line); line = w }
    }
    if (line) out.push(line)
  }
  return out
}

// pdf-lib's standard fonts are WinAnsi (cp1252) — characters like >=, checkmarks
// or arrows crash encoding. Map common symbols to ASCII and strip anything else
// outside cp1252, applied to every string before drawing.
const SYMBOL_MAP: Record<string, string> = {
  "\u2265": ">=", "\u2264": "<=", "\u2260": "!=", "\u2248": "~",
  "\u2713": "[ok]", "\u2714": "[ok]", "\u2717": "x", "\u2718": "x",
  "\u2192": "->", "\u2190": "<-", "\u2194": "<->",
  "\u00d7": "x", "\u00b1": "+/-", "\u26a1": "",
}
const CP1252_EXTRA = "\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178"
function pdfSafe(input: any): string {
  let t = String(input ?? "")
  for (const [k, v] of Object.entries(SYMBOL_MAP)) t = t.split(k).join(v)
  let out = ""
  for (const ch of t) {
    const c = ch.codePointAt(0) || 0
    out += (c <= 0xFF || CP1252_EXTRA.includes(ch)) ? ch : "?"
  }
  return out
}

export async function generateReportPdf(opts: {
  org: string
  color?: string
  projectName: string
  projectCode: string
  report: {
    reportTitle?: string
    executiveSummary?: string
    accomplishmentsThisWeek?: string[]
    plannedNextWeek?: string[]
    budgetStatus?: string
    scheduleStatus?: string
    risksAndIssues?: string
    decisionsNeeded?: string[]
  }
}): Promise<Uint8Array> {
  // Sanitize every string in the payload once, up front.
  const __deep = (v: any): any => typeof v === "string" ? pdfSafe(v)
    : Array.isArray(v) ? v.map(__deep)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, __deep(x)]))
    : v
  opts = __deep(opts)

  const { org, projectName, projectCode, report } = opts
  const brand = hexToRgb(opts.color)

  const pdf = await PDFDocument.create()
  const font  = await pdf.embedFont(StandardFonts.Helvetica)
  const bold  = await pdf.embedFont(StandardFonts.HelveticaBold)

  let page!: PDFPage   // assigned by newPage() before any use
  let y = 0
  const pages: PDFPage[] = []

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H])
    pages.push(page)
    // header band
    page.drawRectangle({ x: 0, y: PAGE_H - 44, width: PAGE_W, height: 44, color: NAVY })
    page.drawText(org.toUpperCase(), { x: M, y: PAGE_H - 28, size: 10, font: bold, color: rgb(1,1,1) })
    page.drawText(`${projectName} (${projectCode})`, {
      x: PAGE_W - M - bold.widthOfTextAtSize(`${projectName} (${projectCode})`, 9),
      y: PAGE_H - 28, size: 9, font, color: rgb(0.8, 0.85, 0.92),
    })
    y = PAGE_H - 44 - 34
  }

  const ensure = (need: number) => { if (y - need < M + 24) newPage() }

  const heading = (t: string) => {
    ensure(30)
    page.drawText(t, { x: M, y, size: 12.5, font: bold, color: brand })
    y -= 6
    page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.7, color: brand, opacity: 0.5 })
    y -= 14
  }

  const para = (t: string, size = 10.5) => {
    for (const ln of wrap(t, font, size, PAGE_W - 2 * M)) {
      ensure(size + 5)
      if (ln) page.drawText(ln, { x: M, y, size, font, color: TEXT })
      y -= size + 4.5
    }
    y -= 4
  }

  const bullets = (items: string[]) => {
    for (const it of items || []) {
      const lines = wrap(it, font, 10.5, PAGE_W - 2 * M - 14)
      lines.forEach((ln, i) => {
        ensure(15)
        if (i === 0) page.drawText("•", { x: M, y, size: 10.5, font: bold, color: brand })
        page.drawText(ln, { x: M + 14, y, size: 10.5, font, color: TEXT })
        y -= 15
      })
    }
    y -= 4
  }

  newPage()

  // Title
  const title = report.reportTitle || "Status Report"
  for (const ln of wrap(title, bold, 20, PAGE_W - 2 * M)) {
    ensure(26); page.drawText(ln, { x: M, y, size: 20, font: bold, color: NAVY }); y -= 26
  }
  page.drawText(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
    { x: M, y, size: 10, font, color: GRAY })
  y -= 26

  if (report.executiveSummary) { heading("Executive Summary"); para(report.executiveSummary) }
  if (report.accomplishmentsThisWeek?.length) { heading("Accomplishments"); bullets(report.accomplishmentsThisWeek) }
  if (report.plannedNextWeek?.length) { heading("Planned Next Period"); bullets(report.plannedNextWeek) }
  if (report.budgetStatus) { heading("Budget Status"); para(report.budgetStatus) }
  if (report.scheduleStatus) { heading("Schedule Status"); para(report.scheduleStatus) }
  if (report.risksAndIssues) { heading("Risks & Issues"); para(report.risksAndIssues) }
  if (report.decisionsNeeded?.length) { heading("Decisions Needed"); bullets(report.decisionsNeeded) }

  // Footers
  pages.forEach((pg, i) => {
    pg.drawText(`${org} · Page ${i + 1} of ${pages.length}`, {
      x: M, y: 30, size: 8, font, color: GRAY,
    })
  })

  return pdf.save()
}
