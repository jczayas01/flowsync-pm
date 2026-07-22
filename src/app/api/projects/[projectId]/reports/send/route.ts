// src/app/api/projects/[projectId]/reports/send/route.ts
// POST — email a generated report to team members and/or external contacts.
// Body: { reportData, subject, recipients: string[], note? , attachPdf? }
// Sends an executive-friendly HTML summary; optionally attaches the PDF
// (rendered server-side via the same generator as the download button).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"
import { db } from "@/lib/db"

const schema = z.object({
  reportData: z.any(),
  subject:    z.string().min(1).max(200),
  recipients: z.array(z.string().email()).min(1).max(25),
  note:       z.string().max(1000).optional().nullable(),
  attachPdf:  z.boolean().optional(),
})

const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string))

function sectionHtml(title: string, items?: (string | null | undefined)[]) {
  const list = (items || []).filter(Boolean)
  if (!list.length) return ""
  return `<h3 style="margin:18px 0 6px;font-size:14px;color:#0F172A">${esc(title)}</h3>
    <ul style="margin:0;padding-left:18px;color:#334155;font-size:13px;line-height:1.6">
      ${list.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  const workspaceId = req.headers.get("x-workspace-id") ||
    url.searchParams.get("workspaceId") || (session.user as any).activeWorkspaceId
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })
  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Invalid request" }, { status: 400 })
  }
  const { reportData, subject, recipients, note, attachPdf } = parsed.data
  const r = reportData?.report || {}

  const project = await db.project.findFirst({
    where: { id: params.projectId, workspaceId },
    select: { code: true, name: true, workspace: { select: { name: true, primaryColor: true } } },
  })
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const accent = project.workspace?.primaryColor || "#1B6CA8"
  const senderName = session.user.name || session.user.email || "A teammate"

  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden">
    <div style="background:${esc(accent)};padding:18px 22px;color:#fff">
      <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.85">${esc(project.workspace?.name || "FlowSync PM")}</div>
      <div style="font-size:18px;font-weight:700;margin-top:2px">${esc(subject)}</div>
      <div style="font-size:12px;opacity:.85;margin-top:2px">${esc(project.code)} · ${esc(project.name)}${r.overallHealth ? ` · ${esc(r.overallHealth)}` : ""}</div>
    </div>
    <div style="padding:20px 22px;background:#fff">
      ${note ? `<p style="font-size:13px;color:#334155;border-left:3px solid ${esc(accent)};padding-left:10px;margin:0 0 14px">${esc(note)}</p>` : ""}
      ${r.executiveSummary ? `<p style="font-size:13px;color:#334155;line-height:1.7;margin:0">${esc(r.executiveSummary)}</p>` : ""}
      ${sectionHtml("Accomplishments", r.accomplishments)}
      ${sectionHtml("Planned next", r.upcoming || r.nextSteps)}
      ${sectionHtml("Risks & issues", (r.risks || []).map((x: any) => typeof x === "string" ? x : x?.title))}
      ${sectionHtml("Decisions needed", r.decisionsNeeded)}
      <p style="font-size:11px;color:#94A3B8;margin-top:22px">
        Sent from FlowSync PM by ${esc(senderName)}.${attachPdf ? " Full report attached as PDF." : ""}
        AI-assisted content — review before acting on it.
      </p>
    </div>
  </div>`

  // Optional PDF attachment via the same server-side generator as the download.
  let attachments: { filename: string; content: string }[] | undefined
  if (attachPdf) {
    try {
      const { generateReportPdf } = await import("@/lib/pdf-report")
      const pdf = await generateReportPdf({
        org:         project.workspace?.name || "FlowSync PM",
        color:       accent,
        projectName: project.name,
        projectCode: project.code,
        report:      reportData?.report || reportData || {},
      } as any)
      attachments = [{
        filename: `${project.code}_report_${new Date().toISOString().split("T")[0]}.pdf`,
        content: Buffer.from(pdf).toString("base64"),
      }]
    } catch (e) {
      console.error("[ReportSend] PDF generation failed — sending without attachment", e)
    }
  }

  const { Resend } = await import("resend")
  const resend = new Resend(process.env.RESEND_API_KEY)
  const sent: string[] = []
  const failedTo: string[] = []
  for (const to of recipients) {
    const { error } = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL || "FlowSync PM <no-reply@flowsyncpm.com>",
      replyTo: session.user.email || process.env.RESEND_REPLY_TO || "support@flowsyncpm.com",
      to, subject, html, ...(attachments ? { attachments } : {}),
    })
    if (error) { console.error("[ReportSend] rejected for", to, JSON.stringify(error)); failedTo.push(to) }
    else sent.push(to)
  }

  return NextResponse.json({ data: { sent, failed: failedTo } })
}
