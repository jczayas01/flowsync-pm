// src/lib/report-chart-data.ts
// Server-side: gathers the numbers behind the report charts (PDF export +
// emailed reports). Kept separate from pdf-report.ts so the PDF module stays
// pure-drawing and browser-safe.

import { db } from "@/lib/db"
import { buildSCurveSeries, type SCurvePoint } from "@/lib/evm-series"

export interface ReportChartData {
  scurve?: SCurvePoint[]
  statusCounts?: { label: string; count: number; hex: string }[]
  budget?: { bac: number; ac: number; eac: number }
}

const STATUS_META: [string, string, string][] = [
  ["DONE",        "Done",        "#059669"],
  ["IN_PROGRESS", "In progress", "#1B6CA8"],
  ["IN_REVIEW",   "In review",   "#7C3AED"],
  ["BLOCKED",     "Blocked",     "#DC2626"],
  ["TODO",        "To do",       "#94A3B8"],
]

export async function getReportChartData(projectId: string): Promise<ReportChartData> {
  const [project, tasks, budgetItems] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: { startDate: true, endDate: true, budgetTotal: true },
    }),
    db.task.findMany({
      where: { projectId },
      select: {
        status: true, startDate: true, dueDate: true,
        completedAt: true, updatedAt: true, estimatedHours: true,
      },
    }),
    db.budgetItem.findMany({
      where: { projectId },
      select: {
        plannedCost: true, actualCost: true, earnedValue: true,
        periodStart: true, periodEnd: true, createdAt: true,
      },
    }),
  ]).catch(() => [null, [], []] as const)

  const out: ReportChartData = {}
  const items = (budgetItems || []).map(b => ({
    ...b,
    plannedCost: Number(b.plannedCost || 0),
    actualCost:  Number(b.actualCost || 0),
    earnedValue: Number(b.earnedValue || 0),
  }))

  // Status distribution
  if (tasks?.length) {
    const counts = STATUS_META
      .map(([key, label, hex]) => ({ label, hex, count: tasks.filter(t => t.status === key).length }))
      .filter(s => s.count > 0)
    if (counts.length) out.statusCounts = counts
  }

  // Budget bullet
  const bac = Number(project?.budgetTotal ?? 0) || items.reduce((s, b) => s + b.plannedCost, 0)
  if (bac > 0) {
    const ac = items.reduce((s, b) => s + b.actualCost, 0)
    const ev = items.reduce((s, b) => s + b.earnedValue, 0)
    const cpi = ac > 0 && ev > 0 ? ev / ac : 1
    out.budget = { bac, ac, eac: cpi > 0 ? bac / cpi : bac }
  }

  // S-curve
  if (tasks?.length) {
    const series = buildSCurveSeries({
      tasks: tasks.map(t => ({ ...t, estimatedHours: Number(t.estimatedHours || 0) })),
      budgetItems: items,
      budgetTotal: bac,
      projectStart: project?.startDate,
      projectEnd:   project?.endDate,
    })
    if (series.length >= 2) out.scurve = series
  }

  return out
}
