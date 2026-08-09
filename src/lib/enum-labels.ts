// src/lib/enum-labels.ts
//
// Database enum values, rendered for people.
//
// Values like EQUIPMENT, WATERFALL, ON_TRACK and ZERO_HUNDRED are stored in
// English because that is what the column holds, and until now they were also
// *shown* in English — with an underscore replaced by a space and a hopeful
// tone. In a product whose whole claim is that it works in Spanish end to end,
// a status badge reading "ON HOLD" next to a Spanish label is the seam showing.
//
// One map, one lookup, used wherever an enum reaches a screen. Anything not
// listed falls back to a readable version of the raw value rather than blowing
// up — a missing translation should look unpolished, never broken.

export const ENUM_ES: Record<string, string> = {
  // ── Project & task status ──
  ACTIVE: "Activo", ON_HOLD: "En pausa", COMPLETED: "Completado", CANCELLED: "Cancelado",
  ARCHIVED: "Archivado", DRAFT: "Borrador", PLANNING: "Planificación", IN_PROGRESS: "En progreso",
  TODO: "Por hacer", DONE: "Terminado", IN_REVIEW: "En revisión", BLOCKED: "Bloqueado",
  BACKLOG: "Pendiente", NOT_STARTED: "Sin iniciar",

  // ── Health ──
  ON_TRACK: "En curso", AT_RISK: "En riesgo", GREEN: "Verde", AMBER: "Ámbar", RED: "Rojo",
  DELAYED: "Retrasado",

  // ── Methodology ──
  WATERFALL: "Predictiva", AGILE: "Ágil", SCRUM: "Scrum", HYBRID: "Híbrida", KANBAN: "Kanban",

  // ── Priority & severity ──
  CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja",

  // ── Budget categories ──
  LABOR: "Mano de obra", EQUIPMENT: "Equipo", MATERIALS: "Materiales", SOFTWARE: "Software",
  SERVICES: "Servicios", CONSULTING: "Consultoría", TRAVEL: "Viajes", TRAINING: "Capacitación",
  CONTINGENCY: "Reserva de contingencia", OTHER: "Otro", HARDWARE: "Hardware",
  LICENSES: "Licencias", FACILITIES: "Instalaciones",

  // ── Earning rules ──
  EFFORT: "Por esfuerzo", ZERO_HUNDRED: "0/100 — al entregar", FIFTY_FIFTY: "50/50",
  MILESTONE: "Al lograr el hito",

  // ── Invoice status ──
  RECEIVED: "Recibida", APPROVED: "Aprobada", PAID: "Pagada", DISPUTED: "En disputa",

  // ── Procurement types ──
  CONTRACT: "Contrato", PURCHASE_ORDER: "Orden de compra", SOW: "SOW", MSA: "MSA", NDA: "NDA",

  // ── Risk ──
  IDENTIFIED: "Identificado", ASSESSED: "Evaluado", MITIGATED: "Mitigado", CLOSED: "Cerrado",
  OCCURRED: "Ocurrió", AVOID: "Evitar", MITIGATE: "Mitigar", TRANSFER: "Transferir",
  ACCEPT: "Aceptar", ESCALATE: "Escalar", EXPLOIT: "Explotar", ENHANCE: "Mejorar",
  SHARE: "Compartir", THREAT: "Amenaza", OPPORTUNITY: "Oportunidad",

  // ── Issues & change requests ──
  OPEN: "Abierta", RESOLVED: "Resuelta", SUBMITTED: "Enviada", UNDER_REVIEW: "En revisión",
  REJECTED: "Rechazada", IMPLEMENTED: "Implementada", SCOPE: "Alcance", SCHEDULE: "Cronograma",
  BUDGET: "Presupuesto", RESOURCE: "Recursos", QUALITY: "Calidad", TECHNICAL: "Técnica",
  EXTERNAL: "Externa",

  // ── Requirements ──
  FUNCTIONAL: "Funcional", NON_FUNCTIONAL: "No funcional", BUSINESS: "De negocio",
  REGULATORY: "Regulatorio", VERIFIED: "Verificado",

  // ── Roles ──
  OWNER: "Propietario", ADMIN: "Administrador", PM: "Gerente de proyecto",
  PROJECT_MANAGER: "Gerente de proyecto", PROGRAM_MANAGER: "Gerente de programa",
  PMO: "PMO", PMO_DIRECTOR: "Director de PMO", EXECUTIVE: "Ejecutivo",
  EXECUTIVE_SPONSOR: "Patrocinador ejecutivo", SPONSOR: "Patrocinador",
  STAKEHOLDER: "Interesado", TEAM_MEMBER: "Miembro del equipo", MEMBER: "Miembro",
  CLIENT: "Cliente", VIEWER: "Observador", AUDITOR: "Auditor",
  BUSINESS_ANALYST: "Analista de negocio", PRODUCT_OWNER: "Dueño de producto",
  SCRUM_MASTER: "Scrum Master", TECH_LEAD: "Líder técnico", TEAM: "Equipo",
  EXTERNAL_RESOURCE: "Recurso externo", STEERING_COMMITTEE: "Comité directivo",

  // ── Meetings ──
  KICKOFF: "Arranque", STATUS: "Estatus", PHASE_GATE: "Compuerta de fase",
  RISK_REVIEW: "Revisión de riesgos", STEERING: "Comité directivo",
  SPRINT_PLANNING: "Planificación de sprint", RETROSPECTIVE: "Retrospectiva",
  AD_HOC: "Ad hoc",

  // ── Frequency ──
  DAILY: "Diaria", WEEKLY: "Semanal", BIWEEKLY: "Quincenal", MONTHLY: "Mensual",
  QUARTERLY: "Trimestral", ANNUAL: "Anual", AS_NEEDED: "Según se necesite",

  // ── Benefits & lessons ──
  POSITIVE: "Positivo", NEGATIVE: "Negativo", FINANCIAL: "Financiero",
  OPERATIONAL: "Operativo", STRATEGIC: "Estratégico", CUSTOMER: "Cliente",
  REALIZED: "Realizado", PARTIAL: "Parcial", EXECUTION: "Ejecución",
  COMMUNICATION: "Comunicación", PROCUREMENT: "Adquisiciones",

  // ── Report tone & language ──
  PROFESSIONAL: "Profesional", CONCISE: "Conciso", DETAILED: "Detallado",
  FORMAL: "Formal", AUTO: "Automático", EN: "Inglés", ES: "Español",

  // ── Milestones ──
  UPCOMING: "Próximo", ACHIEVED: "Logrado", MISSED: "Incumplido",
}

/** Title-cased fallback: ON_HOLD → "On Hold". Never returns an empty label. */
function humanise(v: string): string {
  return String(v).replace(/_/g, " ").toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Label for a stored enum value in the reader's language.
 * @param value  the raw database value, e.g. "ZERO_HUNDRED"
 * @param locale "es" for Spanish; anything else gets the English fallback
 */
export function enumLabel(value: string | null | undefined, locale?: string): string {
  if (!value) return "—"
  const v = String(value)
  if (locale?.startsWith("es")) return ENUM_ES[v] || humanise(v)
  return humanise(v)
}
