// src/app/api/auth/register/route.ts
export const dynamic = "force-dynamic"

import { sendEmail } from "@/lib/emails/templates"
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'

const schema = z.object({
  name:     z.string().min(1).max(200),
  email:    z.string().email(),
  password: z.string().min(8),
  // Consent is not a formality: required client-side AND here; the timestamp
  // is the legal record of when they agreed.
  acceptLegal: z.literal(true, { errorMap: () => ({ message: "You must accept the Terms of Service and Privacy Policy." }) }),
  newsletter:  z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    const { name, email, password, newsletter } = parsed.data

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
        legalAcceptedAt: new Date(),
        newsletterOptIn: !!newsletter,
        accounts: { create: { provider: "EMAIL", providerAccountId: email, accessToken: hashed } },
      },
      select: { id: true, email: true, name: true },
    })

    // Welcome email — fire-and-forget; a mail hiccup must never block signup.
    sendEmail({
      to: email,
      subject: "Welcome to FlowSync PM — your first project in 60 seconds",
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <div style="font-size:18px;font-weight:700;color:#0D1B2A;margin-bottom:12px">Welcome, ${name.split(" ")[0]} 👋</div>
        <p style="font-size:14px;color:#334155;line-height:1.65">Your two-month free trial of the full product just started. The fastest way to see what FlowSync PM can do: <strong>upload a project plan you already have</strong> — Word, Excel, or even a scanned PDF — and watch it become a live project with tasks, risks, and a Gantt.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL ? "https://flowsyncpm.com" : "https://flowsyncpm.com"}/dashboard" style="display:inline-block;background:#F59E0B;color:#0D1B2A;padding:11px 22px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;margin:10px 0">Open your workspace →</a>
        <p style="font-size:12px;color:#94A3B8;line-height:1.6">Questions? Just reply — a human reads this inbox.<br/>— Juan, founder of FlowSync PM</p>
      </div>`,
    }).catch(() => {})

    return NextResponse.json({ data: user }, { status: 201 })
  } catch (e: any) {
    console.error('[Register]', e)
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }
}
