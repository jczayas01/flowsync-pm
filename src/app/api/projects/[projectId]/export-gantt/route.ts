// src/app/api/projects/[projectId]/export-gantt/route.ts
//
// The Gantt as a spreadsheet.
//
// A screenshot of a chart is a picture of a schedule; this is the schedule. The
// left columns are the task list a PM already reads, and to the right is a real
// timeline grid where each cell is a period and the filled run of cells is the
// bar. It opens in Excel, Google Sheets or Numbers, on a machine that has never
// heard of FlowSync PM — which is the point: the person who most needs the
// schedule is usually the one without a login.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withWorkspace, err, notFound, verifyProjectAccess, ApiContext } from "@/lib/api"

// Status colours mirror the app so the two never tell different stories.
const FILL = {
  DONE:        "FF059669",
  IN_PROGRESS: "FF1B6CA8",
  IN_REVIEW:   "FF7C3AED",
  BLOCKED:     "FFDC2626",
  TODO:        "FF94A3B8",
  BACKLOG:     "FFCBD5E1",
  CANCELLED:   "FFE2E8F0",
} as const
const NAVY = "FF0D1B2A", AMBER = "FFF59E0B", LINE = "FFD7DCE3", HEAD = "FFF1F5F9"

const day = 86400000
const startOfWeek = (d: Date) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7))   // Monday
  return x
}

async function exportGantt(ctx: ApiContext, params?: Record<string, string>) {
  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const [project, phases, tasks, milestones] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: { code: true, name: true, startDate: true, endDate: true, percentComplete: true },
    }),
    db.phase.findMany({ where: { projectId }, orderBy: { order: "asc" },
      select: { id: true, name: true, order: true } }),
    db.task.findMany({
      where: { projectId },
      orderBy: [{ phaseId: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true, code: true, title: true, status: true, percentComplete: true,
        startDate: true, dueDate: true, estimatedHours: true, phaseId: true, parentId: true,
        assignees: { select: { user: { select: { name: true } } } },
      },
    }),
    db.milestone.findMany({ where: { projectId }, orderBy: { dueDate: "asc" },
      select: { name: true, dueDate: true, status: true } }),
  ])
  if (!project) return notFound("Project")

  const dated = tasks.filter(t => t.startDate || t.dueDate)
  if (!dated.length) return err("This project has no dated tasks to chart yet", 400)

  // Timeline span: the work itself, padded a week each side so bars never touch
  // the edge of the grid.
  const stamps: number[] = []
  for (const t of dated) {
    if (t.startDate) stamps.push(new Date(t.startDate).getTime())
    if (t.dueDate)   stamps.push(new Date(t.dueDate).getTime())
  }
  for (const m of milestones) if (m.dueDate) stamps.push(new Date(m.dueDate).getTime())
  if (project.startDate) stamps.push(new Date(project.startDate).getTime())
  if (project.endDate)   stamps.push(new Date(project.endDate).getTime())

  const first = startOfWeek(new Date(Math.min(...stamps) - 7 * day))
  const last  = startOfWeek(new Date(Math.max(...stamps) + 7 * day))
  const weeks: Date[] = []
  for (let d = new Date(first); d <= last; d.setUTCDate(d.getUTCDate() + 7)) weeks.push(new Date(d))

  // A year of weekly columns is fine; five years is not. Fall back to months.
  const useMonths = weeks.length > 80
  const cols: { start: Date; end: Date; label: string; monthStart: boolean }[] = []
  if (useMonths) {
    const c = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1))
    const stop = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1))
    while (c <= stop) {
      const end = new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 0))
      cols.push({
        start: new Date(c), end,
        label: c.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
        monthStart: true,
      })
      c.setUTCMonth(c.getUTCMonth() + 1)
    }
  } else {
    for (const w of weeks) {
      const end = new Date(w); end.setUTCDate(end.getUTCDate() + 6)
      cols.push({
        start: w, end,
        label: w.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        monthStart: w.getUTCDate() <= 7,
      })
    }
  }

  const ExcelJS: any = await import("exceljs")
  const wb = new ExcelJS.Workbook()
  wb.creator = "FlowSync PM"
  wb.created = new Date()
  const ws = wb.addWorksheet("Gantt", {
    views: [{ state: "frozen", xSplit: 7, ySplit: 5 }],   // task list and header stay put
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  const FIXED = 7                       // columns before the timeline
  const TL = FIXED + 1                  // first timeline column

  // ── Title band ──
  ws.mergeCells(1, 1, 1, FIXED + Math.min(cols.length, 12))
  const title = ws.getCell(1, 1)
  title.value = `${project.code ? project.code + " — " : ""}${project.name} · Schedule`
  title.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } }
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }
  title.alignment = { vertical: "middle", indent: 1 }
  ws.getRow(1).height = 26

  ws.mergeCells(2, 1, 2, FIXED + Math.min(cols.length, 12))
  const sub = ws.getCell(2, 1)
  const span = `${first.toLocaleDateString("en-US", { timeZone: "UTC" })} – ${last.toLocaleDateString("en-US", { timeZone: "UTC" })}`
  sub.value = `${dated.length} dated tasks · ${milestones.length} milestones · ${project.percentComplete ?? 0}% complete · ${span} · exported ${new Date().toLocaleDateString("en-US")}`
  sub.font = { size: 9, color: { argb: "FF64748B" } }
  sub.alignment = { indent: 1 }

  // ── Legend ──
  const legend = [["Done", FILL.DONE], ["In progress", FILL.IN_PROGRESS], ["In review", FILL.IN_REVIEW],
                  ["Blocked", FILL.BLOCKED], ["To do", FILL.TODO], ["Milestone", AMBER]] as const
  legend.forEach(([label, argb], i) => {
    const c = ws.getCell(3, 1 + i * 2)
    c.value = label
    c.font = { size: 8.5, bold: true, color: { argb: "FFFFFFFF" } }
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb } }
    c.alignment = { horizontal: "center" }
  })
  ws.getRow(3).height = 15

  // ── Header rows ──
  const headers = ["Code", "Task", "Owner", "Start", "Finish", "Days", "%"]
  headers.forEach((h, i) => {
    const c = ws.getCell(5, i + 1)
    c.value = h
    c.font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" } }
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }
    c.alignment = { vertical: "middle", horizontal: i > 2 ? "center" : "left", indent: i > 2 ? 0 : 1 }
  })
  cols.forEach((col, i) => {
    const c = ws.getCell(5, TL + i)
    c.value = col.label
    c.font = { bold: true, size: 8, color: { argb: "FFFFFFFF" } }
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }
    c.alignment = { horizontal: "center", vertical: "middle", textRotation: useMonths ? 0 : 90 }
  })
  ws.getRow(5).height = useMonths ? 20 : 52

  ws.getColumn(1).width = 9
  ws.getColumn(2).width = 46
  ws.getColumn(3).width = 18
  ws.getColumn(4).width = 11
  ws.getColumn(5).width = 11
  ws.getColumn(6).width = 6.5
  ws.getColumn(7).width = 6.5
  for (let i = 0; i < cols.length; i++) ws.getColumn(TL + i).width = useMonths ? 5.5 : 3.2

  // ── Rows: phases as bands, then their tasks ──
  const byPhase = new Map<string, typeof tasks>()
  for (const t of tasks) {
    const k = t.phaseId || "__none"
    byPhase.set(k, [...(byPhase.get(k) || []), t] as any)
  }
  const order = [...phases.map(p => ({ id: p.id, name: p.name })),
                 ...(byPhase.has("__none") ? [{ id: "__none", name: "Unassigned" }] : [])]

  const fmt = (d: any) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" }) : ""

  let r = 6
  for (const ph of order) {
    const list = byPhase.get(ph.id) || []
    if (!list.length) continue

    // Phase band spanning the whole sheet — the visual anchor when scrolling.
    ws.mergeCells(r, 1, r, FIXED)
    const band = ws.getCell(r, 1)
    band.value = ph.name
    band.font = { bold: true, size: 10, color: { argb: NAVY } }
    band.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } }
    band.alignment = { vertical: "middle", indent: 1 }
    for (let i = 0; i < cols.length; i++) {
      ws.getCell(r, TL + i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } }
    }
    ws.getRow(r).height = 17
    r++

    for (const t of list) {
      const s = t.startDate ? new Date(t.startDate).getTime() : null
      const e = t.dueDate   ? new Date(t.dueDate).getTime()   : s
      const owner = t.assignees?.[0]?.user?.name || ""
      const days = s && e ? Math.max(1, Math.round((e - s) / day) + 1) : ""

      const cells: any[] = [
        t.code,
        (t.parentId ? "    " : "") + t.title,
        owner,
        fmt(t.startDate),
        fmt(t.dueDate),
        days,
        `${t.percentComplete ?? 0}%`,
      ]
      cells.forEach((v, i) => {
        const c = ws.getCell(r, i + 1)
        c.value = v as any
        c.font = { size: 9.5, color: { argb: "FF1F2937" }, bold: !t.parentId && !!t.parentId }
        c.alignment = { vertical: "middle", horizontal: i > 2 ? "center" : "left", indent: i > 2 ? 0 : 1 }
        c.border = { bottom: { style: "hair", color: { argb: LINE } } }
      })

      // The bar: every period the task overlaps gets filled.
      const argb = (FILL as any)[t.status] || FILL.TODO
      for (let i = 0; i < cols.length; i++) {
        const cell = ws.getCell(r, TL + i)
        cell.border = {
          bottom: { style: "hair", color: { argb: LINE } },
          left: cols[i].monthStart ? { style: "hair", color: { argb: LINE } } : undefined,
        } as any
        if (s == null || e == null) continue
        const cs = cols[i].start.getTime(), ce = cols[i].end.getTime()
        if (e >= cs && s <= ce) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } }
        }
      }
      ws.getRow(r).height = 15
      r++
    }
  }

  // ── Milestones, at the foot, with their own marked row ──
  if (milestones.length) {
    r++
    ws.mergeCells(r, 1, r, FIXED)
    const h = ws.getCell(r, 1)
    h.value = "Milestones"
    h.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } }
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }
    h.alignment = { indent: 1, vertical: "middle" }
    r++

    for (const m of milestones) {
      if (!m.dueDate) continue
      const md = new Date(m.dueDate).getTime()
      ws.mergeCells(r, 1, r, 3)
      const nameCell = ws.getCell(r, 1)
      nameCell.value = `◆ ${m.name}`
      nameCell.font = { size: 9.5, bold: true, color: { argb: "FF1F2937" } }
      nameCell.alignment = { indent: 1, vertical: "middle" }
      ws.getCell(r, 4).value = fmt(m.dueDate)
      ws.getCell(r, 4).font = { size: 9.5 }
      ws.getCell(r, 4).alignment = { horizontal: "center" }
      ws.getCell(r, 7).value = m.status === "ACHIEVED" ? "✓" : ""
      ws.getCell(r, 7).alignment = { horizontal: "center" }

      for (let i = 0; i < cols.length; i++) {
        const cell = ws.getCell(r, TL + i)
        cell.border = { bottom: { style: "hair", color: { argb: LINE } } }
        if (md >= cols[i].start.getTime() && md <= cols[i].end.getTime()) {
          cell.fill = { type: "pattern", pattern: "solid",
            fgColor: { argb: m.status === "ACHIEVED" ? FILL.DONE : AMBER } }
          cell.value = "◆"
          cell.font = { size: 9, bold: true, color: { argb: "FFFFFFFF" } }
          cell.alignment = { horizontal: "center" }
        }
      }
      ws.getRow(r).height = 15
      r++
    }
  }

  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: FIXED } }

  const buf = await wb.xlsx.writeBuffer()
  const name = `${project.code || "project"}_gantt_${new Date().toISOString().slice(0, 10)}.xlsx`
  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  })
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, exportGantt, params)
}
