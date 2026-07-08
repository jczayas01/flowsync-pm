// src/app/api/workspace/route.ts
// GET  /api/workspace — get current workspace settings
// POST /api/workspace — create workspace (called from onboarding)
// PATCH /api/workspace — update workspace settings

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// ─── Create ────────────────────────────────────────────
const createSchema = z.object({
  name:        z.string().min(2).max(200),
  timezone:    z.string().default('UTC'),
  currency:    z.string().length(3).default('USD'),
  plan:        z.enum(['FREE','PRO','CONSULTANT','BUSINESS','ENTERPRISE']).default('FREE'),
  logoUrl:     z.string().url().optional().nullable(),
  primaryColor:z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#1B6CA8'),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Prevent duplicate workspaces on double-click
  const existing = await db.workspaceMember.findFirst({
    where: { userId: session.user.id },
  })
  if (existing) {
    const ws = await db.workspace.findUnique({ where: { id: existing.workspaceId } })
    return NextResponse.json({ data: ws })
  }

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* no/invalid JSON body — treat as empty */ }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { name, timezone, currency, plan, logoUrl, primaryColor } = parsed.data

  // Generate unique slug
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
  const slug = `${baseSlug}-${Date.now().toString(36)}`

  const workspace = await db.workspace.create({
    data: {
      name, slug, plan,
      defaultTimezone: timezone,
      defaultCurrency: currency,
      logoUrl:         logoUrl || null,
      primaryColor,
      members: {
        create: {
          userId: session.user.id,
          role:   'ADMIN',
        },
      },
    },
  })

  return NextResponse.json({ data: workspace }, { status: 201 })
}

// ─── Read ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')

  const where = workspaceId
    ? { workspaceId, userId: session.user.id }
    : { userId: session.user.id }

  const member = await db.workspaceMember.findFirst({
    where,
    include: {
      workspace: {
        include: {
          _count: {
            select: { members: true, projects: true },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  if (!member) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
  }

  return NextResponse.json({ data: member.workspace, role: member.role })
}

// ─── Update ────────────────────────────────────────────
const updateSchema = z.object({
  name:         z.string().min(2).max(200).optional(),
  timezone:     z.string().optional(),
  currency:     z.string().length(3).optional(),
  logoUrl:      z.string().url().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor:  z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
}).strict()

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const member = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId: true, role: true },
  })
  if (!member) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const allowed = ['ADMIN', 'SYSTEM_ADMIN']
  if (!allowed.includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* no/invalid JSON body — treat as empty */ }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (parsed.data.name)         updates.name             = parsed.data.name
  if (parsed.data.timezone)     updates.defaultTimezone  = parsed.data.timezone
  if (parsed.data.currency)     updates.defaultCurrency  = parsed.data.currency
  if (parsed.data.logoUrl !== undefined) updates.logoUrl = parsed.data.logoUrl
  if (parsed.data.primaryColor) updates.primaryColor     = parsed.data.primaryColor
  if (parsed.data.accentColor)  updates.accentColor      = parsed.data.accentColor

  const workspace = await db.workspace.update({
    where: { id: member.workspaceId },
    data:  updates,
  })

  return NextResponse.json({ data: workspace })
}
