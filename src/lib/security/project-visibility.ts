// src/lib/security/project-visibility.ts
// WHO CAN SEE WHICH PROJECTS — single source of truth for pages and APIs.
// Mirrors the RBAC matrix in src/lib/rbac/roles.ts, expressed over DB roles:
//
//   SUPER_ADMIN / OWNER / ADMIN  → all projects (incl. confidential)
//   PMO_DIRECTOR / EXECUTIVE     → all projects (incl. confidential; EXECUTIVE read-only)
//   PROGRAM_MANAGER              → projects they're a member/creator of, PLUS
//                                  projects in programs where they are the manager
//   PM / MEMBER / VIEWER / CLIENT→ only projects they created or are a member of
//
// Confidential projects: for non view-all roles, membership is the only door.

export const PROJECT_VIEW_ALL_ROLES = [
  "SUPER_ADMIN", "OWNER", "ADMIN", "PMO_DIRECTOR", "EXECUTIVE",
] as const

// Workspace roles that may edit any project they can see (matrix: projects:edit).
export const PROJECT_EDIT_ANY_ROLES = [
  "SUPER_ADMIN", "OWNER", "ADMIN", "PMO_DIRECTOR",
] as const

export function canViewAllProjects(role?: string | null): boolean {
  return PROJECT_VIEW_ALL_ROLES.includes((role || "") as any)
}

/**
 * Prisma `where` fragment limiting projects to what this user may see.
 * Returns {} for view-all roles. Spread it into a workspace-scoped query:
 *   db.project.findMany({ where: { workspaceId, ...projectVisibilityWhere(uid, role) } })
 */
export function projectVisibilityWhere(userId: string, role?: string | null): object {
  if (canViewAllProjects(role)) return {}
  const doors: object[] = [
    { createdById: userId },
    { members: { some: { userId } } },
  ]
  if (role === "PROGRAM_MANAGER") {
    doors.push({ program: { managerId: userId } })
  }
  return { OR: doors }
}
