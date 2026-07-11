// src/app/api/projects/[projectId]/export-docx/route.ts
// POST — generate a Word document (Project Brief or Status Report) in-process
// using the docx package. No temp files, no child processes.

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, Header, Footer, PageNumber,
} from "docx"

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId
  if (workspaceId) {
    const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
    if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }) }
  const { docType = "PROJECT_BRIEF", reportData } = body

  const project = await db.project.findUnique({
    where: { id: params.projectId },
    select: {
      id: true, code: true, name: true, methodology: true, status: true, health: true,
      percentComplete: true, startDate: true, endDate: true,
      budgetTotal: true, budgetSpent: true, currency: true,
      objective: true, scope: true, outOfScope: true, background: true,
      assumptions: true, constraints: true, economicImpact: true, priority: true,
      workspace: { select: { name: true, logoUrl: true, primaryColor: true } },
    },
  })
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const members = await db.projectMember.findMany({
    where: { projectId: params.projectId },
    include: { user: { select: { name: true } } },
  })

  const pm      = members.find(m => m.projectRole === "PM")?.user?.name || "Unassigned"
  const sponsor = members.find(m => ["SPONSOR", "EXECUTIVE_SPONSOR"].includes(m.projectRole || ""))?.user?.name || "Unassigned"
  const budgetTotal = Number(project.budgetTotal || 0)
  const currency = project.currency || "USD"
  const primaryColor = (project.workspace?.primaryColor || "#1B6CA8").replace("#", "")
  const wsName = project.workspace?.name || "FlowSync PM"
  const todayLong = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

  const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBD"
  const fmtCurrency = (n: number) => `${currency} ${n.toLocaleString()}`

  // ── shared building blocks ──
  const H = (text: string, level: any) =>
    new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } })
  const P = (text?: string | null) =>
    new Paragraph({ children: [new TextRun({ text: text || "—", size: 22 })], spacing: { before: 80, after: 80 } })
  const Label = (label: string, value?: string | null) =>
    new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [
        new TextRun({ text: label + ": ", bold: true, size: 22 }),
        new TextRun({ text: value || "—", size: 22 }),
      ],
    })
  const HR = () =>
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: primaryColor } },
      spacing: { before: 80, after: 160 },
      children: [],
    })
  const noBorders = {
    top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
  } as any
  const InfoRow = (l1: string, v1?: string | null, l2?: string, v2?: string | null) =>
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [4680, 4680],
      rows: [new TableRow({
        children: [
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders: noBorders, children: [Label(l1, v1)] }),
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders: noBorders, children: [Label(l2 || "", v2)] }),
        ],
      })],
    })
  const pageHeader = (docLabel: string) =>
    new Header({ children: [
      new Paragraph({
        spacing: { after: 80 },
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: wsName, bold: true, color: primaryColor, size: 20 }),
          new TextRun({ text: `  |  ${docLabel}  |  Confidential`, size: 18, color: "999999" }),
        ],
      }),
    ]})

  let doc: Document

  if (docType === "PROJECT_BRIEF") {
    doc = new Document({
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 } } },
        headers: { default: pageHeader("Project Brief") },
        footers: { default: new Footer({ children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `${project.name} — Project Brief  |  `, size: 16, color: "999999" }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" }),
              new TextRun({ text: " of ", size: 16, color: "999999" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "999999" }),
            ],
          }),
        ]}) },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { before: 240, after: 80 },
            children: [new TextRun({ text: "PROJECT BRIEF", bold: true, size: 36, color: primaryColor })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { after: 60 },
            children: [new TextRun({ text: project.name, bold: true, size: 28 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { after: 240 },
            children: [new TextRun({ text: `${project.code}  |  As of ${todayLong}`, size: 20, color: "666666" })],
          }),
          HR(),
          H("1. Project Identification", HeadingLevel.HEADING_1),
          InfoRow("Project Name", project.name, "Project Code", project.code),
          InfoRow("Methodology", project.methodology, "Priority", project.priority || "MEDIUM"),
          InfoRow("Status", project.status, "Health", project.health),
          InfoRow("Project Manager", pm, "Executive Sponsor", sponsor),
          InfoRow("Start Date", fmtDate(project.startDate), "End Date", fmtDate(project.endDate)),
          InfoRow("Budget", fmtCurrency(budgetTotal), "% Complete", `${project.percentComplete || 0}%`),
          new Paragraph({ spacing: { after: 120 }, children: [] }),
          H("2. Project Objective", HeadingLevel.HEADING_1),
          P(project.objective || "Not specified"),
          H("3. Scope", HeadingLevel.HEADING_1),
          H("3.1 In Scope", HeadingLevel.HEADING_2),
          P(project.scope || "Not specified"),
          H("3.2 Out of Scope", HeadingLevel.HEADING_2),
          P(project.outOfScope || "Not specified"),
          H("4. Background & Business Context", HeadingLevel.HEADING_1),
          P(project.background || "Not specified"),
          H("5. Assumptions", HeadingLevel.HEADING_1),
          P(project.assumptions || "Not specified"),
          H("6. Constraints", HeadingLevel.HEADING_1),
          P(project.constraints || "Not specified"),
          H("7. Economic Impact & Benefits", HeadingLevel.HEADING_1),
          P(project.economicImpact || "Not specified"),
          H("8. Project Team", HeadingLevel.HEADING_1),
          Label("Project Manager", pm),
          Label("Executive Sponsor", sponsor),
          new Paragraph({ children: [new TextRun({ break: 1 })] }),
          HR(),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
              text: `This document was generated by FlowSync PM on ${new Date().toLocaleDateString()}. It is confidential.`,
              size: 16, color: "999999",
            })],
          }),
        ],
      }],
    })
  } else {
    const reportTitle: string      = reportData?.reportTitle || "Status Report"
    const summary: string          = reportData?.executiveSummary || ""
    const accomplishments: string[] = reportData?.accomplishmentsThisWeek || []
    const nextWeek: string[]        = reportData?.plannedNextWeek || []
    const risks: string            = reportData?.risksAndIssues || ""
    const budget: string           = reportData?.budgetStatus || ""
    const schedule: string         = reportData?.scheduleStatus || ""
    const decisions: string[]      = reportData?.decisionsNeeded || []

    const bullet = (text: string, color?: string) =>
      new Paragraph({
        children: [new TextRun({ text: "• " + text, size: 22, ...(color ? { color } : {}) })],
        spacing: { before: 60, after: 60 },
      })

    doc = new Document({
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 } } },
        headers: { default: pageHeader("Status Report") },
        footers: { default: new Footer({ children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `${reportTitle}  |  Page `, size: 16, color: "999999" }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" }),
            ],
          }),
        ]}) },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { before: 240, after: 80 },
            children: [new TextRun({ text: reportTitle, bold: true, size: 28, color: primaryColor })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { after: 200 },
            children: [new TextRun({
              text: `${project.name} (${project.code})  |  Generated: ${new Date().toLocaleDateString()}`,
              size: 20, color: "666666",
            })],
          }),
          HR(),
          H("Executive Summary", HeadingLevel.HEADING_1),
          P(summary),
          H("Accomplishments This Period", HeadingLevel.HEADING_1),
          ...accomplishments.map(a => bullet(a)),
          H("Planned Next Period", HeadingLevel.HEADING_1),
          ...nextWeek.map(a => bullet(a)),
          H("Budget & Cost Status", HeadingLevel.HEADING_1),
          P(budget),
          H("Schedule Status", HeadingLevel.HEADING_1),
          P(schedule),
          H("Risks & Issues", HeadingLevel.HEADING_1),
          P(risks),
          ...(decisions.length > 0 ? [
            H("Decisions Required", HeadingLevel.HEADING_1),
            ...decisions.map(d => bullet(d, "DC2626")),
          ] : []),
          HR(),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
              text: "Generated by FlowSync PM — Industry-Standard PM Practices PMO Platform",
              size: 16, color: "999999",
            })],
          }),
        ],
      }],
    })
  }

  try {
    const buf = await Packer.toBuffer(doc)
    const filename = docType === "PROJECT_BRIEF"
      ? `${project.code}_Project_Brief_${new Date().toISOString().split("T")[0]}.docx`
      : `${project.code}_Status_Report_${new Date().toISOString().split("T")[0]}.docx`

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: "Document generation failed", details: e?.message }, { status: 500 })
  }
}
