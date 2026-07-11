// src/app/api/projects/[projectId]/export-docx/route.ts
// POST — generate Word document for Project Brief or Status Report
// Uses docx npm package per SKILL.md

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error:"Unauthorized" }, { status:401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error:"Invalid body" }, { status:400 }) }

  const { docType = "PROJECT_BRIEF", reportData } = body

  const project = await db.project.findUnique({
    where:  { id:params.projectId },
    select: {
      id:true, code:true, name:true, methodology:true, status:true, health:true,
      percentComplete:true, startDate:true, endDate:true,
      budgetTotal:true, budgetSpent:true, currency:true,
      objective:true, scope:true, outOfScope:true, background:true,
      assumptions:true, constraints:true, economicImpact:true, priority:true,
      workspace: { select:{ name:true, logoUrl:true, primaryColor:true } },
    },
  })
  if (!project) return NextResponse.json({ error:"Project not found" }, { status:404 })

  const members = await db.projectMember.findMany({
    where:   { projectId:params.projectId },
    include: { user:{ select:{ name:true } } },
  })

  const pm       = members.find(m => m.projectRole==="PM")?.user?.name || "Unassigned"
  const sponsor  = members.find(m => ["SPONSOR","EXECUTIVE_SPONSOR"].includes(m.projectRole||""))?.user?.name || "Unassigned"
  const budgetTotal = Number(project.budgetTotal||0)
  const budgetSpent = Number(project.budgetSpent||0)
  const currency = project.currency || "USD"

  function fmtDate(d: any) {
    if (!d) return "TBD"
    return new Date(d).toLocaleDateString("en-US",{ month:"long", day:"numeric", year:"numeric" })
  }
  function fmtCurrency(n: number) {
    return `${currency} ${n.toLocaleString()}`
  }

  // Build document using docx npm package
  // We generate the JS and run it server-side
  const docxScript = `
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
        WidthType, AlignmentType, ShadingType, BorderStyle, PageOrientation, Header,
        Footer, PageNumber, NumberFormat } = require("docx");
const fs = require("fs");

const primaryColor = "${(project.workspace?.primaryColor||"#1B6CA8").replace("#","")}";
const today = "${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}";

function H(text, level) {
  return new Paragraph({
    text, heading: level,
    spacing: { before: 240, after: 120 },
  });
}
function P(text) {
  return new Paragraph({
    children: [new TextRun({ text: text||"—", size: 22 })],
    spacing: { before: 80, after: 80 },
  });
}
function Label(label, value) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({ text: label+": ", bold: true, size: 22 }),
      new TextRun({ text: value||"—", size: 22 }),
    ],
  });
}
function HR() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: primaryColor } },
    spacing: { before: 80, after: 160 },
    children: [],
  });
}
function InfoRow(col1Label, col1Val, col2Label, col2Val) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: 4680, type: WidthType.DXA },
          borders: { top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE} },
          children: [Label(col1Label, col1Val)],
        }),
        new TableCell({
          width: { size: 4680, type: WidthType.DXA },
          borders: { top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE} },
          children: [Label(col2Label, col2Val)],
        }),
      ],
    })],
  });
}

${docType === "PROJECT_BRIEF" ? `
const doc = new Document({
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 } } },
    headers: { default: new Header({ children: [
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "${project.workspace?.name||"FlowSync PM"}", bold:true, color: primaryColor, size:20 }),
          new TextRun({ text: "  |  Project Brief  |  Confidential", size:18, color:"999999" }),
        ],
        alignment: AlignmentType.RIGHT,
      }),
    ]}) },
    footers: { default: new Footer({ children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "${project.name} — Project Brief  |  ", size:16, color:"999999" }),
          new TextRun({ children: [PageNumber.CURRENT], size:16, color:"999999" }),
          new TextRun({ text: " of ", size:16, color:"999999" }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size:16, color:"999999" }),
        ],
      }),
    ]}) },
    children: [
      // Title block
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 80 },
        children: [new TextRun({ text: "PROJECT BRIEF", bold:true, size:36, color:primaryColor })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: "${project.name}", bold:true, size:28 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: "${project.code}  |  As of ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}", size:20, color:"666666" })],
      }),

      HR(),

      // Project identification
      H("1. Project Identification", HeadingLevel.HEADING_1),
      InfoRow("Project Name", "${project.name}", "Project Code", "${project.code}"),
      InfoRow("Methodology", "${project.methodology}", "Priority", "${project.priority||"MEDIUM"}"),
      InfoRow("Status", "${project.status}", "Health", "${project.health}"),
      InfoRow("Project Manager", "${pm}", "Executive Sponsor", "${sponsor}"),
      InfoRow("Start Date", "${fmtDate(project.startDate)}", "End Date", "${fmtDate(project.endDate)}"),
      InfoRow("Budget", "${fmtCurrency(budgetTotal)}", "% Complete", "${project.percentComplete||0}%"),
      new Paragraph({ spacing: { after: 120 }, children: [] }),

      H("2. Project Objective", HeadingLevel.HEADING_1),
      P("${(project.objective||"Not specified").replace(/"/g,'\\"')}"),

      H("3. Scope", HeadingLevel.HEADING_1),
      H("3.1 In Scope", HeadingLevel.HEADING_2),
      P("${(project.scope||"Not specified").replace(/"/g,'\\"')}"),
      H("3.2 Out of Scope", HeadingLevel.HEADING_2),
      P("${(project.outOfScope||"Not specified").replace(/"/g,'\\"')}"),

      H("4. Background & Business Context", HeadingLevel.HEADING_1),
      P("${(project.background||"Not specified").replace(/"/g,'\\"')}"),

      H("5. Assumptions", HeadingLevel.HEADING_1),
      P("${(project.assumptions||"Not specified").replace(/"/g,'\\"')}"),

      H("6. Constraints", HeadingLevel.HEADING_1),
      P("${(project.constraints||"Not specified").replace(/"/g,'\\"')}"),

      H("7. Economic Impact & Benefits", HeadingLevel.HEADING_1),
      P("${(project.economicImpact||"Not specified").replace(/"/g,'\\"')}"),

      H("8. Project Team", HeadingLevel.HEADING_1),
      Label("Project Manager", "${pm}"),
      Label("Executive Sponsor", "${sponsor}"),

      new Paragraph({ children:[new TextRun({ break:1 })] }),
      HR(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "This document was generated by FlowSync PM on ${new Date().toLocaleDateString()}. It is confidential.", size:16, color:"999999" })],
      }),
    ],
  }],
});
` : `
// Status report docx
const reportTitle = ${JSON.stringify(reportData?.reportTitle||"Status Report")};
const summary = ${JSON.stringify(reportData?.executiveSummary||"")};
const accomplishments = ${JSON.stringify(reportData?.accomplishmentsThisWeek||[])};
const nextWeek = ${JSON.stringify(reportData?.plannedNextWeek||[])};
const risks = ${JSON.stringify(reportData?.risksAndIssues||"")};
const budget = ${JSON.stringify(reportData?.budgetStatus||"")};
const schedule = ${JSON.stringify(reportData?.scheduleStatus||"")};
const decisions = ${JSON.stringify(reportData?.decisionsNeeded||[])};

const doc = new Document({
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 } } },
    headers: { default: new Header({ children: [
      new Paragraph({
        children: [
          new TextRun({ text: "${project.workspace?.name||"FlowSync PM"}", bold:true, color: primaryColor, size:20 }),
          new TextRun({ text: "  |  Status Report  |  Confidential", size:18, color:"999999" }),
        ],
        alignment: AlignmentType.RIGHT,
      }),
    ]}) },
    footers: { default: new Footer({ children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: reportTitle+"  |  Page ", size:16, color:"999999" }),
          new TextRun({ children: [PageNumber.CURRENT], size:16, color:"999999" }),
        ],
      }),
    ]}) },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 80 },
        children: [new TextRun({ text: reportTitle, bold:true, size:28, color:primaryColor })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: "${project.name} (${project.code})  |  Generated: "+new Date().toLocaleDateString(), size:20, color:"666666" })],
      }),
      HR(),
      H("Executive Summary", HeadingLevel.HEADING_1),
      P(summary),
      H("Accomplishments This Period", HeadingLevel.HEADING_1),
      ...(accomplishments.map(a => new Paragraph({
        children: [new TextRun({ text: "• "+a, size:22 })],
        spacing: { before:60, after:60 },
      }))),
      H("Planned Next Period", HeadingLevel.HEADING_1),
      ...(nextWeek.map(a => new Paragraph({
        children: [new TextRun({ text: "• "+a, size:22 })],
        spacing: { before:60, after:60 },
      }))),
      H("Budget & Cost Status", HeadingLevel.HEADING_1),
      P(budget),
      H("Schedule Status", HeadingLevel.HEADING_1),
      P(schedule),
      H("Risks & Issues", HeadingLevel.HEADING_1),
      P(risks),
      ...(decisions.length > 0 ? [
        H("Decisions Required", HeadingLevel.HEADING_1),
        ...(decisions.map(d => new Paragraph({
          children: [new TextRun({ text: "• "+d, size:22, color:"DC2626" })],
          spacing: { before:60, after:60 },
        }))),
      ] : []),
      HR(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Generated by FlowSync PM — Industry-Standard PM Practices PMO Platform", size:16, color:"999999" })],
      }),
    ],
  }],
});
`}

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/tmp/flowsync_export.docx", buf);
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
`

  // Write script to temp file and execute
  const { writeFileSync, unlinkSync, existsSync } = await import("fs")
  const { execSync } = await import("child_process")
  const { join } = await import("path")

  const scriptPath = "/tmp/flowsync_docx_gen.js"
  writeFileSync(scriptPath, docxScript)

  try {
    // Install docx if not available
    try { execSync("node -e \"require('docx')\"", { stdio:"ignore" }) }
    catch { execSync("npm install docx --prefix /tmp/docx_modules --save 2>/dev/null || true") }

    execSync(`node ${scriptPath}`, {
      stdio:"pipe",
      env: { ...process.env, NODE_PATH:"/tmp/docx_modules/node_modules:/home/claude/restore-tmp/floesync-pm/node_modules" }
    })
  } catch (e: any) {
    return NextResponse.json({ error:"Document generation failed", details:e.message }, { status:500 })
  }

  if (!existsSync("/tmp/flowsync_export.docx")) {
    return NextResponse.json({ error:"Export file not created" }, { status:500 })
  }

  const { readFileSync } = await import("fs")
  const docxBuffer = readFileSync("/tmp/flowsync_export.docx")

  const filename = docType === "PROJECT_BRIEF"
    ? `${project.code}_Project_Brief_${new Date().toISOString().split("T")[0]}.docx`
    : `${project.code}_Status_Report_${new Date().toISOString().split("T")[0]}.docx`

  unlinkSync(scriptPath)
  try { unlinkSync("/tmp/flowsync_export.docx") } catch { /* best-effort temp cleanup */ }

  return new NextResponse(docxBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": docxBuffer.length.toString(),
    },
  })
}
