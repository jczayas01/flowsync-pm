// src/app/(app)/layout.tsx
// Authenticated app layout — sidebar + topbar
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { AppShell } from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  // Resolve active workspace
  const membership = await db.workspaceMember.findFirst({
    where:   { userId: session.user.id },
    include: { workspace: true },
    orderBy: { joinedAt: 'asc' },
  })
  if (!membership) redirect('/onboarding')

  // All workspaces for switcher
  const allMemberships = await db.workspaceMember.findMany({
    where:   { userId: session.user.id },
    include: { workspace: { select: { id:true, name:true, logoUrl:true, plan:true } } },
    orderBy: { joinedAt: 'asc' },
  })

  return (
    <AppShell
      user={{
        id:        session.user.id,
        name:      session.user.name || '',
        email:     session.user.email || '',
        avatarUrl: session.user.image || undefined,
      }}
      workspace={membership.workspace}
      workspaces={allMemberships.map(m => m.workspace)}
      userRole={membership.role}
      isPlatformAdmin={
        (process.env.PLATFORM_ADMIN_EMAILS || "")
          .split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
          .includes((session.user.email || "").toLowerCase())
      }
    >
      {children}
    </AppShell>
  )
}
