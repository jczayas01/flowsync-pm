// src/lib/auth.ts
// NextAuth v5 configuration — email, Google, Microsoft, Azure AD

import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Google from 'next-auth/providers/google'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { compare } from 'bcryptjs'
import { z } from 'zod'

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function getUserByEmail(email: string) {
  return db.user.findUnique({
    where: { email },
    include: {
      memberships: {
        include: { workspace: true },
        take: 10,
      },
    },
  })
}

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/auth/signin',
    error:  '/auth/error',
    newUser: '/onboarding',
  },

  providers: [
    // ── Email + password (credentials) ──
    Credentials({
      name: 'Email',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = z.object({
          email:    z.string().email(),
          password: z.string().min(8),
        }).safeParse(credentials)

        if (!parsed.success) return null

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          include: {
            accounts: { where: { provider: 'EMAIL' } },
          },
        })

        if (!user || !user.isActive) return null

        // Find email account with hashed password
        const account = user.accounts[0]
        if (!account?.accessToken) return null // no password set

        const valid = await compare(parsed.data.password, account.accessToken)
        if (!valid) return null

        return {
          id:       user.id,
          email:    user.email,
          name:     user.name,
          image:    user.avatarUrl,
        }
      },
    }),

    // ── Google OAuth ──
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    // ── Microsoft personal account ──
    MicrosoftEntraID({
      clientId:     process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    // ── Azure AD (Business / Enterprise SSO) ──
    // Dynamically configured per workspace tenant
    MicrosoftEntraID({
      id:           'azure-ad',
      name:         'Azure AD (SSO)',
      clientId:     process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      // Single-tenant model: authenticate against the customer's tenant, not "common"
      issuer:       `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
      authorization: {
        params: {
          scope: 'openid profile email offline_access User.Read',
        },
      },
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  callbacks: {
    // ── JWT: embed user data into token ──
    async jwt({ token, user, account, trigger, session }) {
      // First sign-in
      if (user) {
        token.userId   = user.id
        token.email    = user.email
        token.provider = account?.provider
      }

      // Fetch workspace memberships on sign-in, on explicit update, or whenever the
      // token still has no workspace (a user who signs up before onboarding).
      //
      // CRITICAL: this callback ALSO runs inside middleware, which is Edge runtime —
      // where Prisma cannot execute. Running the query there threw on every request
      // for any user without a workspace, which made every BRAND-NEW signup bounce
      // between the app and the sign-in page forever. On Edge we skip the lookup and
      // trust the token as-is; the Node runtime (route handlers, server components)
      // performs the self-heal, and the API guard has its own DB fallback.
      const isEdge = process.env.NEXT_RUNTIME === 'edge'
      if (!isEdge && (trigger === 'signIn' || trigger === 'update' || !token.activeWorkspaceId)) {
        try {
        const dbUser = await db.user.findUnique({
          where: { id: token.userId as string },
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            timezone: true,
            locale: true,
            currency: true,
            memberships: {
              select: {
                role: true,
                workspace: {
                  select: {
                    id: true, name: true, slug: true,
                    plan: true, logoUrl: true, primaryColor: true,
                  },
                },
              },
            },
          },
        })

        if (dbUser) {
          token.name       = dbUser.name
          token.picture    = dbUser.avatarUrl
          token.timezone   = dbUser.timezone
          token.locale     = dbUser.locale
          token.currency   = dbUser.currency
          token.workspaces = dbUser.memberships.map(m => ({
            ...m.workspace,
            role: m.role,
          }))
          // Default to first workspace
          if (!token.activeWorkspaceId && dbUser.memberships[0]) {
            token.activeWorkspaceId = dbUser.memberships[0].workspace.id
          }
        }
        } catch (e) {
          // A failure here must never invalidate the session — log and move on.
          console.error('[auth] jwt enrichment failed (non-fatal)', e)
        }
      }

      // Handle workspace switch — VALIDATED. The client can send any id here;
      // honoring it blindly would let any signed-in user switch into any tenant.
      // token.workspaces was just re-read from the DB above (update triggers run
      // in the Node runtime), so membership is checked against fresh data.
      if (trigger === 'update' && session?.activeWorkspaceId) {
        const target = (token.workspaces as any[] | undefined)
          ?.find(w => w.id === session.activeWorkspaceId)
        if (target) {
          token.activeWorkspaceId = target.id
          token.workspaceRole     = target.role
        } else {
          console.warn('[auth] refused switch to non-member workspace', session.activeWorkspaceId)
        }
      }

      return token
    },

    // ── Session: expose token data to client ──
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id:                token.userId as string,
          timezone:          token.timezone as string,
          locale:            token.locale as string,
          currency:          token.currency as string,
          workspaces:        token.workspaces as any[],
          activeWorkspaceId: token.activeWorkspaceId as string,
        },
      }
    },

    // ── Sign-in: update lastLoginAt ──
    async signIn({ user }) {
      if (user.id) {
        await db.user.update({
          where: { id: user.id },
          data:  { lastLoginAt: new Date() },
        }).catch(() => {}) // don't block sign-in if this fails
      }
      return true
    },
  },

  events: {
    // OAuth signups never see a checkbox — the notice under the provider buttons
    // ("By continuing, you agree…") is the consent, recorded here at creation.
    async createUser({ user }) {
      try {
        await db.user.update({ where: { id: user.id }, data: { legalAcceptedAt: new Date() } })
      } catch { /* non-fatal — consent text was still shown */ }
    },
    // Create audit log on sign-in
    async signIn({ user }) {
      try {
      const memberships = await db.workspaceMember.findMany({
        where: { userId: user.id },
        select: { workspaceId: true },
        take: 1,
      })
      if (memberships[0]) {
        await db.auditLog.create({
          data: {
            workspaceId: memberships[0].workspaceId,
            userId:      user.id,
            action:      'user.signin',
            entityType:  'user',
            entityId:    user.id!,
          },
        }).catch(() => {})
      }
      } catch (e) { console.error('[auth] signIn event failed (non-fatal)', e) }
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

