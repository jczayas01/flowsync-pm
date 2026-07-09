const iso = (d: any) => (d instanceof Date ? d.toISOString() : d) || undefined
export const AUTO_ADMIN_ROLES = ["SUPER_ADMIN", "OWNER", "ADMIN"]
export const toView = (r: any) => ({
  id: r.id, name: r.name, trigger: r.trigger, condition: r.condition || "",
  action: r.action, isActive: r.isActive, runCount: r.runCount,
  lastRunAt: r.lastRunAt ? iso(r.lastRunAt) : undefined, createdAt: iso(r.createdAt),
})
