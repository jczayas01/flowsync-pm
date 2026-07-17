// src/app/api/auth/register/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'

const schema = z.object({
  name:     z.string().min(1).max(200),
  email:    z.string().email(),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    const { name, email, password } = parsed.data

    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true, accounts: { select: { provider: true } } },
    })
    if (existing) {
      // A generic "already exists" strands people who signed up with Google or
      // Microsoft and are now trying to set a password — name the right door.
      const providers = existing.accounts.map(a => a.provider)
      const hasPassword = providers.includes('EMAIL')
      const oauth = providers.find(p => p !== 'EMAIL')
      const label = oauth?.toLowerCase().includes('google') ? 'Google'
                  : oauth ? 'Microsoft' : null
      return NextResponse.json({
        error: hasPassword
          ? 'An account with this email already exists. Sign in instead — or use "Forgot password?" if you can\'t get in.'
          : label
            ? `This email already has an account that signs in with ${label}. Use the "${label}" button on the sign-in page.`
            : 'An account with this email already exists. Sign in instead.',
      }, { status: 409 })
    }

    const hashed = await hash(password, 12)
    const user   = await db.user.create({
      data: {
        name, email, isActive: true,
        accounts: { create: { provider: "EMAIL", providerAccountId: email, accessToken: hashed } },
      },
      select: { id: true, email: true, name: true },
    })

    return NextResponse.json({ data: user }, { status: 201 })
  } catch (e: any) {
    console.error('[Register]', e)
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }
}
