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
  charts?: {
    scurve?: { label: string; pv: number; ev: number; ac: number }[]
    statusCounts?: { label: string; count: number; hex: string }[]
    budget?: { bac: number; ac: number; eac: number }
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
    page.drawRectangle({ x: 0, y: PAGE_H - 44, width: PAGE_W, height: 44, color: brand })
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

  // ── Vector chart drawing (no rasterization — crisp at any zoom) ──────
  const money = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K`
    : `$${Math.round(n)}`

  const AMBER = rgb(245/255, 158/255, 11/255)
  const LIGHT = rgb(226/255, 232/255, 240/255)

  const drawSCurve = (series: NonNullable<typeof opts.charts>["scurve"]) => {
    if (!series || series.length < 2) return
    const H = 150, W = PAGE_W - 2 * M - 60, X0 = M + 46
    ensure(H + 46)
    const top = y, bottom = y - H
    const maxV = Math.max(1, ...series.flatMap(p => [p.pv, p.ev, p.ac]))
    const px = (i: number) => X0 + (i / (series.length - 1)) * W
    const py = (v: number) => bottom + (v / maxV) * H

    // gridlines + y labels (0 / 50 / 100%)
    for (const f of [0, 0.5, 1]) {
      const gy = bottom + f * H
      page.drawLine({ start: { x: X0, y: gy }, end: { x: X0 + W, y: gy },
        thickness: 0.5, color: LIGHT })
      const lbl = money(maxV * f)
      page.drawText(lbl, { x: X0 - 8 - font.widthOfTextAtSize(lbl, 7.5), y: gy - 2.5,
        size: 7.5, font, color: GRAY })
    }
    // x labels: first / mid / last
    for (const i of [0, Math.floor((series.length - 1) / 2), series.length - 1]) {
      const lbl = series[i].label
      page.drawText(lbl, { x: px(i) - font.widthOfTextAtSize(lbl, 7.5) / 2, y: bottom - 12,
        size: 7.5, font, color: GRAY })
    }
    // series
    const line = (key: "pv" | "ev" | "ac", color: ReturnType<typeof rgb>, thickness: number, dash?: number[]) => {
      for (let i = 1; i < series.length; i++) {
        page.drawLine({
          start: { x: px(i - 1), y: py(series[i - 1][key]) },
          end:   { x: px(i),     y: py(series[i][key]) },
          thickness, color, ...(dash ? { dashArray: dash } : {}),
        })
      }
    }
    line("pv", GRAY, 1.2, [4, 3])
    line("ev", brand, 1.8)
    line("ac", AMBER, 1.8)
    // legend
    const legend: [string, ReturnType<typeof rgb>][] = [["Planned", GRAY], ["Earned", brand], ["Actual cost", AMBER]]
    let lx = X0
    for (const [name, color] of legend) {
      page.drawLine({ start: { x: lx, y: top + 10 }, end: { x: lx + 14, y: top + 10 },
        thickness: 2, color })
      page.drawText(name, { x: lx + 18, y: top + 7, size: 8, font, color: TEXT })
      lx += 18 + font.widthOfTextAtSize(name, 8) + 18
    }
    y = bottom - 26
  }

  const drawStatusBar = (counts: NonNullable<typeof opts.charts>["statusCounts"]) => {
    if (!counts?.length) return
    const total = counts.reduce((s, c) => s + c.count, 0)
    if (!total) return
    const W = PAGE_W - 2 * M, H = 14
    ensure(H + 40)
    let x = M
    for (const c of counts) {
      const w = (c.count / total) * W
      page.drawRectangle({ x, y: y - H, width: Math.max(w, 0.5), height: H, color: hexToRgb(c.hex) })
      x += w
    }
    y -= H + 12
    // legend
    let lx = M
    for (const c of counts) {
      page.drawRectangle({ x: lx, y: y - 1, width: 7, height: 7, color: hexToRgb(c.hex) })
      const lbl = `${c.label} (${c.count})`
      page.drawText(lbl, { x: lx + 11, y, size: 8, font, color: TEXT })
      lx += 11 + font.widthOfTextAtSize(lbl, 8) + 16
    }
    y -= 22
  }

  const drawBudgetBullet = (b: NonNullable<typeof opts.charts>["budget"]) => {
    if (!b || b.bac <= 0) return
    const W = PAGE_W - 2 * M, H = 16
    const max = Math.max(b.bac, b.eac, b.ac) * 1.05
    const px = (v: number) => M + Math.min(1, v / max) * W
    ensure(H + 52)
    const over = b.eac > b.bac
    const RED   = rgb(220/255, 38/255, 38/255)
    const GREEN = rgb(5/255, 150/255, 105/255)
    // track + AC bar
    page.drawRectangle({ x: M, y: y - H, width: W, height: H, color: rgb(241/255, 245/255, 249/255) })
    page.drawRectangle({ x: M, y: y - H + 3, width: Math.max(px(b.ac) - M, 0.5), height: H - 6,
      color: over ? RED : STEEL })
    // EAC + BAC markers with labels
    const mark = (v: number, color: ReturnType<typeof rgb>, lbl: string, above: boolean) => {
      const mx = px(v)
      page.drawLine({ start: { x: mx, y: y - H - 4 }, end: { x: mx, y: y + 4 }, thickness: 1.6, color })
      const w = bold.widthOfTextAtSize(lbl, 7.5)
      page.drawText(lbl, { x: Math.min(Math.max(mx - w / 2, M), PAGE_W - M - w),
        y: above ? y + 8 : y - H - 14, size: 7.5, font: bold, color })
    }
    mark(b.eac, over ? RED : GREEN, `EAC ${money(b.eac)}`, true)
    mark(b.bac, NAVY, `Budget ${money(b.bac)}`, false)
    y -= H + 20
    page.drawText(`Spent ${money(b.ac)} · ${Math.round((b.ac / b.bac) * 100)}% of budget`, {
      x: M, y, size: 8.5, font, color: GRAY })
    y -= 18
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

  const ch = opts.charts
  if (ch && (ch.scurve?.length || ch.statusCounts?.length || ch.budget)) {
    heading("Performance Snapshot")
    if (ch.scurve?.length)       drawSCurve(ch.scurve)
    if (ch.statusCounts?.length) drawStatusBar(ch.statusCounts)
    if (ch.budget)               drawBudgetBullet(ch.budget)
  }
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
