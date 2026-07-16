// src/lib/doc-templates.ts
// ─────────────────────────────────────────────────────────────────────────────
// Blank PM document templates, generated on demand (never stored).
//
// Why generated, not static files: they stay in sync with the app, come out in
// the user's language, and add nothing to the repo.
//
// Six of these map to `ingestType` — the Governance tab can read them back and
// populate the project automatically. That's the loop: download → fill → upload.
//
// INDUSTRY NEUTRAL by design: no sector-specific content, no trademarked
// methodology names. "PM Standard" / industry-standard practice only.
// ─────────────────────────────────────────────────────────────────────────────

export type DocFormat = "docx" | "xlsx"
export type DocPhase  = "INITIATION" | "PLANNING" | "EXECUTION" | "CLOSING"

export interface DocTemplate {
  id: string
  name: string;        nameEs: string
  description: string; descriptionEs: string
  phase: DocPhase
  format: DocFormat
  icon: string
  /** Governance doc type this maps to — the AI can read the filled version back. */
  ingestType?: "TEAM_CHARTER" | "WBS" | "REQUIREMENTS" | "QUALITY_PLAN" | "MEETING_MINUTES" | "HANDOVER_PLAN"
}

export const DOC_TEMPLATES: DocTemplate[] = [
  // ── Initiation ──
  {
    id: "project-charter", icon: "📜", phase: "INITIATION", format: "docx", ingestType: "TEAM_CHARTER",
    name: "Project Charter", nameEs: "Acta de Constitución del Proyecto",
    description: "Authorizes the project: objective, scope, sponsor, budget, milestones, and success criteria.",
    descriptionEs: "Autoriza el proyecto: objetivo, alcance, patrocinador, presupuesto, hitos y criterios de éxito.",
  },
  {
    id: "stakeholder-register", icon: "👥", phase: "INITIATION", format: "xlsx",
    name: "Stakeholder Register", nameEs: "Registro de Interesados",
    description: "Who is affected, their influence and interest, and how you'll engage each of them.",
    descriptionEs: "Quién se ve afectado, su influencia e interés, y cómo se relacionará con cada uno.",
  },
  {
    id: "business-case", icon: "💼", phase: "INITIATION", format: "docx",
    name: "Business Case", nameEs: "Caso de Negocio",
    description: "The justification: problem, options considered, costs, benefits, and recommendation.",
    descriptionEs: "La justificación: problema, opciones evaluadas, costos, beneficios y recomendación.",
  },

  // ── Planning ──
  {
    id: "wbs", icon: "🗂", phase: "PLANNING", format: "xlsx", ingestType: "WBS",
    name: "Work Breakdown Structure", nameEs: "Estructura de Desglose del Trabajo (EDT)",
    description: "Decompose the scope into deliverables and work packages with owners and estimates.",
    descriptionEs: "Descompone el alcance en entregables y paquetes de trabajo con responsables y estimaciones.",
  },
  {
    id: "requirements", icon: "📋", phase: "PLANNING", format: "docx", ingestType: "REQUIREMENTS",
    name: "Requirements Document", nameEs: "Documento de Requisitos",
    description: "Functional and non-functional requirements with priority, source, and acceptance criteria.",
    descriptionEs: "Requisitos funcionales y no funcionales con prioridad, origen y criterios de aceptación.",
  },
  {
    id: "task-plan", icon: "📅", phase: "PLANNING", format: "xlsx",
    name: "Task & Schedule Plan", nameEs: "Plan de Tareas y Cronograma",
    description: "Task list with phases, dates, effort hours, and assignees — imports straight into a project.",
    descriptionEs: "Lista de tareas con fases, fechas, horas de esfuerzo y responsables — se importa directo a un proyecto.",
  },
  {
    id: "risk-register", icon: "⚠️", phase: "PLANNING", format: "xlsx",
    name: "Risk Register", nameEs: "Registro de Riesgos",
    description: "Identify risks with probability, impact, score, response strategy, and owner.",
    descriptionEs: "Identifica riesgos con probabilidad, impacto, puntuación, estrategia de respuesta y responsable.",
  },
  {
    id: "budget-plan", icon: "💰", phase: "PLANNING", format: "xlsx",
    name: "Budget Plan", nameEs: "Plan de Presupuesto",
    description: "Cost baseline by category with planned vs actual and variance tracking.",
    descriptionEs: "Línea base de costos por categoría con planificado vs. real y seguimiento de variación.",
  },
  {
    id: "quality-plan", icon: "✅", phase: "PLANNING", format: "docx", ingestType: "QUALITY_PLAN",
    name: "Quality Plan", nameEs: "Plan de Calidad",
    description: "Quality standards, metrics, review points, and acceptance process for deliverables.",
    descriptionEs: "Estándares de calidad, métricas, puntos de revisión y proceso de aceptación de entregables.",
  },
  {
    id: "comm-plan", icon: "📢", phase: "PLANNING", format: "xlsx",
    name: "Communication Plan", nameEs: "Plan de Comunicaciones",
    description: "Who needs what information, how often, in what format, and through which channel.",
    descriptionEs: "Quién necesita qué información, con qué frecuencia, en qué formato y por qué canal.",
  },

  // ── Execution & Monitoring ──
  {
    id: "status-report", icon: "📊", phase: "EXECUTION", format: "docx",
    name: "Status Report", nameEs: "Informe de Estado",
    description: "Period summary: health, progress, budget, risks, decisions needed, and next steps.",
    descriptionEs: "Resumen del período: salud, avance, presupuesto, riesgos, decisiones requeridas y próximos pasos.",
  },
  {
    id: "meeting-minutes", icon: "🗒", phase: "EXECUTION", format: "docx", ingestType: "MEETING_MINUTES",
    name: "Meeting Minutes", nameEs: "Minuta de Reunión",
    description: "Attendees, agenda, discussion, decisions made, and action items with owners and dates.",
    descriptionEs: "Asistentes, agenda, discusión, decisiones tomadas y acciones con responsables y fechas.",
  },
  {
    id: "change-request", icon: "🔄", phase: "EXECUTION", format: "docx",
    name: "Change Request Form", nameEs: "Formulario de Solicitud de Cambio",
    description: "Describe a proposed change, its impact on scope/schedule/cost, and route it for approval.",
    descriptionEs: "Describe un cambio propuesto, su impacto en alcance/cronograma/costo, y lo envía a aprobación.",
  },
  {
    id: "issue-log", icon: "🔥", phase: "EXECUTION", format: "xlsx",
    name: "Issue Log", nameEs: "Registro de Incidencias",
    description: "Track active problems with severity, owner, target date, and resolution.",
    descriptionEs: "Rastrea problemas activos con severidad, responsable, fecha objetivo y resolución.",
  },
  {
    id: "decision-log", icon: "⚖️", phase: "EXECUTION", format: "xlsx",
    name: "Decision Log", nameEs: "Registro de Decisiones",
    description: "Record decisions, who made them, alternatives considered, and the rationale.",
    descriptionEs: "Registra decisiones, quién las tomó, alternativas consideradas y la justificación.",
  },

  // ── Closing ──
  {
    id: "lessons-learned", icon: "💡", phase: "CLOSING", format: "docx",
    name: "Lessons Learned", nameEs: "Lecciones Aprendidas",
    description: "What worked, what didn't, and concrete recommendations for the next project.",
    descriptionEs: "Qué funcionó, qué no, y recomendaciones concretas para el próximo proyecto.",
  },
  {
    id: "handover-plan", icon: "🤝", phase: "CLOSING", format: "docx", ingestType: "HANDOVER_PLAN",
    name: "Handover Plan", nameEs: "Plan de Transferencia",
    description: "Transfer deliverables to operations: owners, documentation, training, and support model.",
    descriptionEs: "Transfiere entregables a operaciones: responsables, documentación, capacitación y modelo de soporte.",
  },
  {
    id: "closure-report", icon: "🏁", phase: "CLOSING", format: "docx",
    name: "Project Closure Report", nameEs: "Informe de Cierre del Proyecto",
    description: "Final performance against baseline, benefits realized, and formal sign-off.",
    descriptionEs: "Desempeño final contra la línea base, beneficios realizados y aprobación formal.",
  },
]

export const PHASE_LABELS: Record<DocPhase, { en: string; es: string; icon: string }> = {
  INITIATION: { en: "Initiation", es: "Inicio",        icon: "🚀" },
  PLANNING:   { en: "Planning",   es: "Planificación", icon: "📐" },
  EXECUTION:  { en: "Execution & Monitoring", es: "Ejecución y Seguimiento", icon: "⚙️" },
  CLOSING:    { en: "Closing",    es: "Cierre",        icon: "🏁" },
}

export const getDocTemplate = (id: string) => DOC_TEMPLATES.find(t => t.id === id)
