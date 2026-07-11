// src/app/api/projects/[projectId]/import/route.ts
// POST /api/projects/:projectId/import — upload an Excel file
//   Rows WITH a Task ID  -> update that existing task
//   Rows WITHOUT a Task ID (blank, but have a Title) -> create a new task

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess, audit } from "@/lib/api"

const VALID_STATUS   = new Set(["BACKLOG","TODO","IN_PROGRESS","IN_REVIEW","DONE","CANCELLED"])
const VALID_PRIORITY = new Set(["CRITICAL","HIGH","MEDIUM","LOW"])

interface RowResult {
  row: number
  code: string
  status: "updated" | "created" | "skipped" | "error"
  message?: string
}

function parseDateCell(cell: any): Date | null | undefined {
  // undefined = column was blank in the sheet, don't touch the field
  // null = explicitly cleared
  if (cell === null || cell === undefined || cell === "") return undefined
  if (cell instanceof Date) return cell
  if (typeof cell === "string") {
    const parsed = new Date(cell + "T00:00:00.000Z")
    if (isNaN(parsed.getTime())) return undefined
    return parsed
  }
  return undefined
}

function cellText(cell: any): string {
  if (cell === null || cell === undefined) return ""
  if (typeof cell === "object" && "text" in cell) return String(cell.text || "").trim()
  return String(cell).trim()
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId

  if (!workspaceId) return NextResponse.json({ error: "No workspace specified" }, { status: 400 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(arrayBuffer as any)
  } catch {
    return NextResponse.json({ error: "Could not read file — make sure it's a valid .xlsx" }, { status: 400 })
  }

  const sheet = workbook.getWorksheet("Tasks")
  if (!sheet) {
    return NextResponse.json({ error: "No 'Tasks' sheet found in this file" }, { status: 400 })
  }

  // Existing context needed for matching: tasks, phases, project members
  const [existingTasks, phases, projectMembers, lastTask] = await Promise.all([
    db.task.findMany({ where: { projectId: params.projectId }, select: { id:true, code:true } }),
    db.phase.findMany({ where: { projectId: params.projectId }, select: { id:true, name:true } }),
    db.projectMember.findMany({
      where:   { projectId: params.projectId },
      include: { user: { select:{ id:true, name:true } } },
    }),
    db.task.findFirst({
      where:   { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
      select:  { code: true },
    }),
  ])

  const validIds  = new Map(existingTasks.map(t => [t.id, t.code]))
  const phaseByName = new Map(phases.map(p => [p.name.trim().toLowerCase(), p.id]))
  const memberByName = new Map(
    projectMembers.map(m => [m.user.name.trim().toLowerCase(), m])
  )

  // Running counter for new task codes (T-001, T-002, ...)
  let nextCodeNum = 1
  if (lastTask?.code) {
    const n = parseInt(lastTask.code.replace("T-", ""), 10)
    if (!isNaN(n)) nextCodeNum = n + 1
  }

  const results: RowResult[] = []
  let updatedCount = 0
  let createdCount = 0

  const rows: any[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // header
    rows.push({ row, rowNumber })
  })

  for (const { row, rowNumber } of rows) {
    const id        = cellText(row.getCell(1).value)
    const code      = cellText(row.getCell(2).value)
    const title     = cellText(row.getCell(3).value)
    const phaseName = cellText(row.getCell(4).value)
    const status    = cellText(row.getCell(5).value).toUpperCase()
    const priority  = cellText(row.getCell(6).value).toUpperCase()
    const startVal  = row.getCell(7).value
    const dueVal    = row.getCell(8).value
    const actualVal = row.getCell(9).value
    const pctVal    = row.getCell(10).value
    const estVal    = row.getCell(11).value
    const assignee  = cellText(row.getCell(12).value)

    // Completely blank row — skip silently
    if (!id && !title) continue

    // ════════════════════════════════════════════
    // CASE 1: Has a Task ID → UPDATE existing task
    // ════════════════════════════════════════════
    if (id) {
      if (!validIds.has(id)) {
        results.push({ row: rowNumber, code: code || "?", status:"error",
          message: "Task ID not found in this project — row skipped" })
        continue
      }

      const data: any = {}
      if (status) {
        if (!VALID_STATUS.has(status)) {
          results.push({ row: rowNumber, code, status:"error", message: `Invalid status "${status}"` })
          continue
        }
        data.status = status
        if (status === "DONE") data.percentComplete = 100
      }
      if (priority) {
        if (!VALID_PRIORITY.has(priority)) {
          results.push({ row: rowNumber, code, status:"error", message: `Invalid priority "${priority}"` })
          continue
        }
        data.priority = priority
      }

      const start  = parseDateCell(startVal)
      const due    = parseDateCell(dueVal)
      const actual = parseDateCell(actualVal)
      if (start  !== undefined) data.startDate   = start
      if (due    !== undefined) data.dueDate     = due
      if (actual !== undefined) data.completedAt = actual

      if (pctVal !== null && pctVal !== undefined && pctVal !== "") {
        const pct = Number(pctVal)
        if (!isNaN(pct) && pct >= 0 && pct <= 100) data.percentComplete = Math.round(pct)
      }
      if (estVal !== null && estVal !== undefined && estVal !== "") {
        const est = Number(estVal)
        if (!isNaN(est) && est >= 0) data.estimatedHours = est
      }
      if (title) data.title = title

      if (Object.keys(data).length === 0) {
        results.push({ row: rowNumber, code, status:"skipped", message: "No changes detected" })
        continue
      }

      try {
        await db.task.update({ where: { id }, data })
        results.push({ row: rowNumber, code, status:"updated" })
        updatedCount++
      } catch (e: any) {
        results.push({ row: rowNumber, code, status:"error", message: e?.message || "Update failed" })
      }
      continue
    }

    // ════════════════════════════════════════════
    // CASE 2: No Task ID, but has a Title → CREATE new task
    // ════════════════════════════════════════════
    if (!title) {
      results.push({ row: rowNumber, code: "—", status:"skipped", message: "No title — row skipped" })
      continue
    }

    if (status && !VALID_STATUS.has(status)) {
      results.push({ row: rowNumber, code: "—", status:"error", message: `Invalid status "${status}"` })
      continue
    }
    if (priority && !VALID_PRIORITY.has(priority)) {
      results.push({ row: rowNumber, code: "—", status:"error", message: `Invalid priority "${priority}"` })
      continue
    }

    // Resolve phase by name — create it if it doesn't exist yet
    let phaseId: string | null = null
    if (phaseName) {
      const key = phaseName.toLowerCase()
      if (phaseByName.has(key)) {
        phaseId = phaseByName.get(key) as string
      } else {
        const newPhase = await db.phase.create({
          data: { projectId: params.projectId, name: phaseName, order: phaseByName.size },
        })
        phaseByName.set(key, newPhase.id)
        phaseId = newPhase.id
      }
    }

    const start  = parseDateCell(startVal)
    const due    = parseDateCell(dueVal)
    const actual = parseDateCell(actualVal)
    const pct = (pctVal !== null && pctVal !== undefined && pctVal !== "")
      ? Math.max(0, Math.min(100, Math.round(Number(pctVal) || 0))) : 0
    const est = (estVal !== null && estVal !== undefined && estVal !== "")
      ? Number(estVal) : null

    const newCode = `T-${String(nextCodeNum).padStart(3, "0")}`
    nextCodeNum++

    try {
      const created = await db.task.create({
        data: {
          projectId:      params.projectId,
          phaseId,
          code:           newCode,
          title,
          status:         (status || "TODO") as any,
          priority:       (priority || "MEDIUM") as any,
          startDate:      start  || null,
          dueDate:        due    || null,
          completedAt:    actual || null,
          percentComplete: pct,
          estimatedHours: est,
          ownerId:        session.user.id,
        },
      })

      // Try to assign by matching the Assignee name to a project member
      if (assignee) {
        const member = memberByName.get(assignee.toLowerCase()) as any
        if (member) {
          await db.taskAssignee.create({
            data: { taskId: created.id, projectMemberId: member.id, userId: member.userId },
          }).catch(() => {})
        }
      }

      results.push({ row: rowNumber, code: newCode, status:"created" })
      createdCount++
    } catch (e: any) {
      results.push({ row: rowNumber, code: newCode, status:"error", message: e?.message || "Create failed" })
    }
  }

  if (updatedCount > 0 || createdCount > 0) {
    await audit(workspaceId, session.user.id, "project.bulk_import", "project", params.projectId,
      undefined, { fileName: file.name, updatedCount, createdCount, totalRows: rows.length })
  }

  return NextResponse.json({
    success: true,
    summary: {
      totalRows: rows.length,
      created:   createdCount,
      updated:   updatedCount,
      errors:    results.filter(r => r.status === "error").length,
      skipped:   results.filter(r => r.status === "skipped").length,
    },
    results,
  })
}
