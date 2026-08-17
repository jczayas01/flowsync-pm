// src/app/api/workspace/domain/route.ts
// GET    → current custom-domain state
// PUT    { domain }  → save (PENDING_DNS) — admin only, Enterprise/Business+
// POST   ?action=verify → real CNAME check; on success registers on Vercel → ACTIVE
// DELETE → remove domain (and from Vercel)
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { normalizeHost, verifyCname, registerOnVercel, removeFromVercel, APP_HOST } from "@/lib/custom-domain"

async function ctx() {
  const session = await auth()
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const m = await db.workspaceMember.findFirst({
    where: { userId: session.user.id },
    select: { workspaceId: true, role: true, workspace: { select: { plan: true, customDomain: true,
      customDomainStatus: true, customDomainVerifiedAt: true, customDomainError: true } as any } },
  }) as any
  if (!m) return { error: NextResponse.json({ error: "No workspace" }, { status: 404 }) }
  const admin = ["OWNER", "ADMIN", "SUPER_ADMIN"].includes(m.role)
  return { session, m, admin }
}

const view = (w: any) => ({
  domain: w?.customDomain || null, status: w?.customDomainStatus || null,
  verifiedAt: w?.customDomainVerifiedAt || null, error: w?.customDomainError || null, appHost: APP_HOST,
})

export async function GET() {
  const c = await ctx(); if ("error" in c) return c.error
  return NextResponse.json({ data: view(c.m.workspace) })
}

export async function PUT(req: NextRequest) {
  const c = await ctx(); if ("error" in c) return c.error
  if (!c.admin) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  if (!["ENTERPRISE", "BUSINESS"].includes(String(c.m.workspace.plan)))
    return NextResponse.json({ error: "Custom domains require Business or Enterprise" }, { status: 402 })
  const body = await req.json().catch(() => ({}))
  const host = normalizeHost(body?.domain)
  if (!host) return NextResponse.json({ error: "Enter a full hostname like pm.yourcompany.com" }, { status: 400 })
  try {
    const w = await db.workspace.update({ where: { id: c.m.workspaceId },
      data: { customDomain: host, customDomainStatus: "PENDING_DNS", customDomainVerifiedAt: null, customDomainError: null } as any })
    return NextResponse.json({ data: view(w) })
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "That domain is already in use by another workspace" }, { status: 409 })
    throw e
  }
}

export async function POST(req: NextRequest) {
  const c = await ctx(); if ("error" in c) return c.error
  if (!c.admin) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  const host = c.m.workspace.customDomain as string | null
  if (!host) return NextResponse.json({ error: "No domain set" }, { status: 400 })

  const dnsRes = await verifyCname(host)
  if (!dnsRes.ok) {
    const msg = dnsRes.reason === "NO_RECORD" ? `No DNS record found for ${host} yet — add the CNAME and try again (propagation can take up to 48h).`
      : dnsRes.reason === "CNAME_MISMATCH" ? `${host} points to ${dnsRes.found.join(", ")} — it must CNAME to ${APP_HOST}.`
      : dnsRes.reason === "A_MISMATCH" ? `${host} resolves to ${dnsRes.found.join(", ")} instead of our servers.`
      : `DNS lookup failed (${dnsRes.reason}).`
    await db.workspace.update({ where: { id: c.m.workspaceId },
      data: { customDomainStatus: "PENDING_DNS", customDomainError: msg } as any })
    return NextResponse.json({ data: { ...view({ ...c.m.workspace, customDomainStatus: "PENDING_DNS", customDomainError: msg }), dns: dnsRes } })
  }
  const reg = await registerOnVercel(host)
  if (!reg.ok) {
    await db.workspace.update({ where: { id: c.m.workspaceId },
      data: { customDomainStatus: "ERROR", customDomainError: reg.error || "Registration failed" } as any })
    return NextResponse.json({ error: reg.error || "Registration failed" }, { status: 502 })
  }
  const w = await db.workspace.update({ where: { id: c.m.workspaceId },
    data: { customDomainStatus: "ACTIVE", customDomainVerifiedAt: new Date(), customDomainError: null } as any })
  return NextResponse.json({ data: view(w) })
}

export async function DELETE() {
  const c = await ctx(); if ("error" in c) return c.error
  if (!c.admin) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  const host = c.m.workspace.customDomain as string | null
  if (host) await removeFromVercel(host).catch(() => false)
  const w = await db.workspace.update({ where: { id: c.m.workspaceId },
    data: { customDomain: null, customDomainStatus: null, customDomainVerifiedAt: null, customDomainError: null } as any })
  return NextResponse.json({ data: view(w) })
}
