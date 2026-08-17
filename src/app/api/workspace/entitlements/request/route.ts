// src/app/api/workspace/entitlements/request/route.ts
// Customer asks for more seats / bundles / OCR blocks. Records the request
// and emails the platform admins with the priced ask. Nothing changes on the
// workspace until an admin approves (Admin → Requests).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { resolveEntitlements } from "@/lib/entitlements"
import { sendEmail } from "@/lib/emails/templates"

const schema = z.object({
  kind: z.enum(["SEATS", "BUNDLES", "OCR_BLOCKS"]),
  quantity: z.number().int().min(1).max(500),
  note: z.string().max(500).optional().nullable(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const member = await db.workspaceMember.findFirst({
    where: { userId: session.user.id },
    select: { workspaceId: true, role: true, workspace: { select: { name: true, plan: true } } },
  })
  if (!member) return NextResponse.json({ error: "No workspace" }, { status: 404 })
  if (!["OWNER", "ADMIN", "SUPER_ADMIN", "PMO_DIRECTOR"].includes(member.role))
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  const d = parsed.data

  const ent = await resolveEntitlements(member.workspaceId)
  const unit = d.kind === "SEATS" ? ent.prices.seat : d.kind === "BUNDLES" ? ent.prices.bundle : ent.prices.ocrPack

  const reqRow = await (db as any).entitlementRequest.create({
    data: {
      workspaceId: member.workspaceId, contractId: ent.contractId || null,
      kind: d.kind, quantity: d.quantity, unitPrice: unit,
      requestedById: session.user.id, note: d.note || null,
    },
  })

  // Email platform admins — the ask, priced, with who/where.
  const admins = (process.env.PLATFORM_ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean)
  const label = { SEATS: "paid seat(s)", BUNDLES: "contributor bundle(s) (×10)", OCR_BLOCKS: "OCR pack(s) (+200 pages/mo)" }[d.kind]
  const monthly = d.quantity * unit
  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:14px;color:#0D1B2A">
      <h2 style="margin:0 0 8px">Entitlement request — ${member.workspace.name}</h2>
      <p><b>${session.user.name || session.user.email}</b> (${session.user.email}) requests
         <b>+${d.quantity} ${label}</b>.</p>
      <p>Plan: ${ent.plan}${ent.source === "contract" ? ` · Contract: ${ent.contractName}` : ""}<br/>
         Unit price: $${unit}/mo · Added monthly: <b>$${monthly.toLocaleString("en-US")}</b>
         ${ent.source === "contract" ? " · prorated by remaining term when invoiced" : ""}</p>
      <p>Current: ${ent.seats} seats · ${ent.bundles} bundles · ${ent.ocrPages} OCR pages/mo</p>
      ${d.note ? `<p style="color:#64748B">Note: ${d.note}</p>` : ""}
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://flowsyncpm.com"}/admin?tab=requests"
            style="display:inline-block;padding:8px 14px;background:#0D1B2A;color:#fff;border-radius:6px;text-decoration:none">
         Review in Platform Admin</a></p>
      <p style="font-size:11px;color:#94A3B8">Request id ${reqRow.id}</p>
    </div>`
  for (const to of admins) {
    await sendEmail({ to, subject: `[FlowSync] +${d.quantity} ${label} — ${member.workspace.name}`, html }).catch(() => {})
  }

  return NextResponse.json({ data: { id: reqRow.id, unitPrice: unit, monthly } }, { status: 201 })
}
