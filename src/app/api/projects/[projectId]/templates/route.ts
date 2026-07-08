// src/app/api/projects/[projectId]/templates/route.ts
// GET /api/projects/:id/templates?type=TEAM_CHARTER|WBS|REQUIREMENTS|QUALITY_PLAN|MEETING_MINUTES|HANDOVER_PLAN
// Downloads a pre-filled Word template for the given document type

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status:401 })

  const type = new URL(req.url).searchParams.get("type") || "TEAM_CHARTER"
  const projectId = params.projectId

  const project = await db.project.findUnique({
    where:  { id: projectId },
    select: { id:true, name:true, code:true, methodology:true,
              startDate:true, endDate:true, objective:true, scope:true,
              workspace:{ select:{ name:true, primaryColor:true } } },
  })
  if (!project) return new NextResponse("Not found", { status:404 })

  const color = (project.workspace?.primaryColor||"#1B6CA8").replace("#","")
  const today = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})
  const org = project.workspace?.name || "Organization"

  const TEMPLATES: Record<string,{title:string;filename:string;sections:Array<{h:string;content:string}>}> = {
    TEAM_CHARTER: {
      title: "Team Charter",
      filename: `${project.code}_Team_Charter_Template.docx`,
      sections: [
        { h:"Project Information", content:`Project: ${project.name} (${project.code})\nOrganization: ${org}\nDate: ${today}\nMethodology: ${project.methodology}` },
        { h:"Team Vision", content:"[Describe the team's shared vision — what does this team aim to achieve together?]\n\n" },
        { h:"Team Objectives & Success Criteria", content:"[List 3-5 measurable objectives. What does success look like?]\n\n1. \n2. \n3. " },
        { h:"Team Values & Working Agreements", content:"[List team values and how the team agrees to work together]\n\ne.g. Transparency, respect, accountability, quality, continuous improvement" },
        { h:"Working Norms", content:"Core hours: \nDaily standup: \nSprint/status cadence: \nMeeting-free time: \nResponse time expectations: " },
        { h:"Decision-Making Process", content:"[How are decisions made? Who has authority for what? When do we escalate?]\n\n" },
        { h:"Conflict Resolution", content:"[How will the team handle disagreements? Escalation path?]\n\n" },
        { h:"Communication Plan", content:"Primary tool: \nMeeting platform: \nDocumentation: \nEscalation: " },
        { h:"Tools & Processes", content:"Project management: FlowSync PM\nCode/work repository: \nReview process: \nDefinition of Done: " },
        { h:"Signatures", content:"By signing, team members agree to the norms and working agreements above.\n\nProject Manager: ______________ Date: ______\nSponsor: ______________ Date: ______\nTeam Members: ______________ Date: ______" },
      ]
    },
    WBS: {
      title: "WBS Dictionary",
      filename: `${project.code}_WBS_Dictionary_Template.docx`,
      sections: [
        { h:"Project Information", content:`Project: ${project.name} (${project.code})\nOrganization: ${org}\nDate: ${today}` },
        { h:"Instructions", content:"For each WBS element, complete a section below.\nWBS Code format: 1.0, 1.1, 1.1.1, etc.\nEach entry should define exactly what the deliverable IS, not how to build it." },
        { h:"WBS Entry Template", content:"WBS Code: ___________\nTitle: ___________\nDescription: [What is this deliverable? What does it include/exclude?]\n\nAcceptance Criteria:\n[ ] Criterion 1\n[ ] Criterion 2\n\nResponsible: ___________\nEstimated Effort: ___ hours\nDependencies: ___________\nQuality Standards: ___________" },
        { h:"WBS Entry 1.0", content:"WBS Code: 1.0\nTitle: \nDescription: \n\nAcceptance Criteria:\n\nResponsible: \nEstimated Effort: " },
        { h:"WBS Entry 1.1", content:"WBS Code: 1.1\nTitle: \nDescription: \n\nAcceptance Criteria:\n\nResponsible: \nEstimated Effort: " },
        { h:"WBS Entry 1.2", content:"WBS Code: 1.2\nTitle: \nDescription: \n\nAcceptance Criteria:\n\nResponsible: \nEstimated Effort: " },
        { h:"Approval", content:"Prepared by: ______________ Date: ______\nReviewed by: ______________ Date: ______\nApproved by: ______________ Date: ______" },
      ]
    },
    REQUIREMENTS: {
      title: "Requirements Documentation",
      filename: `${project.code}_Requirements_Template.docx`,
      sections: [
        { h:"Project Information", content:`Project: ${project.name} (${project.code})\nObjective: ${project.objective||"See project dashboard"}\nDate: ${today}` },
        { h:"Requirements Register Instructions", content:"Types: FUNCTIONAL | NON_FUNCTIONAL | BUSINESS | TECHNICAL | REGULATORY | OTHER\nPriority: CRITICAL | HIGH | MEDIUM | LOW\nStatus: DRAFT → APPROVED → IMPLEMENTED → VERIFIED\n\nEach requirement must have: unique code, title, description, acceptance criteria, and priority." },
        { h:"Functional Requirements", content:"REQ-F001:\nTitle: \nDescription: \nPriority: HIGH\nAcceptance Criteria: \nSource: \n\nREQ-F002:\nTitle: \nDescription: \nPriority: MEDIUM\nAcceptance Criteria: \nSource: " },
        { h:"Non-Functional Requirements", content:"REQ-NF001:\nTitle: \nDescription: \nPriority: HIGH\nAcceptance Criteria: \nSource: \n\nREQ-NF002:\nTitle: \nDescription: \nPriority: MEDIUM\nAcceptance Criteria: \nSource: " },
        { h:"Business Requirements", content:"REQ-B001:\nTitle: \nDescription: \nPriority: HIGH\nAcceptance Criteria: \nSource: " },
        { h:"Regulatory Requirements", content:"REQ-R001:\nTitle: \nRegulation/Standard: \nCompliance Requirement: \nPriority: CRITICAL\nAcceptance Criteria: " },
        { h:"Approval", content:"Business Analyst: ______________ Date: ______\nProduct Owner: ______________ Date: ______\nProject Manager: ______________ Date: ______\nSponsor: ______________ Date: ______" },
      ]
    },
    QUALITY_PLAN: {
      title: "Quality Management Plan",
      filename: `${project.code}_Quality_Management_Plan_Template.docx`,
      sections: [
        { h:"Project Information", content:`Project: ${project.name} (${project.code})\nOrganization: ${org}\nDate: ${today}` },
        { h:"Quality Standards", content:"[List applicable standards, regulations, or organizational policies]\n\ne.g. ISO 9001:2015, organizational coding standards, industry regulations..." },
        { h:"Quality Objectives", content:"[Measurable quality targets — at least 3]\n\n1. Defect rate below ___% in UAT\n2. Test coverage above ___% \n3. Customer satisfaction score above ___\n4. " },
        { h:"Roles & Responsibilities", content:"Quality Manager: \nQA Lead: \nReviewers: \nApprovers: " },
        { h:"Quality Assurance Processes", content:"Code/work reviews: \nTesting approach: \nInspections and audits: \nSign-off process: " },
        { h:"Quality Control Tools", content:"[Tools used for QA/QC activities]\n\nCode review: \nTesting tools: \nDocumentation review: \nMetrics tracking: " },
        { h:"Quality Metrics", content:"Metric 1: ___________  Target: ___  Measurement: ___\nMetric 2: ___________  Target: ___  Measurement: ___\nMetric 3: ___________  Target: ___  Measurement: ___" },
        { h:"Audit Schedule", content:"Quality Audit 1: Date ___ Focus: ___\nQuality Audit 2: Date ___ Focus: ___\nFinal Quality Review: Date ___ Focus: ___" },
        { h:"Non-Conformance Handling", content:"When quality standards are not met:\n1. Document the non-conformance\n2. Root cause analysis within ___ days\n3. Corrective action plan by: ___\n4. Re-inspection/re-test after fix\n5. Escalate to: ___ if not resolved in ___ days" },
        { h:"Approval", content:"Prepared by: ______________ Date: ______\nQuality Manager: ______________ Date: ______\nProject Manager: ______________ Date: ______\nSponsor: ______________ Date: ______" },
      ]
    },
    MEETING_MINUTES: {
      title: "Meeting Minutes",
      filename: `${project.code}_Meeting_Minutes_Template.docx`,
      sections: [
        { h:"Meeting Information", content:`Project: ${project.name} (${project.code})\nMeeting Title: \nDate: \nTime: \nLocation/Platform: \nFacilitator: \nMinutes taken by: ` },
        { h:"Attendees", content:"Present:\n• \n• \n• \n\nAbsent (notified):\n• " },
        { h:"Agenda", content:"1. \n2. \n3. \n4. AOB (Any Other Business)" },
        { h:"Discussion", content:"Item 1: \n[Notes]\n\nItem 2: \n[Notes]\n\nItem 3: \n[Notes]" },
        { h:"Decisions Made", content:"Decision 1: \nRationale: \nAuthority: \n\nDecision 2: \nRationale: \nAuthority: " },
        { h:"Action Items", content:"#  |  Action  |  Owner  |  Due Date  |  Status\n1. |          |         |            | OPEN\n2. |          |         |            | OPEN\n3. |          |         |            | OPEN" },
        { h:"Risks & Issues Raised", content:"Risk/Issue 1: \nOwner: \n\nRisk/Issue 2: \nOwner: " },
        { h:"Next Meeting", content:"Date: \nTime: \nPlatform: \nProposed Agenda: " },
        { h:"Distribution", content:"Minutes distributed to: \nDate distributed: \nApproved by: " },
      ]
    },
    HANDOVER_PLAN: {
      title: "Transition & Handover Plan",
      filename: `${project.code}_Handover_Plan_Template.docx`,
      sections: [
        { h:"Project Information", content:`Project: ${project.name} (${project.code})\nOrganization: ${org}\nHandover Date: \nPrepared by: \nDate: ${today}` },
        { h:"Handover Overview", content:"[Describe what is being handed over, to whom, and why this project is transitioning to operations]\n\n" },
        { h:"Receiving Organization / Team", content:"Operations Lead: \nOrganization: \nContact: \nEmail: \nPhone: " },
        { h:"Systems & Deliverables Handed Over", content:"System/Deliverable 1: ___  Status: ___  Handover Date: ___\nSystem/Deliverable 2: ___  Status: ___  Handover Date: ___\nSystem/Deliverable 3: ___  Status: ___  Handover Date: ___" },
        { h:"Documentation Provided", content:"[ ] User manual\n[ ] Technical documentation\n[ ] System architecture\n[ ] Training materials\n[ ] Operations runbook\n[ ] Source code / repositories\n[ ] Other: ___" },
        { h:"Training Completed", content:"Training Session 1:\nDate: \nAttendees: \nTopics covered: \n\nTraining Session 2:\nDate: \nAttendees: \nTopics covered: " },
        { h:"Known Issues & Workarounds", content:"Issue 1: \nWorkaround: \nExpected fix date: \n\nIssue 2: \nWorkaround: \nExpected fix date: " },
        { h:"Support Arrangements", content:"Post-handover support period: ___ months\nSupport contact: \nSupport hours: \nEscalation: \nSLA: " },
        { h:"Acceptance Sign-off", content:"The receiving team confirms that all deliverables have been received and handover is complete.\n\nReceiving Lead: ______________ Date: ______\nProject Manager: ______________ Date: ______\nSponsor: ______________ Date: ______" },
      ]
    },
  }

  const tmpl = TEMPLATES[type]
  if (!tmpl) return new NextResponse("Invalid template type", { status:400 })

  // Generate docx using node script
  const { execSync, spawnSync } = await import("child_process")
  const { writeFileSync, readFileSync, existsSync, unlinkSync } = await import("fs")

  const scriptPath = "/tmp/flowsync_tmpl_gen.js"
  const outPath    = "/tmp/flowsync_template.docx"

  const script = `
const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType } = require("docx")
const fs = require("fs")

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before:240, after:80 },
        children: [new TextRun({ text:${JSON.stringify(tmpl.title.toUpperCase())}, bold:true, size:32, color:${JSON.stringify(color)} })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after:80 },
        children: [new TextRun({ text:${JSON.stringify(project.name+" ("+project.code+")")}, size:22, color:"666666" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after:240 },
        children: [new TextRun({ text:${JSON.stringify(org+" | "+today)}, size:18, color:"999999" })],
      }),
      new Paragraph({
        border: { bottom:{ style:BorderStyle.SINGLE, size:8, color:${JSON.stringify(color)} } },
        spacing: { before:120, after:240 },
        children: [],
      }),
      ${tmpl.sections.map(s => `
        new Paragraph({ text:${JSON.stringify(s.h)}, heading:HeadingLevel.HEADING_1, spacing:{ before:280, after:120 } }),
        ...${JSON.stringify(s.content)}.split("\\n").map(line =>
          new Paragraph({ children:[new TextRun({ text:line, size:22 })], spacing:{ before:60, after:60 } })
        ),
        new Paragraph({ spacing:{ after:160 }, children:[] }),
      `).join("")}
      new Paragraph({
        border: { top:{ style:BorderStyle.SINGLE, size:4, color:"E2E8F0" } },
        spacing: { before:240, after:80 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text:"Template generated by FlowSync PM — Industry-Standard PM Practices", size:16, color:"94A3B8" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text:"After completing, upload this document to the Governance tab > AI Ingestion to auto-populate project data.", size:14, color:"94A3B8", italics:true })],
      }),
    ],
  }],
})

Packer.toBuffer(doc).then(buf => { fs.writeFileSync(${JSON.stringify(outPath)}, buf); process.exit(0) })
  .catch(e => { console.error(e); process.exit(1) })
`

  writeFileSync(scriptPath, script)
  const result = spawnSync("node", [scriptPath], {
    env: { ...process.env, NODE_PATH:"/home/claude/restore-tmp/floesync-pm/node_modules" },
    timeout: 15000,
  })

  if (result.status !== 0 || !existsSync(outPath)) {
    return new NextResponse("Template generation failed", { status:500 })
  }

  const buf = readFileSync(outPath)
  try { unlinkSync(scriptPath); unlinkSync(outPath) } catch { /* best-effort temp cleanup */ }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${tmpl.filename}"`,
      "Content-Length": buf.length.toString(),
    },
  })
}
