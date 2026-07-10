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
      issuer:       'https://login.microsoftonline.com/consumers/v2.0',
      allowDangerousEmailAccountLinking: true,
    }),

    // ── Azure AD (Business / Enterprise SSO) ──
    // Dynamically configured per workspace tenant
    MicrosoftEntraID({
      id:           'azure-ad',
      name:         'Azure AD (SSO)',
      clientId:     process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer:       `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}/v2.0`,
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

      // Fetch workspace memberships on sign-in or explicit update
      if (trigger === 'signIn' || trigger === 'update') {
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
      }

      // Handle workspace switch
      if (trigger === 'update' && session?.activeWorkspaceId) {
        token.activeWorkspaceId = session.activeWorkspaceId
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
    // Create audit log on sign-in
    async signIn({ user }) {
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
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
