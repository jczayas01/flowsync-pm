// src/app/api/projects/[projectId]/export/route.ts
// GET /api/projects/:projectId/export — download all tasks as an Excel file
// Columns are designed to round-trip: edit dates/status in Excel, re-import via /import

import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"

const STATUS_OPTS   = ["BACKLOG","TODO","IN_PROGRESS","IN_REVIEW","DONE","CANCELLED"]
const PRIORITY_OPTS = ["CRITICAL","HIGH","MEDIUM","LOW"]

function fmtDate(d: Date | null): string {
  if (!d) return ""
  return d.toISOString().split("T")[0]
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId

  if (!workspaceId) return new NextResponse("No workspace specified", { status: 400 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return new NextResponse("Forbidden", { status: 403 })

  const [project, tasks, phases, members] = await Promise.all([
    db.project.findUnique({
      where:  { id: params.projectId },
      select: { name:true, code:true },
    }),
    db.task.findMany({
      where:   { projectId: params.projectId },
      orderBy: [{ phaseId:"asc" }, { startDate:"asc" }],
      include: {
        phase:     { select:{ id:true, name:true } },
        assignees: { include: { projectMember: { include: { user: { select:{ name:true } } } } } },
      },
    }),
    db.phase.findMany({
      where:   { projectId: params.projectId },
      orderBy: { order:"asc" },
    }),
    db.projectMember.findMany({
      where:   { projectId: params.projectId },
      include: { user: { select:{ name:true } } },
    }),
  ])

  if (!project) return new NextResponse("Project not found", { status: 404 })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "FlowSync PM"
  workbook.created = new Date()

  // ── Tasks sheet ──────────────────────────────────────
  const sheet = workbook.addWorksheet("Tasks", {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  sheet.columns = [
    { header: "Task ID (do not edit)", key: "id",      width: 28, },
    { header: "Code",                  key: "code",     width: 10 },
    { header: "Title",                 key: "title",    width: 40 },
    { header: "Phase",                 key: "phase",    width: 20 },
    { header: "Status",                key: "status",   width: 14 },
    { header: "Priority",              key: "priority", width: 12 },
    { header: "Start Date",            key: "start",    width: 14 },
    { header: "Due Date",              key: "due",      width: 14 },
    { header: "Actual End Date",       key: "actual",   width: 16 },
    { header: "% Complete",            key: "pct",      width: 12 },
    { header: "Est. Hours",            key: "est",      width: 12 },
    { header: "Assignee",              key: "assignee", width: 22 },
  ]

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B6CA8" } }
  headerRow.height = 22
  headerRow.alignment = { vertical: "middle" }

  for (const t of tasks) {
    const assigneeNames = (t.assignees || [])
      .map((a: any) => a.projectMember?.user?.name)
      .filter(Boolean)
      .join(", ")

    sheet.addRow({
      id:       t.id,
      code:     t.code,
      title:    t.title,
      phase:    t.phase?.name || "",
      status:   t.status,
      priority: t.priority,
      start:    fmtDate(t.startDate),
      due:      fmtDate(t.dueDate),
      actual:   fmtDate(t.completedAt),
      pct:      t.percentComplete,
      est:      t.estimatedHours ? Number(t.estimatedHours) : "",
      assignee: assigneeNames,
    })
  }

  // Data validation dropdowns for Status and Priority columns (rows 2-1000)
  for (let row = 2; row <= 1000; row++) {
    sheet.getCell(`E${row}`).dataValidation = {
      type: "list", allowBlank: true,
      formulae: [`"${STATUS_OPTS.join(",")}"`],
    }
    sheet.getCell(`F${row}`).dataValidation = {
      type: "list", allowBlank: true,
      formulae: [`"${PRIORITY_OPTS.join(",")}"`],
    }
  }

  // Light borders on all data cells
  sheet.eachRow((row, rowNum) => {
    row.eachCell(cell => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      }
    })
  })

  // ── Instructions sheet ──────────────────────────────
  const infoSheet = workbook.addWorksheet("Instructions")
  infoSheet.columns = [{ width: 90 }]
  infoSheet.addRow(["FlowSync PM — Task Export"]).font = { bold: true, size: 14 }
  infoSheet.addRow([`Project: ${project.name} (${project.code})`])
  infoSheet.addRow([`Exported: ${new Date().toLocaleString("en-US")}`])
  infoSheet.addRow([])
  infoSheet.addRow(["To bulk-EDIT existing tasks:"]).font = { bold: true }
  infoSheet.addRow(["1. Edit dates, status, priority, or % complete directly in the Tasks sheet."])
  infoSheet.addRow(["2. Do NOT edit or delete the 'Task ID' column on those rows — it's how the import"])
  infoSheet.addRow(["   matches each row back to the correct task."])
  infoSheet.addRow([])
  infoSheet.addRow(["To bulk-CREATE new tasks:"]).font = { bold: true }
  infoSheet.addRow(["1. Add a new row at the bottom of the sheet."])
  infoSheet.addRow(["2. Leave the 'Task ID' column blank for that row."])
  infoSheet.addRow(["3. Fill in at least a Title. Phase, Status, Priority, dates, % complete, hours,"])
  infoSheet.addRow(["   and Assignee are all optional — defaults are TODO / MEDIUM / 0%."])
  infoSheet.addRow(["4. If the Phase name doesn't exist yet, a new phase will be created automatically."])
  infoSheet.addRow(["5. Assignee must match an existing team member's name exactly to be assigned."])
  infoSheet.addRow([])
  infoSheet.addRow(["General rules:"]).font = { bold: true }
  infoSheet.addRow(["• Dates must be in YYYY-MM-DD format (e.g. 2026-08-15)."])
  infoSheet.addRow(["• Status and Priority have dropdown validation — use the provided values only."])
  infoSheet.addRow(["• Save this file, then go to the project's Tasks tab and click '📊 Excel → Import from Excel'."])

  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${project.code}-tasks-${fmtDate(new Date())}.xlsx"`,
    },
  })
}
