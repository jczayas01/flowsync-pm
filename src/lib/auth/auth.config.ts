// src/lib/auth/auth.config.ts
// NextAuth v5 configuration — email, Google, Microsoft, Azure AD

import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db/prisma'
import { compare } from 'bcryptjs'
import type { NextAuthConfig } from 'next-auth'
import type { UserRole } from '@/types'

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),

  // ── Session ──
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // ── Pages ──
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify',
  },

  // ── Providers ──
  providers: [

    // Email + password (Free / Pro / Consultant tiers)
    CredentialsProvider({
      id: 'credentials',
      name: 'Email & password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { accounts: true },
        })

        if (!user || !user.isActive) return null

        // Find the credentials account
        const credAccount = user.accounts.find(
          a => a.provider === 'EMAIL'
        )
        if (!credAccount?.accessToken) return null  // no password set

        const valid = await compare(
          credentials.password as string,
          credAccount.accessToken
        )
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
        }
      },
    }),

    // Google OAuth (Free / Pro / Consultant tiers)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),

    // Microsoft personal account (Free / Pro / Consultant tiers)
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: 'common', // accepts personal + work accounts
      authorization: {
        params: {
          scope: 'openid profile email offline_access',
        },
      },
    }),

    // Azure AD SSO (Business / Enterprise tiers only)
    // Dynamically configured per workspace tenant
    MicrosoftEntraID({
      id: 'azure-ad-sso',
      name: 'Azure AD SSO',
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!, // org-specific tenant
      authorization: {
        params: {
          scope: 'openid profile email offline_access User.Read',
        },
      },
    }),
  ],

  // ── Callbacks ──
  callbacks: {

    // Validate sign-in
    async signIn({ user, account, profile }) {
      if (!user.email) return false

      // Azure AD SSO — verify workspace has this tenant configured
      if (account?.provider === 'azure-ad-sso') {
        const tenantId = (profile as any)?.tid
        if (!tenantId) return false

        const workspace = await prisma.workspace.findFirst({
          where: { azureTenantId: tenantId, ssoEnabled: true },
        })
        if (!workspace) return '/auth/error?error=NoSSO'
      }

      return true
    },

    // Enrich JWT with user/workspace data
    async jwt({ token, user, account, trigger, session }) {
      // Initial sign-in
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          include: {
            memberships: {
              include: { workspace: { select: { id: true, name: true, slug: true, plan: true, logoUrl: true, primaryColor: true } } },
            },
          },
        })

        if (dbUser) {
          token.userId = dbUser.id
          token.role = dbUser.memberships[0]?.role ?? 'VIEWER'
          token.workspaces = dbUser.memberships.map(m => ({
            id: m.workspace.id,
            name: m.workspace.name,
            slug: m.workspace.slug,
            plan: m.workspace.plan,
            logoUrl: m.workspace.logoUrl,
            primaryColor: m.workspace.primaryColor,
            role: m.role,
          }))
          token.activeWorkspaceId = dbUser.memberships[0]?.workspaceId
        }

        // Store M365 tokens for Graph API calls
        if (account?.provider === 'azure-ad-sso' || account?.provider === 'microsoft-entra-id') {
          token.microsoftAccessToken = account.access_token
          token.microsoftRefreshToken = account.refresh_token
          token.microsoftTokenExpiry = account.expires_at
        }
      }

      // Session update (e.g. workspace switch)
      if (trigger === 'update' && session?.activeWorkspaceId) {
        token.activeWorkspaceId = session.activeWorkspaceId
      }

      return token
    },

    // Expose to session object
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string
        session.user.role = token.role as UserRole
        session.user.workspaces = token.workspaces as any[]
        session.user.activeWorkspaceId = token.activeWorkspaceId as string
        session.microsoftAccessToken = token.microsoftAccessToken as string | undefined
      }
      return session
    },
  },

  // ── Events ──
  events: {
    async signIn({ user, isNewUser }) {
      // Update lastLoginAt
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })
      }

      // New user — create a personal workspace
      if (isNewUser && user.id && user.email) {
        const slug = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
        const workspace = await prisma.workspace.create({
          data: {
            name: user.name ?? 'My Workspace',
            slug: `${slug}-${Date.now()}`,
            plan: 'FREE',
            members: {
              create: {
                userId: user.id,
                role: 'OWNER',
              },
            },
          },
        })

        // Seed default templates for the new workspace
        await seedDefaultTemplates(workspace.id, user.id)
      }
    },

    async signOut({ token }) {
      // Log the sign-out
      if ((token as any)?.userId) {
        await prisma.auditLog.create({
          data: {
            workspaceId: (token as any).activeWorkspaceId ?? '',
            userId: (token as any).userId,
            action: 'user.signed_out',
            entityType: 'User',
            entityId: (token as any).userId,
          },
        }).catch(() => {}) // non-critical
      }
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

// ── Helpers ──
async function seedDefaultTemplates(workspaceId: string, userId: string) {
  // Seed built-in templates for new workspaces
  const templates = [
    {
      name: 'Software Development (Waterfall)',
      methodology: 'WATERFALL' as const,
      industry: 'Technology',
      templateData: {
        phases: ['Initiation', 'Planning', 'Design', 'Development', 'Testing', 'Closure'],
        milestoneTypes: ['Project charter approved', 'Design sign-off', 'Go-live'],
        riskCategories: ['Technical', 'Resource', 'Schedule', 'Budget'],
      },
    },
    {
      name: 'Agile Product Development',
      methodology: 'AGILE' as const,
      industry: 'Technology',
      templateData: {
        iterationLength: 14,
        ceremonies: ['Iteration planning', 'Daily standup', 'Demo', 'Retrospective'],
        backlogFields: ['story_points', 'acceptance_criteria', 'business_value'],
      },
    },
    {
      name: 'Enterprise System Implementation',
      methodology: 'WATERFALL' as const,
      industry: 'IT',
      templateData: {
        phases: ['Initiation', 'Requirements', 'Design', 'Implementation', 'Testing', 'Go-Live', 'Post-Go-Live'],
        complianceChecks: ['GDPR', 'SOC2', 'ISO27001'],
        riskCategories: ['Technical', 'Regulatory', 'Scope', 'Data migration'],
      },
    },
  ]

  for (const tpl of templates) {
    await prisma.template.create({
      data: {
        workspaceId,
        createdById: userId,
        ...tpl,
      },
    }).catch(() => {})
  }
}
