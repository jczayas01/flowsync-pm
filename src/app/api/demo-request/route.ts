// src/app/api/demo-request/route.ts
// POST — public endpoint for Enterprise "Request a demo".
// The lead is ALWAYS stored first; email is best-effort after. A mail outage
// must never lose a lead.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { sendEmail, demoRequestNotification, demoRequestConfirmation } from "@/lib/emails/templates"

const schema = z.object({
  name:     z.string().min(1, "Name is required").max(200),
  email:    z.string().email("A valid email is required"),
  company:  z.string().min(1, "Company is required").max(200),
  teamSize: z.string().max(50).optional().nullable(),
  phone:    z.string().max(50).optional().nullable(),
  message:  z.string().max(2000).optional().nullable(),
  locale:   z.enum(["en", "es"]).optional(),
  source:   z.string().max(50).optional(),
  // Honeypot — bots fill hidden fields, humans never see them.
  website:  z.string().max(0).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Please check the form and try again." },
        { status: 400 },
      )
    }
    const { website, ...d } = parsed.data

    // Honeypot tripped → pretend success, save nothing.
    if (website) return NextResponse.json({ data: { message: "Thanks — we'll be in touch." } })

    const lead = await db.demoRequest.create({
      data: {
        name:     d.name.trim(),
        email:    d.email.toLowerCase().trim(),
        company:  d.company.trim(),
        teamSize: d.teamSize || null,
        phone:    d.phone || null,
        message:  d.message || null,
        locale:   d.locale || "en",
        source:   d.source || "landing",
      },
      select: { id: true, name: true, email: true, company: true, teamSize: true, phone: true, message: true },
    })

    // Best-effort notifications — never block or fail the request.
    const salesTo = process.env.SALES_EMAIL || process.env.RESEND_TO_EMAIL || "support@flowsyncpm.com"
    Promise.all([
      sendEmail({ to: salesTo, ...demoRequestNotification(lead) }),
      sendEmail({
        to: lead.email,
        ...demoRequestConfirmation({ recipientName: lead.name, locale: d.locale || "en" }),
      }),
    ]).catch(e => console.error("[DemoRequest] email failed (lead saved)", e))

    return NextResponse.json({ data: { message: "Thanks — we'll be in touch shortly." } }, { status: 201 })
  } catch (e) {
    console.error("[DemoRequest]", e)
    return NextResponse.json({ error: "Something went wrong. Please email us directly." }, { status: 500 })
  }
}
