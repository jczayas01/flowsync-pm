// src/app/(app)/settings/billing/page.tsx
// Server component: reads the workspace's REAL plan from the database.
// The previous version hardcoded useState("FREE") and rendered a retired
// pricing model (Starter $12 / Professional / Consultant) with Stripe buttons
// that error when Stripe isn't configured.
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { BillingView } from "@/components/settings/BillingView"

export const metadata: Metadata = { title: "Billing" }
export const dynamic = "force-dynamic"

export default async function BillingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/settings/billing")

  const m = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: {
      role: true,
      workspace: { select: {
        id: true, name: true, plan: true, seats: true,
        trialEndsAt: true, planRenewsAt: true, stripeCustomerId: true,
        _count: { select: { members: true } },
      } },
    },
  })
  if (!m) redirect("/onboarding")

  const w = m.workspace
  return (
    <BillingView
      plan={w.plan}
      seats={w.seats}
      memberCount={w._count.members}
      trialEndsAt={w.trialEndsAt ? w.trialEndsAt.toISOString() : null}
      planRenewsAt={w.planRenewsAt ? w.planRenewsAt.toISOString() : null}
      hasStripeCustomer={!!w.stripeCustomerId}
      stripeConfigured={!!process.env.STRIPE_SECRET_KEY}
      canManage={["OWNER","ADMIN","SUPER_ADMIN"].includes(m.role)}
    />
  )
}
