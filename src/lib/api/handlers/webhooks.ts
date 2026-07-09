const iso = (d: any) => (d instanceof Date ? d.toISOString() : d) || undefined
export const WH_ADMIN_ROLES = ["SUPER_ADMIN", "OWNER", "ADMIN"]
export const toView = (w: any, includeSecret = false) => ({
  id: w.id, url: w.url, events: w.events, isActive: w.isActive,
  secret: includeSecret ? w.secret : undefined,
  createdAt: iso(w.createdAt),
  lastTriggeredAt: w.lastTriggeredAt ? iso(w.lastTriggeredAt) : undefined,
  successCount: w.successCount, errorCount: w.errorCount,
})
