// src/lib/landing-es.ts
//
// Spanish copy for the marketing landing, keyed by the English source string.
// Two rules behind this file:
//
//  1. One component, two languages. The Spanish page renders the same landing
//     as English — same hero motion, same live S-curve, same Gantt — because a
//     separate "Spanish page" always ends up looking like the cheap cousin.
//  2. Written, not translated. This is Mexican/LatAm PM vocabulary
//     ("administración de proyectos", "cronograma", "ejercido"), and the jokes
//     and rhythm are rebuilt in Spanish rather than carried across word for word.
//
// Anything missing here falls back to English rather than breaking the page.

export const LANDING_ES: Record<string, string> = {
  // ── Nav ──
  "How it works": "Cómo funciona",
  "Who it's for": "Para quién es",
  "Features": "Funciones",
  "Pricing": "Precios",
  "FAQ": "Preguntas",
  "Request a demo": "Solicitar demo",
  "Sign in": "Iniciar sesión",
  "Start free": "Empezar gratis",
  "Español": "English",

  // ── Hero ──
  "Launch offer · 2 months free — limited time": "Oferta de lanzamiento · 2 meses gratis — tiempo limitado",
  "Your plan is already written.": "Tu plan ya está escrito.",
  "Turn it into a live project.": "Conviértelo en un proyecto vivo.",
  "FlowSync PM reads the project document you already have — Word, Excel, PDF — and builds the whole thing: phases, tasks, dates, risks, budget. Then it keeps it governed, with EVM, phase gates and reporting your sponsor will actually read.":
    "FlowSync PM lee el documento de proyecto que ya tienes — Word, Excel, PDF — y construye todo: fases, tareas, fechas, riesgos y presupuesto. Después lo mantiene bajo control, con valor ganado, compuertas de fase y reportes que tu patrocinador sí va a leer.",
  "Start 2-month free trial →": "Comenzar prueba de 2 meses →",
  "Free for two months · No credit card required · English and Español":
    "Dos meses gratis · Sin tarjeta de crédito · Español e inglés",

  // ── Live artifacts in the hero ──
  "ERP Rollout — Phase 2": "Implementación ERP — Fase 2",
  "RISK-001 · scored 15": "R-001 · puntaje 15",
  "EARNED VALUE — LIVE": "VALOR GANADO — EN VIVO",
  "WEEKLY STATUS — PRJ-006": "ESTATUS SEMANAL — PRJ-006",
  "Drafted by AI · Reviewed by you": "Redactado por IA · Revisado por ti",

  // ── Section headings ──
  "One document in. A governed project out.": "Entra un documento. Sale un proyecto gobernado.",
  "It works in reverse too.": "También funciona al revés.",
  "The depth a PMO needs, without the enterprise tax":
    "La profundidad que una PMO necesita, sin el impuesto empresarial",
  "Everything below ships today. No roadmap promises, no \"coming soon\" badges.":
    "Todo lo de abajo ya existe hoy. Sin promesas de roadmap ni etiquetas de «próximamente».",
  "Three people, one source of truth": "Tres personas, una sola fuente de verdad",
  "Pay for the people who drive the work": "Paga por quienes mueven el trabajo",
  "A PMO with 3 managers and 40 contributors": "Una PMO con 3 gerentes y 40 colaboradores",
  "The three who run projects are paid seats. The other forty — team members, stakeholders, clients, executives —":
    "Los tres que dirigen proyectos ocupan asientos pagados. Los otros cuarenta — equipo, interesados, clientes, ejecutivos —",
  "Every other tool charges full price for the person who logs in twice a month to look at a chart. We don't.":
    "Las demás herramientas cobran precio completo por quien entra dos veces al mes a ver una gráfica. Nosotros no.",
  "Enterprise-grade from day one": "Nivel empresarial desde el primer día",
  "Running a portfolio, or a regulated program?": "¿Manejas un portafolio o un programa regulado?",
  "Custom pricing, directory sync and advanced SSO, white-labeling, a Data Processing Agreement, custom terms — a":
    "Precio a medida, sincronización de directorio y SSO avanzado, marca blanca, acuerdo de tratamiento de datos, términos personalizados — una",
  "Questions worth answering": "Preguntas que vale la pena responder",
  "Bring a real plan. See it running.": "Trae un plan real. Míralo funcionando.",
  "Two months free, the whole product. The fastest way to judge this is to upload a project document you already":
    "Dos meses gratis, el producto completo. La forma más rápida de juzgarlo es subir un documento de proyecto que ya",
  "No credit card required. Two months of the full product, then subscribe only if it earned it.":
    "Sin tarjeta de crédito. Dos meses del producto completo, y te suscribes solo si se lo ganó.",

  // ── What the AI extracts ──
  "Phases & milestones": "Fases e hitos",
  "Every phase, its dates, and the milestone that closes it.":
    "Cada fase, sus fechas y el hito que la cierra.",
  "Tasks with dates & effort": "Tareas con fechas y esfuerzo",
  "Names, start and finish, estimated hours, dependencies, owners.":
    "Nombres, inicio y fin, horas estimadas, dependencias y responsables.",
  "Risks, scored": "Riesgos evaluados",
  "Probability × impact, response strategy, and who owns it.":
    "Probabilidad × impacto, estrategia de respuesta y quién lo atiende.",
  "Budget lines": "Líneas de presupuesto",
  "Cost categories and planned amounts, ready for EVM.":
    "Categorías de costo y montos planificados, listos para valor ganado.",
  "Requirements": "Requisitos",
  "Functional and non-functional, with acceptance criteria.":
    "Funcionales y no funcionales, con criterios de aceptación.",
  "Governance documents": "Documentos de gobernanza",
  "Charter, WBS dictionary, quality plan, minutes, handover.":
    "Acta, diccionario EDT, plan de calidad, minutas y entrega.",

  // ── Audiences ──
  "PMO directors": "Directores de PMO",
  "You need every project on one view, held to one standard.":
    "Necesitas todos los proyectos en una vista, bajo un mismo estándar.",
  "Portfolio and program hierarchy": "Jerarquía de portafolio y programas",
  "Phase gates that actually gate": "Compuertas de fase que de verdad detienen",
  "Governance artifacts in one repository": "Documentos de gobernanza en un solo repositorio",
  "Standards enforced, not suggested": "Estándares aplicados, no sugeridos",
  "Project managers": "Gerentes de proyecto",
  "You need the plan to stay true without living in a spreadsheet.":
    "Necesitas que el plan siga siendo cierto sin vivir dentro de una hoja de cálculo.",
  "Executive sponsors": "Patrocinadores ejecutivos",

  // ── Features ──
  "Interactive Gantt + critical path": "Gantt interactivo + ruta crítica",
  "Drag-and-drop scheduling with FS/SS/FF dependencies, baseline overlays, and critical path highlighting. Export to PDF or share a live link.":
    "Reprogramación arrastrando, dependencias FS/SS/FF, líneas base superpuestas y ruta crítica resaltada. Exporta a PDF o comparte un enlace en vivo.",
  "Budget tracking with EVM": "Presupuesto con valor ganado",
  "Planned value, earned value, CPI, SPI, EAC and VAC calculated from your task data. No spreadsheet required.":
    "Valor planificado, valor ganado, CPI, SPI, EAC y VAC calculados desde tus tareas. Sin hojas de cálculo.",
  "AI status reports": "Reportes de estatus con IA",
  "One click produces a weekly status report — accomplishments, risks, milestones, budget — drafted by AI, reviewed by you.":
    "Un clic produce el reporte semanal — logros, riesgos, hitos, presupuesto — redactado por IA y revisado por ti.",
  "Document template library": "Biblioteca de plantillas",
  "Charter, WBS, risk register, minutes, handover and more, in Word and Excel. Fill one in, upload it, and it populates the project.":
    "Acta, EDT, registro de riesgos, minutas, entrega y más, en Word y Excel. Llena una, súbela, y el proyecto se puebla solo.",
  "Roles, permissions and audit": "Roles, permisos y auditoría",
  "Granular role levels, two-factor auth, Microsoft and Google SSO, and a full audit log ready for a compliance review.":
    "Niveles de rol granulares, doble factor, SSO con Microsoft y Google, y bitácora completa lista para una revisión de cumplimiento.",
  "Bilingual, end to end": "Bilingüe de punta a punta",
  "Every screen, every report, every generated document works in English and Spanish. Switch language without losing your place.":
    "Cada pantalla, cada reporte y cada documento generado funciona en español e inglés. Cambia de idioma sin perder dónde ibas.",

  // ── Plans ──
  "Trial": "Prueba",
  "Starter": "Starter",
  "Business": "Business",
  "Enterprise": "Enterprise",
  "Two months free, the whole product.": "Dos meses gratis, el producto completo.",
  "Launch offer, limited time: two full months free. No card required. Subscribe any time during the trial — you keep every remaining free day.":
    "Oferta de lanzamiento, tiempo limitado: dos meses completos gratis. Sin tarjeta. Suscríbete cuando quieras durante la prueba — conservas cada día gratis que te quede.",
  "Everything unlocked": "Todo desbloqueado",
  "Unlimited projects": "Proyectos ilimitados",
  "AI document import": "Importación de documentos con IA",
  "Bilingual EN / ES": "Bilingüe ES / EN",
  "Start free trial": "Empezar prueba gratis",
  "Most popular": "Más popular",
  "Launch offer · Limited time": "Oferta de lanzamiento · Tiempo limitado",
  "Flat per user. For small teams and independent PMs.":
    "Tarifa plana por usuario. Para equipos pequeños y gerentes independientes.",
  "Paid seats for the roles that drive the work. Everyone else: $20/mo per 10.":
    "Asientos pagados para quienes mueven el trabajo. Los demás: $20/mes por cada 10.",
  "Directory sync, white-label, DPA, personal onboarding.":
    "Sincronización de directorio, marca blanca, DPA y acompañamiento personal.",
  "Contact sales": "Hablar con ventas",
}
