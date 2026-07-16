// src/app/(app)/admin/page.tsx
// Platform Admin — the operator's view ACROSS all tenants.
//
// Access is granted by the PLATFORM_ADMIN_EMAILS env var, deliberately NOT by a
// workspace role: workspace roles are assignable from inside the product, so
// gating on one would let any customer's Owner promote themselves into every
// other customer's data. An env allowlist can only be changed by whoever holds
// the Vercel account.
export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { AdminView } from "@/components/admin/AdminView"

function platformAdmins(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
}

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/admin")

  const email = (session.user.email || "").toLowerCase()
  const allowed = platformAdmins()

  // Fail closed: an empty allowlist grants nobody.
  if (!allowed.length || !allowed.includes(email)) redirect("/dashboard")

  const now = new Date()

  const [workspaces, users, demoRequests, counts] = await Promise.all([
    db.workspace.findMany({
      select: {
        id: true, name: true, slug: true, plan: true, seats: true,
        trialEndsAt: true, planRenewsAt: true, stripeCustomerId: true,
        ssoEnabled: true, createdAt: true,
        _count: { select: { members: true, projects: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.user.findMany({
      select: {
        id: true, name: true, email: true, isActive: true,
        lastLoginAt: true, createdAt: true,
        memberships: {
          select: { role: true, workspace: { select: { name: true, plan: true } } },
          take: 3,
        },
        accounts: { select: { provider: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    db.demoRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }).catch(() => []),
    Promise.all([
      db.workspace.count(),
      db.user.count(),
      db.project.count(),
      db.workspace.count({ where: { trialEndsAt: { gt: now } } }),
      db.user.count({ where: { lastLoginAt: { gt: new Date(now.getTime() - 7 * 864e5) } } }),
      db.demoRequest.count({ where: { status: "NEW" } }).catch(() => 0),
    ]),
  ])

  const [wsTotal, userTotal, projectTotal, activeTrials, activeUsers7d, newLeads] = counts

  return (
    <AdminView
      workspaces={JSON.parse(JSON.stringify(workspaces))}
      users={JSON.parse(JSON.stringify(users))}
      demoRequests={JSON.parse(JSON.stringify(demoRequests))}
      metrics={{ wsTotal, userTotal, projectTotal, activeTrials, activeUsers7d, newLeads }}
    />
  )
}
