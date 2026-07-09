import { createHash } from "crypto"
export const KEY_ADMIN_ROLES = ["SUPER_ADMIN", "OWNER", "ADMIN"]
export const sha = (s: string) => createHash("sha256").update(s).digest("hex")
export const toView = (k: any) => ({
  id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes,
  isActive: !k.revokedAt,
  createdAt: (k.createdAt instanceof Date ? k.createdAt.toISOString() : k.createdAt),
})
