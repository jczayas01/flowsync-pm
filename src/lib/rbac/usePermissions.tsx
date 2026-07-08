"use client"
// src/lib/rbac/usePermissions.tsx
// Client-side permission gating. Feed it the current user's workspace role
// (once, at the app shell) and any component can ask `can("some:permission")`.

import { createContext, useContext, useMemo } from "react"
import {
  can as rbacCan,
  mapDbRoleToRbac,
  ROLE_LEVEL,
  ROLE_LABELS,
  type AnyRole,
  type Permission,
} from "./roles"

interface PermissionsValue {
  role:  AnyRole            // resolved RBAC role
  label: string            // human label
  level: number
  can:   (p: Permission) => boolean
  canAny:(...p: Permission[]) => boolean
  isReadOnly: boolean      // no editing permissions at all
}

const PermissionsContext = createContext<PermissionsValue | null>(null)

export function PermissionsProvider({ role, children }: { role: string; children: React.ReactNode }) {
  const value = useMemo<PermissionsValue>(() => {
    const rbac = mapDbRoleToRbac(role)
    const can  = (p: Permission) => rbacCan(rbac, p)
    const editPerms: Permission[] = [
      "projects:edit","projects:create","tasks:create","tasks:edit_any",
      "tasks:edit_assigned","budget:edit","risks:create","changes:create",
    ]
    return {
      role:  rbac,
      label: ROLE_LABELS[rbac] || rbac,
      level: ROLE_LEVEL[rbac] ?? 0,
      can,
      canAny: (...ps: Permission[]) => ps.some(can),
      isReadOnly: !editPerms.some(can),
    }
  }, [role])

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions(): PermissionsValue {
  const ctx = useContext(PermissionsContext)
  // Safe fallback if a component renders outside the provider — least privilege.
  if (!ctx) {
    return {
      role: "READ_ONLY", label: "Read-Only User", level: 10,
      can: () => false, canAny: () => false, isReadOnly: true,
    }
  }
  return ctx
}

// Small convenience gate: <Can permission="risks:create">…</Can>
export function Can({ permission, any, children, fallback = null }: {
  permission?: Permission
  any?: Permission[]
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const p = usePermissions()
  const ok = any ? p.canAny(...any) : permission ? p.can(permission) : true
  return <>{ok ? children : fallback}</>
}
