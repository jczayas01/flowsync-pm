// src/app/api/legal/baa-request/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendEmail, workspaceInviteEmail } from "@/lib/emails/templates"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const {
      workspaceId, organizationName, organizationType, contactName,
      contactEmail, hipaaRole, phiTypes,
    } = body

    if (!organizationName || !contactEmail || !hipaaRole) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify user is admin of the workspace
    const membership = await db.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id, role: { in: ["ADMIN","SYSTEM_ADMIN"] } },
    })
    if (!membership) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Log to audit trail
    await db.auditLog.create({
      data: {
        workspaceId, userId: session.user.id,
        action:     "legal.baa_requested",
        entityType: "workspace",
        entityId:   workspaceId,
        metadata:   JSON.stringify({ organizationName, contactEmail, hipaaRole, phiTypes }),
      }
    }).catch(() => null) // non-blocking

    // Send internal notification email to legal team
    const legalEmail = {
      subject: `BAA Request: ${organizationName}`,
      html: `
        <h2>New BAA Request</h2>
        <table border="1" cellpadding="6">
          <tr><td><b>Organization</b></td><td>${organizationName}</td></tr>
          <tr><td><b>Type</b></td><td>${organizationType}</td></tr>
          <tr><td><b>Contact</b></td><td>${contactName} — ${contactEmail}</td></tr>
          <tr><td><b>HIPAA Role</b></td><td>${hipaaRole}</td></tr>
          <tr><td><b>PHI Types</b></td><td>${(phiTypes || []).join(", ") || "Not specified"}</td></tr>
          <tr><td><b>Workspace ID</b></td><td>${workspaceId}</td></tr>
          <tr><td><b>Requested by</b></td><td>${session.user.name} (${session.user.email})</td></tr>
          <tr><td><b>Timestamp</b></td><td>${new Date().toISOString()}</td></tr>
        </table>
        <p>Please send the BAA to <a href="mailto:${contactEmail}">${contactEmail}</a> for signature.</p>
      `
    }

    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from:    process.env.RESEND_FROM_EMAIL || "FlowSync PM <no-reply@flowsyncpm.com>",
        to:      "legal@flowsyncpm.com",
        subject: legalEmail.subject,
        html:    legalEmail.html,
      }).catch(console.error)

      // Also send confirmation to the requester
      await resend.emails.send({
        from:    process.env.RESEND_FROM_EMAIL || "FlowSync PM <no-reply@flowsyncpm.com>",
        to:      contactEmail,
        subject: "BAA Request Received — FlowSync PM",
        html: `
          <p>Dear ${contactName},</p>
          <p>We have received your Business Associate Agreement (BAA) request for <b>${organizationName}</b>.</p>
          <p>Our legal team will review your request and send the BAA for electronic signature via DocuSign within <b>2 business days</b>.</p>
          <p>If you have questions in the meantime, reply to this email or contact us at legal@flowsyncpm.com.</p>
          <p>Thank you,<br/>FlowSync PM Legal Team</p>
        `
      }).catch(console.error)
    }

    return NextResponse.json({
      success: true,
      message: "BAA request submitted. Our legal team will contact you within 2 business days.",
    })

  } catch (err) {
    console.error("[BAA Request]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
