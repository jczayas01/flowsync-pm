// src/app/api/projects/[projectId]/import/template/route.ts
// GET /api/projects/:projectId/import/template — download a blank starter template
// Free, no existing tasks required. Includes the project's real phase names
// and the same column layout/validation as a real export, so users can see
// the format before they have any tasks to export.

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"

const STATUS_OPTS   = ["BACKLOG","TODO","IN_PROGRESS","IN_REVIEW","DONE","CANCELLED"]
const PRIORITY_OPTS = ["CRITICAL","HIGH","MEDIUM","LOW"]

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId

  if (!workspaceId) return new NextResponse("No workspace specified", { status: 400 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return new NextResponse("Forbidden", { status: 403 })

  const [project, phases] = await Promise.all([
    db.project.findUnique({ where: { id: params.projectId }, select: { name:true, code:true } }),
    db.phase.findMany({ where: { projectId: params.projectId }, orderBy: { order:"asc" }, select: { name:true } }),
  ])

  if (!project) return new NextResponse("Project not found", { status: 404 })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "FlowSync PM"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Tasks", { views: [{ state:"frozen", ySplit:1 }] })

  sheet.columns = [
    { header: "Task ID (do not edit)", key: "id",         width: 28 },
    { header: "Code",                  key: "code",        width: 10 },
    { header: "Title",                 key: "title",       width: 40 },
    { header: "Phase",                 key: "phase",       width: 22 },
    { header: "Status",                key: "status",      width: 14 },
    { header: "Priority",              key: "priority",    width: 12 },
    { header: "Start Date",            key: "start",       width: 14 },
    { header: "Due Date",              key: "due",         width: 14 },
    { header: "Actual End Date",       key: "actual",      width: 16 },
    { header: "% Complete",            key: "pct",         width: 12 },
    { header: "Est. Hours",            key: "est",         width: 12 },
    { header: "Assignee",              key: "assignee",    width: 22 },
    { header: "Parent Task Code",      key: "parent",      width: 18 },
    { header: "Depends On (Code)",     key: "dependsOn",   width: 20 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B6CA8" } }
  headerRow.height = 22
  headerRow.alignment = { vertical: "middle" }

  // Add a few blank example rows so the layout is obvious — clearly marked
  const exampleCount = 5
  for (let i = 0; i < exampleCount; i++) {
    sheet.addRow({
      id: "", code: "", title: "", phase: phases[i]?.name || "",
      status: "TODO", priority: "MEDIUM", start: "", due: "", actual: "",
      pct: 0, est: "", assignee: "",
    })
  }

  // Dropdown validation for Phase, Status, Priority — rows 2-1000
  const phaseNames = phases.map(p => p.name)

  // Phase dropdown — uses a hidden sheet for longer lists (Excel limit ~255 chars for inline)
  if (phaseNames.length > 0) {
    // Create a hidden reference sheet for phase names
    const phaseSheet = workbook.addWorksheet("_phases", { state:"veryHidden" })
    phaseNames.forEach((name, i) => { phaseSheet.getCell(`A${i+1}`).value = name })

    for (let row = 2; row <= 1000; row++) {
      sheet.getCell(`D${row}`).dataValidation = {
        type: "list", allowBlank: true,
        formulae: phaseNames.length <= 10
          ? [`"${phaseNames.join(",")}"`]
          : [`_phases!$A$1:$A$${phaseNames.length}`],
        showErrorMessage: true,
        errorTitle: "Invalid phase",
        error: `Select one of: ${phaseNames.join(", ")}`,
      }
    }
  }

  for (let row = 2; row <= 1000; row++) {
    sheet.getCell(`E${row}`).dataValidation = {
      type: "list", allowBlank: true, formulae: [`"${STATUS_OPTS.join(",")}"`],
    }
    sheet.getCell(`F${row}`).dataValidation = {
      type: "list", allowBlank: true, formulae: [`"${PRIORITY_OPTS.join(",")}"`],
    }
  }

  sheet.eachRow(row => {
    row.eachCell(cell => {
      cell.border = {
        top: { style:"thin", color:{ argb:"FFE2E8F0" } },
        bottom: { style:"thin", color:{ argb:"FFE2E8F0" } },
      }
    })
  })

  // Instructions sheet
  const info = workbook.addWorksheet("Instructions")
  info.columns = [{ width: 95 }]
  info.addRow(["FlowSync PM — Bulk Task Import Template"]).font = { bold: true, size: 14 }
  info.addRow([`Project: ${project.name} (${project.code})`])
  info.addRow([`Generated: ${new Date().toLocaleString("en-US")}`])
  info.addRow([])
  info.addRow(["Use this file to bring in tasks from Microsoft Project, Planner, or any spreadsheet"])
  info.addRow(["of your existing plan — fill in the rows below, then upload it on the Tasks tab."])
  info.addRow([])
  info.addRow(["How to create new tasks from this file:"]).font = { bold: true }
  info.addRow(["1. Leave the 'Task ID' column (column A) BLANK for every row — that's how the"])
  info.addRow(["   system knows to create a new task instead of updating one."])
  info.addRow(["2. Fill in a Title for each row — this is the only required field."])
  info.addRow(["3. Phase: type any name. If it doesn't exist yet, a new phase is created"])
  info.addRow(["   automatically and tasks are grouped under it."])
  info.addRow(["4. Status defaults to TODO and Priority to MEDIUM if left blank."])
  info.addRow(["5. Assignee: type a team member's name exactly as it appears in this project's"])
  info.addRow(["   Team tab to auto-assign them. Leave blank to assign later."])
  info.addRow(["6. Save the file, go to the Tasks tab, click '📊 Excel' → 'Import from Excel'."])
  info.addRow([])
  info.addRow(["To bulk-EDIT tasks that already exist instead:"]).font = { bold: true }
  info.addRow(["Use '📤 Export to Excel' instead of this template — it includes the real Task IDs"])
  info.addRow(["needed to update existing tasks rather than create duplicates."])
  info.addRow([])
  info.addRow(["Column reference:"]).font = { bold: true }
  info.addRow(["Status must be one of: " + STATUS_OPTS.join(", ")])
  info.addRow(["Priority must be one of: " + PRIORITY_OPTS.join(", ")])
  info.addRow(["Dates must be in YYYY-MM-DD format (e.g. 2026-08-15)."])
  info.addRow(["% Complete is a number from 0 to 100."])

  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="FlowSync-PM-Task-Template-${project.code}.xlsx"`,
    },
  })
}
