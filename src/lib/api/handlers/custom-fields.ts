export const CF_ADMIN_ROLES = ["SUPER_ADMIN", "OWNER", "ADMIN"]
export const toView = (f: any) => ({
  id: f.id, name: f.name, type: f.fieldType, entity: f.entityType,
  required: f.required, options: Array.isArray(f.options) ? f.options : (f.options || []),
  description: f.description || undefined, isActive: f.isActive,
})
