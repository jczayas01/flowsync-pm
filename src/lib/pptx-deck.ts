// src/lib/pptx-deck.ts — branded PowerPoint generation (pptxgenjs, in-process)
import PptxGenJS from "pptxgenjs"

const NAVY = "0D1B2A"
const WHITE = "FFFFFF"
const SLATE = "64748B"
const RED = "DC2626"
const AMBER = "F59E0B"
const GREEN = "059669"

const hex = (c?: string, fb = "1B6CA8") => (c || fb).replace("#", "")
const fmtK = (n: number, cur = "USD") =>
  `${cur === "USD" ? "$" : cur + " "}${Math.abs(n) >= 1000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + "K" : Math.round(n).toString()}`
const fdate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—"

export type DeckAudience = "EXECUTIVE" | "TEAM"

export interface DeckData {
  workspace: { name: string; primaryColor?: string | null; accentColor?: string | null }
  project: {
    name: string; code: string; health?: string | null; status?: string | null
    percentComplete?: number | null; startDate?: any; endDate?: any
    budgetTotal?: any; budgetSpent?: any; currency?: string | null
    objective?: string | null
  }
  phases: { id: string; name: string; order: number }[]
  tasks: { title: string; status: string; percentComplete?: number | null; startDate?: any; dueDate?: any; phaseId?: string | null }[]
  risks: { title: string; score?: number | null; status?: string | null; isOpportunity?: boolean | null }[]
  milestones: { name: string; dueDate?: any; status?: string | null }[]
  decisions: { code?: string | null; title: string }[]
  pendingChanges: number
  budgetByCategory: { category: string; planned: number; actual: number }[]
}

export async function generateProjectDeck(data: DeckData, audience: DeckAudience): Promise<Buffer> {
  const P = hex(data.workspace.primaryColor)
  const A = hex(data.workspace.accentColor, "F59E0B")
  const cur = data.project.currency || "USD"

  // ── EVM (mirrors Budget tab exactly) ──
  const budgetTotal = Number(data.project.budgetTotal || 0)
  const budgetSpent = Number(data.project.budgetSpent || 0)
  const pctComplete = (data.project.percentComplete || 0) / 100
  const plannedPct = (() => {
    const st = data.project.startDate ? new Date(data.project.startDate).getTime() : null
    const en = data.project.endDate ? new Date(data.project.endDate).getTime() : null
    if (!st || !en || en <= st) return pctComplete
    return Math.min(1, Math.max(0, (Date.now() - st) / (en - st)))
  })()
  const BAC = budgetTotal, AC = budgetSpent
  const EV = BAC * pctComplete, PV = BAC * plannedPct
  const CPI = AC > 0 ? EV / AC : 1
  const SPI = PV > 0 ? EV / PV : 1
  const EAC = CPI > 0 ? BAC / CPI : BAC
  const VAC = BAC - EAC

  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 })
  pptx.layout = "WIDE"
  pptx.author = data.workspace.name
  pptx.title = `${data.project.name} — Status Deck`

  const brandFooter = (s: any) => {
    s.addShape("rect", { x: 0, y: 7.14, w: 13.33, h: 0.36, fill: { color: NAVY } })
    s.addShape("rect", { x: 0.55, y: 7.24, w: 0.34, h: 0.16, fill: { color: A } })
    s.addShape("rect", { x: 0.72, y: 7.28, w: 0.34, h: 0.16, fill: { color: P } })
    s.addText(`${data.workspace.name}  ·  ${data.project.code}`, {
      x: 1.2, y: 7.14, w: 8, h: 0.36, fontSize: 9, color: "B8C4D0", valign: "middle",
    })
    s.addText(fdate(new Date()), { x: 10.6, y: 7.14, w: 2.2, h: 0.36, fontSize: 9, color: "B8C4D0", align: "right", valign: "middle" })
  }
  const titleBar = (s: any, t: string) => {
    s.addText(t, { x: 0.55, y: 0.32, w: 10, h: 0.6, fontSize: 24, bold: true, color: NAVY })
    s.addShape("rect", { x: 0.57, y: 0.95, w: 1.5, h: 0.05, fill: { color: P } })
  }
  const newSlide = (t?: string) => {
    const s = pptx.addSlide()
    if (t) titleBar(s, t)
    brandFooter(s)
    return s
  }

  // ══ S1 · Title ══
  {
    const s = pptx.addSlide()
    s.background = { color: NAVY }
    s.addShape("rect", { x: 0, y: 5.3, w: 13.33, h: 0.09, fill: { color: A } })
    s.addText(data.workspace.name.toUpperCase(), { x: 0.7, y: 0.7, w: 12, h: 0.4, fontSize: 13, color: "9FB3C8", charSpacing: 3 })
    s.addText(data.project.name, { x: 0.7, y: 2.2, w: 12, h: 1.4, fontSize: 44, bold: true, color: WHITE })
    s.addText(`${data.project.code}  ·  ${audience === "EXECUTIVE" ? "Executive Briefing" : "Project Review"}`, {
      x: 0.7, y: 3.6, w: 12, h: 0.5, fontSize: 18, color: "B8C4D0",
    })
    const hcol = data.project.health === "RED" ? RED : data.project.health === "AMBER" ? AMBER : GREEN
    s.addShape("roundRect", { x: 0.7, y: 4.35, w: 2.1, h: 0.55, rectRadius: 0.1, fill: { color: hcol } })
    s.addText(`HEALTH: ${data.project.health || "GREEN"}`, { x: 0.7, y: 4.35, w: 2.1, h: 0.55, align: "center", valign: "middle", fontSize: 13, bold: true, color: WHITE })
    s.addText(fdate(new Date()), { x: 0.7, y: 5.6, w: 6, h: 0.4, fontSize: 13, color: "9FB3C8" })
  }

  // ══ S2 · Executive summary (KPI boxes) ══
  {
    const s = newSlide("Executive Summary")
    const kpis = [
      { l: "PROGRESS", v: `${Math.round((data.project.percentComplete || 0))}%`, c: P },
      { l: "BUDGET USED", v: BAC > 0 ? `${Math.round((AC / BAC) * 100)}%` : "—", sub: `${fmtK(AC, cur)} of ${fmtK(BAC, cur)}`, c: AC > BAC ? RED : P },
      { l: "OPEN HIGH RISKS", v: String(data.risks.filter(r => !r.isOpportunity && (r.score || 0) >= 12 && r.status !== "CLOSED").length), c: AMBER },
      { l: "SCHEDULE (SPI)", v: SPI.toFixed(2), c: SPI < 0.95 ? RED : GREEN },
    ]
    kpis.forEach((k, i) => {
      const x = 0.55 + i * 3.15
      s.addShape("roundRect", { x, y: 1.35, w: 2.9, h: 1.7, rectRadius: 0.08, fill: { color: "F8FAFC" }, line: { color: "E2E8F0", width: 1 } })
      s.addShape("rect", { x, y: 1.35, w: 2.9, h: 0.07, fill: { color: k.c } })
      s.addText(k.l, { x: x + 0.15, y: 1.55, w: 2.6, h: 0.3, fontSize: 10, bold: true, color: SLATE, charSpacing: 1 })
      s.addText(k.v, { x: x + 0.15, y: 1.85, w: 2.6, h: 0.75, fontSize: 34, bold: true, color: k.c })
      if ((k as any).sub) s.addText((k as any).sub, { x: x + 0.15, y: 2.6, w: 2.6, h: 0.3, fontSize: 10, color: SLATE })
    })
    if (data.project.objective) {
      s.addText("OBJECTIVE", { x: 0.55, y: 3.5, w: 3, h: 0.3, fontSize: 11, bold: true, color: P, charSpacing: 1 })
      s.addText(String(data.project.objective).slice(0, 600), { x: 0.55, y: 3.85, w: 12.2, h: 2.6, fontSize: 13, color: "334155", valign: "top" })
    }
  }

  // ══ S3 · Schedule timeline (phases from their tasks) ══
  const phaseSpans = data.phases
    .sort((a, b) => a.order - b.order)
    .map(p => {
      const pts = data.tasks.filter(t => t.phaseId === p.id && (t.startDate || t.dueDate))
      if (!pts.length) return null
      const st = Math.min(...pts.map(t => +new Date(t.startDate || t.dueDate)))
      const en = Math.max(...pts.map(t => +new Date(t.dueDate || t.startDate)))
      const pct = Math.round(pts.reduce((sm, t) => sm + (t.percentComplete || 0), 0) / pts.length)
      return { name: p.name, st, en, pct }
    })
    .filter(Boolean) as { name: string; st: number; en: number; pct: number }[]

  if (phaseSpans.length && audience !== "EXECUTIVE") {
    const s = newSlide("Schedule — Phase Timeline")
    const min = Math.min(...phaseSpans.map(p => p.st))
    const max = Math.max(...phaseSpans.map(p => p.en))
    const span = Math.max(1, max - min)
    const X0 = 2.6, W = 10.1
    phaseSpans.forEach((p, i) => {
      const y = 1.5 + i * 0.78
      const bx = X0 + ((p.st - min) / span) * W
      const bw = Math.max(0.35, ((p.en - p.st) / span) * W)
      s.addText(p.name.slice(0, 22), { x: 0.55, y, w: 2, h: 0.5, fontSize: 12, bold: true, color: NAVY, valign: "middle" })
      s.addShape("roundRect", { x: bx, y: y + 0.06, w: bw, h: 0.38, rectRadius: 0.06, fill: { color: "DBEAFE" }, line: { color: P, width: 1 } })
      if (p.pct > 0) s.addShape("roundRect", { x: bx, y: y + 0.06, w: Math.max(0.12, bw * Math.min(1, p.pct / 100)), h: 0.38, rectRadius: 0.06, fill: { color: P } })
      s.addText(`${p.pct}%`, { x: bx + bw + 0.08, y, w: 0.9, h: 0.5, fontSize: 10, color: SLATE, valign: "middle" })
    })
    // today marker
    const now = Date.now()
    if (now >= min && now <= max) {
      const tx = X0 + ((now - min) / span) * W
      s.addShape("line", { x: tx, y: 1.35, w: 0, h: Math.min(5.4, phaseSpans.length * 0.78 + 0.4), line: { color: RED, width: 1.5, dashType: "dash" } })
      s.addText("TODAY", { x: tx - 0.4, y: 1.05, w: 0.9, h: 0.3, fontSize: 8, bold: true, color: RED, align: "center" })
    }
  }

  // ══ S4 · EVM chart ══
  if (BAC > 0) {
    const s = newSlide("Earned Value Performance")
    s.addChart("bar" as any, [
      { name: "To date", labels: ["Planned Value (PV)", "Earned Value (EV)", "Actual Cost (AC)"], values: [Math.round(PV), Math.round(EV), Math.round(AC)] },
    ], {
      x: 0.55, y: 1.3, w: 7.4, h: 4.6, barDir: "col",
      chartColors: [SLATE, P, A], showValue: true, dataLabelFormatCode: "#,##0",
      catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, showLegend: false,
      dataLabelFontSize: 11, dataLabelColor: NAVY,
    } as any)
    const rows = [
      ["CPI", CPI.toFixed(2), CPI < 0.95 ? RED : GREEN, "Cost efficiency"],
      ["SPI", SPI.toFixed(2), SPI < 0.95 ? RED : GREEN, "Schedule efficiency"],
      ["EAC", fmtK(EAC, cur), EAC > BAC ? RED : NAVY, "Estimate at completion"],
      ["VAC", fmtK(VAC, cur), VAC < 0 ? RED : GREEN, "Variance at completion"],
    ]
    rows.forEach((r, i) => {
      const y = 1.45 + i * 1.05
      s.addShape("roundRect", { x: 8.35, y, w: 4.4, h: 0.88, rectRadius: 0.07, fill: { color: "F8FAFC" }, line: { color: "E2E8F0", width: 1 } })
      s.addText(String(r[0]), { x: 8.55, y: y + 0.08, w: 1.2, h: 0.4, fontSize: 13, bold: true, color: SLATE })
      s.addText(String(r[1]), { x: 9.7, y, w: 3, h: 0.55, fontSize: 20, bold: true, color: String(r[2]), align: "right", valign: "middle" })
      s.addText(String(r[3]), { x: 8.55, y: y + 0.5, w: 4, h: 0.3, fontSize: 9, color: SLATE })
    })
  }

  // ══ S5 · Budget by category (team deck) ══
  if (audience !== "EXECUTIVE" && data.budgetByCategory.length) {
    const s = newSlide("Budget by Category")
    const cats = data.budgetByCategory
    s.addChart("bar" as any, [
      { name: "Planned", labels: cats.map(c => c.category), values: cats.map(c => Math.round(c.planned)) },
      { name: "Actual", labels: cats.map(c => c.category), values: cats.map(c => Math.round(c.actual)) },
    ], {
      x: 0.55, y: 1.3, w: 12.2, h: 5.2, barDir: "col", barGrouping: "clustered",
      chartColors: [P, A], showLegend: true, legendPos: "t",
      catAxisLabelFontSize: 10, valAxisLabelFontSize: 10, dataLabelFormatCode: "#,##0",
    } as any)
  }

  // ══ S6 · Top risks ══
  const topRisks = data.risks
    .filter(r => !r.isOpportunity && r.status !== "CLOSED")
    .sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5)
  if (topRisks.length) {
    const s = newSlide("Top Risks")
    const rows: any[] = [[
      { text: "Risk", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 12 } },
      { text: "Score", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 12, align: "center" } },
      { text: "Status", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 12, align: "center" } },
    ]]
    topRisks.forEach(r => {
      const sc = r.score || 0
      const scol = sc >= 15 ? RED : sc >= 9 ? AMBER : GREEN
      rows.push([
        { text: r.title.slice(0, 90), options: { fontSize: 12, color: "334155" } },
        { text: String(sc), options: { fontSize: 12, bold: true, color: WHITE, fill: { color: scol }, align: "center" } },
        { text: String(r.status || "OPEN").replace(/_/g, " "), options: { fontSize: 11, color: SLATE, align: "center" } },
      ])
    })
    s.addTable(rows, { x: 0.55, y: 1.35, w: 12.2, colW: [9.2, 1.4, 1.6], rowH: 0.55, border: { color: "E2E8F0", pt: 1 }, valign: "middle" })
  }

  // ══ S7 · Decisions & changes ══
  {
    const s = newSlide("Decisions & Pending Changes")
    s.addText("RECENT DECISIONS", { x: 0.55, y: 1.3, w: 6, h: 0.3, fontSize: 11, bold: true, color: P, charSpacing: 1 })
    if (data.decisions.length) {
      data.decisions.slice(0, 5).forEach((d, i) => {
        s.addText([
          { text: `${d.code || "DEC"}  `, options: { bold: true, color: P } },
          { text: d.title.slice(0, 70), options: { color: "334155" } },
        ], { x: 0.55, y: 1.7 + i * 0.5, w: 7.4, h: 0.45, fontSize: 12 })
      })
    } else {
      s.addText("No decisions recorded yet.", { x: 0.55, y: 1.7, w: 7, h: 0.4, fontSize: 12, color: SLATE, italic: true })
    }
    s.addShape("roundRect", { x: 8.5, y: 1.6, w: 4.25, h: 2, rectRadius: 0.08, fill: { color: data.pendingChanges > 0 ? "FFFBEB" : "F8FAFC" }, line: { color: data.pendingChanges > 0 ? A : "E2E8F0", width: 1 } })
    s.addText(String(data.pendingChanges), { x: 8.5, y: 1.8, w: 4.25, h: 1, fontSize: 44, bold: true, color: data.pendingChanges > 0 ? A : SLATE, align: "center" })
    s.addText("CHANGE REQUESTS PENDING", { x: 8.5, y: 2.85, w: 4.25, h: 0.4, fontSize: 10, bold: true, color: SLATE, align: "center", charSpacing: 1 })
  }

  // ══ S8 · Upcoming milestones + close ══
  {
    const s = newSlide("Next Steps")
    const upcoming = data.milestones
      .filter(m => m.status !== "ACHIEVED" && m.dueDate)
      .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate)).slice(0, 5)
    s.addText("UPCOMING MILESTONES", { x: 0.55, y: 1.3, w: 6, h: 0.3, fontSize: 11, bold: true, color: P, charSpacing: 1 })
    if (upcoming.length) {
      upcoming.forEach((m, i) => {
        s.addShape("ellipse", { x: 0.6, y: 1.78 + i * 0.6, w: 0.14, h: 0.14, fill: { color: A } })
        s.addText([
          { text: `${fdate(m.dueDate)}  —  `, options: { bold: true, color: NAVY } },
          { text: m.name.slice(0, 70), options: { color: "334155" } },
        ], { x: 0.9, y: 1.62 + i * 0.6, w: 11.5, h: 0.5, fontSize: 13 })
      })
    } else {
      s.addText("No dated milestones ahead — consider setting phase-gate milestones.", { x: 0.55, y: 1.7, w: 11, h: 0.4, fontSize: 12, color: SLATE, italic: true })
    }
    s.addText("Generated by FlowSync PM — industry-standard PM practices", { x: 0.55, y: 6.3, w: 12, h: 0.4, fontSize: 10, color: SLATE, italic: true })
  }

  const out = await (pptx as any).write({ outputType: "nodebuffer" })
  return out as Buffer
}
