// src/app/api/scim/route.ts
// SCIM 2.0 provisioning endpoint for Azure AD automatic user sync
// When HR deactivates an employee in Azure AD → access revoked automatically

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { revokeAllSessions } from "@/lib/security/sessions"
import { writeAuditLog } from "@/lib/security/audit"

// Validate SCIM bearer token
function validateSCIMToken(req: NextRequest, workspaceId: string): boolean {
  const auth     = req.headers.get("authorization") || ""
  const token    = auth.replace("Bearer ", "")
  const expected = process.env[`SCIM_TOKEN_${workspaceId.toUpperCase()}`]
               || process.env.SCIM_TOKEN
  return !!expected && token === expected
}

function scimUser(user: any, member: any) {
  return {
    schemas:    ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id:         user.id,
    userName:   user.email,
    name: {
      formatted: user.name,
      givenName: user.name.split(" ")[0],
      familyName:user.name.split(" ").slice(1).join(" "),
    },
    emails: [{ value: user.email, primary: true }],
    active: user.isActive,
    meta: {
      resourceType: "User",
      created:      user.createdAt,
      lastModified: user.updatedAt,
      location:     `/scim/v2/Users/${user.id}`,
    },
    // Custom extension: workspace role
    "urn:ietf:params:scim:schemas:extension:floesync:2.0:User": {
      workspaceRole: member?.role || "MEMBER",
    },
  }
}

// GET /api/scim/Users — list users
// GET /api/scim/Users/:id — get user
// POST /api/scim/Users — provision new user
// PATCH /api/scim/Users/:id — update user (includes deactivation)
// DELETE /api/scim/Users/:id — deprovision

export async function GET(req: NextRequest) {
  const url         = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId") || ""

  if (!validateSCIMToken(req, workspaceId)) {
    return NextResponse.json(
      { schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], status: 401, detail: "Unauthorized" },
      { status: 401 }
    )
  }

  const filter    = url.searchParams.get("filter") || ""
  const startIdx  = parseInt(url.searchParams.get("startIndex") || "1")
  const count     = parseInt(url.searchParams.get("count") || "100")

  // Parse filter (userName eq "user@example.com")
  const emailMatch = filter.match(/userName eq "([^"]+)"/i)
  const emailFilter = emailMatch ? emailMatch[1] : undefined

  const members = await db.workspaceMember.findMany({
    where: {
      workspaceId,
      ...(emailFilter && { user: { email: emailFilter } }),
    },
    include: { user: true },
    skip:    startIdx - 1,
    take:    count,
  })

  const total = await db.workspaceMember.count({ where: { workspaceId } })

  return NextResponse.json({
    schemas:      ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: total,
    startIndex:   startIdx,
    itemsPerPage: count,
    Resources:    members.map(m => scimUser(m.user, m)),
  })
}

export async function POST(req: NextRequest) {
  const url         = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId") || ""

  if (!validateSCIMToken(req, workspaceId)) {
    return NextResponse.json({ status: 401 }, { status: 401 })
  }

  const body = await req.json()
  const email = body.emails?.[0]?.value || body.userName
  const name  = body.name?.formatted || `${body.name?.givenName} ${body.name?.familyName}`.trim()

  if (!email) {
    return NextResponse.json(
      { schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "Email required", status: 400 },
      { status: 400 }
    )
  }

  // Upsert user
  const user = await db.user.upsert({
    where:  { email },
    create: { email, name: name || email, isActive: body.active !== false },
    update: { name: name || undefined, isActive: body.active !== false },
  })

  // Add to workspace
  await db.workspaceMember.upsert({
    where:  { workspaceId_userId: { workspaceId, userId: user.id } },
    create: { workspaceId, userId: user.id, role: "MEMBER" },
    update: {},
  })

  await writeAuditLog({
    workspaceId, userId: user.id,
    action: "user.created", entityType: "user", entityId: user.id,
    after: { email, source: "scim" } as any,
  })

  return NextResponse.json(scimUser(user, { role: "TEAM_MEMBER" }), { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const url         = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId") || ""
  const userId      = url.searchParams.get("userId") || ""

  if (!validateSCIMToken(req, workspaceId)) {
    return NextResponse.json({ status: 401 }, { status: 401 })
  }

  const body       = await req.json()
  const operations = body.Operations || []

  for (const op of operations) {
    // Handle deactivation: { op: "replace", path: "active", value: false }
    if (op.path === "active" && op.value === false) {
      await db.user.update({ where: { id: userId }, data: { isActive: false } })
      await revokeAllSessions(userId, undefined, "scim")
      await writeAuditLog({
        workspaceId, userId,
        action: "user.deactivated", entityType: "user", entityId: userId,
        after: { reason: "scim_deprovisioned" } as any,
      })
    }
    if (op.path === "active" && op.value === true) {
      await db.user.update({ where: { id: userId }, data: { isActive: true } })
    }
  }

  const user   = await db.user.findUnique({ where: { id: userId } })
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })

  if (!user) return NextResponse.json({ status: 404 }, { status: 404 })
  return NextResponse.json(scimUser(user, member))
}

export async function DELETE(req: NextRequest) {
  const url         = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId") || ""
  const userId      = url.searchParams.get("userId") || ""

  if (!validateSCIMToken(req, workspaceId)) {
    return NextResponse.json({ status: 401 }, { status: 401 })
  }

  await db.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId } },
  }).catch(() => {})

  await revokeAllSessions(userId, undefined, "scim")

  await writeAuditLog({
    workspaceId, userId,
    action: "user.removed", entityType: "user", entityId: userId,
    after: { reason: "scim_deleted" } as any,
  })

  return new NextResponse(null, { status: 204 })
}
