// ═══════════════════════════════════════════════════════
// src/app/api/projects/[projectId]/m365/route.ts
// GET  — scan M365 for project signals
// POST — accept/reject a signal update
// ═══════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { scanProjectSignals } from '@/lib/m365/graph'
import {
  withAuth, ok, err, handleApiError,
  requireProjectAccess, validate,
  type AuthContext
} from '@/lib/auth/middleware'
import { updateProjectCompletion } from '../tasks/route'

export const GET = withAuth(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    if (!ctx.microsoftAccessToken) {
      return err(401, 'NO_M365_TOKEN', 'Connect your Microsoft account in Settings to use this feature')
    }

    const projectId = params?.projectId!
    const project = await requireProjectAccess(projectId, ctx, 'VIEWER')

    const tasks = await prisma.task.findMany({
      where: { projectId, status: { notIn: ['DONE', 'CANCELLED'] } },
      select: { title: true },
      take: 20,
    })

    const signals = await scanProjectSignals(
      ctx.microsoftAccessToken,
      project.name,
      tasks.map(t => t.title)
    )

    return ok(signals)
  } catch (error) {
    return handleApiError(error)
  }
}, { requireM365: true })

const acceptSignalSchema = z.object({
  signalId: z.string(),
  signalType: z.enum(['email', 'meeting', 'planner']),
  updates: z.array(z.object({
    taskId: z.string().cuid(),
    field: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })).optional().default([]),
  logMinutes: z.boolean().optional().default(false),
  minutesSummary: z.string().optional(),
})

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const projectId = params?.projectId!
    await requireProjectAccess(projectId, ctx, 'MEMBER')

    const body = await req.json()
    const { action, ...data } = body

    if (action === 'accept') {
      const payload = validate(data, acceptSignalSchema)

      // Apply task updates
      for (const update of payload.updates) {
        await prisma.task.update({
          where: { id: update.taskId, projectId },
          data: { [update.field]: update.value, updatedAt: new Date() },
        })
      }

      // Log meeting minutes if requested
      if (payload.logMinutes && payload.minutesSummary) {
        await prisma.statusUpdate.create({
          data: {
            projectId,
            type: 'WEEKLY_STATUS',
            periodStart: new Date(),
            periodEnd: new Date(),
            health: 'GREEN',
            summary: payload.minutesSummary,
            aiGenerated: true,
            createdById: ctx.userId,
          },
        })
      }

      if (payload.updates.length > 0) {
        await updateProjectCompletion(projectId)
      }

      return ok({ accepted: true, updatesApplied: payload.updates.length })
    }

    return ok({ ignored: true })
  } catch (error) {
    return handleApiError(error)
  }
}, { requireM365: true })


// ═══════════════════════════════════════════════════════
// src/app/api/webhooks/stripe/route.ts
// Stripe webhook — subscription lifecycle events
// ═══════════════════════════════════════════════════════

// @ts-nocheck (separate file in real app)
export async function handleStripeWebhook(req: NextRequest) {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
  const sig = req.headers.get('stripe-signature')!
  const body = await req.text()

  let event: any
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return new Response('Webhook signature invalid', { status: 400 })
  }

  const { prisma: db } = await import('@/lib/db/prisma')

  switch (event.type) {

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object
      const plan = stripePriceToPlan(sub.items.data[0]?.price?.id)
      if (!plan) break

      await db.workspace.updateMany({
        where: { stripeCustomerId: sub.customer },
        data: {
          plan,
          stripeSubscriptionId: sub.id,
          planRenewsAt: new Date(sub.current_period_end * 1000),
        },
      })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object
      await db.workspace.updateMany({
        where: { stripeCustomerId: sub.customer },
        data: { plan: 'FREE', stripeSubscriptionId: null, planRenewsAt: null },
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object
      // TODO: Send payment failure email via Resend
      console.warn('[Stripe] Payment failed for customer:', invoice.customer)
      break
    }
  }

  return new Response('OK', { status: 200 })
}

function stripePriceToPlan(priceId: string | undefined): string | null {
  const map: Record<string, string> = {
    [process.env.STRIPE_PRICE_PRO_MONTHLY ?? '']: 'PRO',
    [process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? '']: 'BUSINESS',
    [process.env.STRIPE_PRICE_CONSULTANT_MONTHLY ?? '']: 'CONSULTANT',
  }
  return priceId ? (map[priceId] ?? null) : null
}


// ═══════════════════════════════════════════════════════
// src/middleware.ts
// Next.js edge middleware — route protection + workspace slug routing
// ═══════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth/auth.config'

// Public routes — no auth required
const PUBLIC_ROUTES = [
  '/auth/signin',
  '/auth/signout',
  '/auth/error',
  '/auth/verify',
  '/intake',         // public project intake forms (/intake/[workspace-slug])
  '/api/webhooks',   // Stripe webhooks
  '/api/auth',       // NextAuth routes
  '/',               // landing page
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public routes
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // Allow static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  // Auth check for all other routes
  const session = await auth()

  if (!session) {
    // API routes return 401
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }
    // App routes redirect to sign-in
    const url = req.nextUrl.clone()
    url.pathname = '/auth/signin'
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  // Workspace required for dashboard routes
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/projects')) {
    if (!session.user.activeWorkspaceId) {
      const url = req.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
  }

  // Add user context headers for API routes (avoids re-fetching session)
  const res = NextResponse.next()
  res.headers.set('x-user-id', session.user.id ?? '')
  res.headers.set('x-workspace-id', session.user.activeWorkspaceId ?? '')

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
