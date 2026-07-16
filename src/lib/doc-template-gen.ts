// src/lib/doc-template-gen.ts
// Builders for the blank templates in doc-templates.ts.
// docx for forms, exceljs for registers. Everything is bilingual and neutral —
// no sector-specific content, no trademarked methodology names.

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, WidthType, AlignmentType, ShadingType, BorderStyle,
} from "docx"
import ExcelJS from "exceljs"
import { getDocTemplate, type DocTemplate } from "./doc-templates"

const NAVY = "0D1B2A", STEEL = "1B6CA8", SLATE = "64748B", LIGHT = "F1F5F9"

type L = "en" | "es"
const pick = (l: L, en: string, es: string) => (l === "es" ? es : en)

// ── docx helpers ─────────────────────────────────────────────────────────────
const R = (t: string, o: any = {}) =>
  new TextRun({ text: t, size: o.size || 20, bold: o.bold, italics: o.italics, color: o.color })
const P = (t: any, o: any = {}) =>
  new Paragraph({
    children: Array.isArray(t) ? t : [R(t, o)],
    spacing: { after: o.after ?? 120, before: o.before ?? 0 },
    alignment: o.align,
  })
const H = (t: string) =>
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [R(t, { color: STEEL, bold: true })],
    spacing: { before: 260, after: 120 } })

function fieldTable(rows: [string, string][], widths: [number, number] = [2600, 6400]) {
  return new Table({
    width: { size: widths[0] + widths[1], type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map(([label, hint]) => new TableRow({ children: [
      new TableCell({
        width: { size: widths[0], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: LIGHT },
        margins: { top: 80, bottom: 80, left: 110, right: 110 },
        children: [P(label, { bold: true, size: 19 })],
      }),
      new TableCell({
        width: { size: widths[1], type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 110, right: 110 },
        children: [P(hint, { italics: true, color: SLATE, size: 18 })],
      }),
    ]})),
  })
}

function gridTable(headers: string[], hint: string[], widths: number[]) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: NAVY },
        margins: { top: 70, bottom: 70, left: 100, right: 100 },
        children: [P(h, { bold: true, size: 17, color: "FFFFFF" })],
      })) }),
      new TableRow({ children: hint.map((h, i) => new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        margins: { top: 70, bottom: 70, left: 100, right: 100 },
        children: [P(h, { italics: true, color: SLATE, size: 16 })],
      })) }),
      ...Array.from({ length: 4 }, () => new TableRow({ children: widths.map(w => new TableCell({
        width: { size: w, type: WidthType.DXA },
        margins: { top: 90, bottom: 90, left: 100, right: 100 },
        children: [P("")],
      })) })),
    ],
  })
}

function docHeader(t: DocTemplate, l: L) {
  const out: any[] = [
    new Paragraph({ spacing: { after: 40 }, children: [R(pick(l, t.name, t.nameEs), { size: 36, bold: true, color: NAVY })] }),
    P(pick(l, t.description, t.descriptionEs), { color: SLATE, size: 19, after: 160 }),
  ]
  if (t.ingestType) {
    out.push(new Paragraph({
      spacing: { after: 200 },
      shading: { type: ShadingType.CLEAR, fill: "EFF6FF" },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: STEEL } },
      children: [R(pick(l,
        "  🤖 AI-readable — fill this in, then upload it under the project's Governance tab. FlowSync will read it and populate your project automatically.",
        "  🤖 Legible por IA — complétalo y súbelo en la pestaña Gobernanza del proyecto. FlowSync lo leerá y llenará tu proyecto automáticamente."),
        { size: 17, color: "1E40AF" })],
    }))
  }
  out.push(fieldTable([
    [pick(l, "Project", "Proyecto"), ""],
    [pick(l, "Prepared by", "Preparado por"), ""],
    [pick(l, "Date", "Fecha"), ""],
    [pick(l, "Version", "Versión"), ""],
  ]))
  return out
}

// ── Word bodies, per template ────────────────────────────────────────────────
function docBody(id: string, l: L): any[] {
  const c: any[] = []
  const g = (en: string, es: string) => P(pick(l, en, es), { italics: true, color: SLATE, size: 18 })
  const blank = (n = 3) => Array.from({ length: n }, () => P(""))

  switch (id) {
    case "project-charter":
      c.push(H(pick(l, "1. Purpose & Objective", "1. Propósito y Objetivo")),
        g("What business problem does this project solve? State the objective in one or two sentences.",
          "¿Qué problema de negocio resuelve este proyecto? Indica el objetivo en una o dos frases."), ...blank(),
        H(pick(l, "2. Scope", "2. Alcance")),
        g("In scope — what this project will deliver.", "En alcance — lo que este proyecto entregará."), ...blank(2),
        g("Out of scope — explicitly excluded.", "Fuera de alcance — explícitamente excluido."), ...blank(2),
        H(pick(l, "3. Governance", "3. Gobernanza")),
        fieldTable([
          [pick(l, "Sponsor", "Patrocinador"), pick(l, "Owns the business case; approves the project", "Dueño del caso de negocio; aprueba el proyecto")],
          [pick(l, "Project Manager", "Gerente de Proyecto"), pick(l, "Runs delivery day to day", "Dirige la ejecución día a día")],
          [pick(l, "Key stakeholders", "Interesados clave"), ""],
          [pick(l, "Methodology", "Metodología"), pick(l, "Predictive / Agile / Hybrid", "Predictiva / Ágil / Híbrida")],
        ]),
        H(pick(l, "4. Budget & Timeline", "4. Presupuesto y Cronograma")),
        fieldTable([
          [pick(l, "Total budget", "Presupuesto total"), ""],
          [pick(l, "Start date", "Fecha de inicio"), ""],
          [pick(l, "Target end date", "Fecha objetivo de fin"), ""],
        ]),
        H(pick(l, "5. Phases & Milestones", "5. Fases e Hitos")),
        gridTable(
          [pick(l, "Phase", "Fase"), pick(l, "Key deliverable", "Entregable clave"), pick(l, "Target date", "Fecha objetivo")],
          [pick(l, "e.g. Discovery", "ej. Descubrimiento"), pick(l, "What completes it", "Qué la completa"), "yyyy-mm-dd"],
          [2600, 4400, 2000]),
        H(pick(l, "6. Success Criteria", "6. Criterios de Éxito")),
        g("How will you know this project succeeded? Make each one measurable.",
          "¿Cómo sabrás que el proyecto tuvo éxito? Haz cada criterio medible."), ...blank(),
        H(pick(l, "7. Key Risks", "7. Riesgos Principales")),
        gridTable(
          [pick(l, "Risk", "Riesgo"), pick(l, "Impact", "Impacto"), pick(l, "Response", "Respuesta")],
          [pick(l, "What could go wrong", "Qué podría salir mal"), pick(l, "Low/Medium/High", "Bajo/Medio/Alto"), pick(l, "How you'll handle it", "Cómo lo manejarás")],
          [4000, 1800, 3200]),
        H(pick(l, "8. Approval", "8. Aprobación")),
        fieldTable([
          [pick(l, "Sponsor signature", "Firma del patrocinador"), ""],
          [pick(l, "Date", "Fecha"), ""],
        ]))
      break

    case "business-case":
      c.push(H(pick(l, "1. Problem Statement", "1. Planteamiento del Problema")),
        g("What is happening today that needs to change, and what does it cost to do nothing?",
          "¿Qué ocurre hoy que debe cambiar, y cuánto cuesta no hacer nada?"), ...blank(),
        H(pick(l, "2. Options Considered", "2. Opciones Evaluadas")),
        gridTable(
          [pick(l, "Option", "Opción"), pick(l, "Pros", "Ventajas"), pick(l, "Cons", "Desventajas"), pick(l, "Est. cost", "Costo est.")],
          [pick(l, "Incl. 'do nothing'", "Incl. 'no hacer nada'"), "", "", ""],
          [2200, 2800, 2800, 1400]),
        H(pick(l, "3. Expected Benefits", "3. Beneficios Esperados")),
        gridTable(
          [pick(l, "Benefit", "Beneficio"), pick(l, "Measure", "Medida"), pick(l, "When realized", "Cuándo se realiza")],
          [pick(l, "Cost saving, revenue, efficiency…", "Ahorro, ingreso, eficiencia…"), pick(l, "e.g. $50K/yr", "ej. $50K/año"), ""],
          [3600, 3000, 2400]),
        H(pick(l, "4. Costs", "4. Costos")), ...blank(2),
        H(pick(l, "5. Recommendation", "5. Recomendación")), ...blank(2))
      break

    case "requirements":
      c.push(H(pick(l, "1. Overview", "1. Resumen")),
        g("Summarize what is being built or changed, and for whom.",
          "Resume qué se construye o cambia, y para quién."), ...blank(2),
        H(pick(l, "2. Functional Requirements", "2. Requisitos Funcionales")),
        g("What the solution must DO. One row per requirement — keep each atomic and testable.",
          "Lo que la solución debe HACER. Una fila por requisito — mantén cada uno atómico y verificable."),
        gridTable(
          ["ID", pick(l, "Requirement", "Requisito"), pick(l, "Priority", "Prioridad"), pick(l, "Acceptance criteria", "Criterio de aceptación")],
          ["REQ-001", pick(l, "The system shall…", "El sistema deberá…"), pick(l, "Must/Should/Could", "Debe/Debería/Podría"), pick(l, "How you'll verify it", "Cómo se verificará")],
          [1100, 3600, 1500, 3000]),
        H(pick(l, "3. Non-Functional Requirements", "3. Requisitos No Funcionales")),
        g("How the solution must BEHAVE — performance, security, availability, usability, compliance.",
          "Cómo debe COMPORTARSE — desempeño, seguridad, disponibilidad, usabilidad, cumplimiento."),
        gridTable(
          ["ID", pick(l, "Category", "Categoría"), pick(l, "Requirement", "Requisito"), pick(l, "Target", "Objetivo")],
          ["NFR-001", pick(l, "Performance", "Desempeño"), "", pick(l, "Measurable threshold", "Umbral medible")],
          [1100, 2000, 4100, 2000]),
        H(pick(l, "4. Assumptions & Constraints", "4. Supuestos y Restricciones")), ...blank(2))
      break

    case "quality-plan":
      c.push(H(pick(l, "1. Quality Objectives", "1. Objetivos de Calidad")),
        g("What 'good' means for this project's deliverables.",
          "Qué significa 'bueno' para los entregables de este proyecto."), ...blank(2),
        H(pick(l, "2. Standards Applied", "2. Estándares Aplicados")), ...blank(2),
        H(pick(l, "3. Quality Metrics", "3. Métricas de Calidad")),
        gridTable(
          [pick(l, "Metric", "Métrica"), pick(l, "Target", "Objetivo"), pick(l, "How measured", "Cómo se mide"), pick(l, "Frequency", "Frecuencia")],
          ["", "", "", pick(l, "Weekly / per release", "Semanal / por entrega")],
          [2600, 1800, 3000, 1800]),
        H(pick(l, "4. Review & Approval Points", "4. Puntos de Revisión y Aprobación")),
        gridTable(
          [pick(l, "Deliverable", "Entregable"), pick(l, "Reviewer", "Revisor"), pick(l, "Criteria", "Criterios")],
          ["", "", pick(l, "What must be true to pass", "Qué debe cumplirse para aprobar")],
          [3000, 2400, 3800]),
        H(pick(l, "5. Defect Management", "5. Gestión de Defectos")),
        g("How defects are logged, triaged, prioritized, and verified as fixed.",
          "Cómo se registran, clasifican, priorizan y verifican los defectos."), ...blank(2))
      break

    case "status-report":
      c.push(H(pick(l, "1. Overall Health", "1. Salud General")),
        fieldTable([
          [pick(l, "Status", "Estado"), pick(l, "On track / At risk / Off track", "En curso / En riesgo / Desviado")],
          [pick(l, "Reporting period", "Período del informe"), ""],
          [pick(l, "% Complete", "% Completado"), ""],
        ]),
        H(pick(l, "2. Accomplished This Period", "2. Logrado en Este Período")), ...blank(),
        H(pick(l, "3. Planned Next Period", "3. Planificado para el Próximo Período")), ...blank(),
        H(pick(l, "4. Schedule & Budget", "4. Cronograma y Presupuesto")),
        gridTable(
          [pick(l, "Measure", "Medida"), pick(l, "Baseline", "Línea base"), pick(l, "Actual", "Real"), pick(l, "Variance", "Variación")],
          [pick(l, "Cost / Schedule", "Costo / Cronograma"), "", "", ""],
          [2600, 2000, 2000, 2400]),
        H(pick(l, "5. Risks & Issues", "5. Riesgos e Incidencias")),
        gridTable(
          [pick(l, "Item", "Elemento"), pick(l, "Impact", "Impacto"), pick(l, "Action", "Acción"), pick(l, "Owner", "Responsable")],
          ["", "", "", ""],
          [3200, 1800, 2800, 1200]),
        H(pick(l, "6. Decisions Needed", "6. Decisiones Requeridas")),
        g("What you need from leadership, by when, and what happens if it slips.",
          "Qué necesitas de la dirección, para cuándo, y qué pasa si se retrasa."), ...blank(2))
      break

    case "meeting-minutes":
      c.push(fieldTable([
          [pick(l, "Meeting title", "Título de la reunión"), ""],
          [pick(l, "Date & time", "Fecha y hora"), ""],
          [pick(l, "Location", "Lugar"), ""],
          [pick(l, "Facilitator", "Facilitador"), ""],
          [pick(l, "Attendees", "Asistentes"), pick(l, "Comma-separated", "Separados por comas")],
        ]),
        H(pick(l, "1. Agenda", "1. Agenda")), ...blank(2),
        H(pick(l, "2. Discussion", "2. Discusión")), ...blank(3),
        H(pick(l, "3. Decisions Made", "3. Decisiones Tomadas")),
        gridTable(
          [pick(l, "Decision", "Decisión"), pick(l, "Made by", "Tomada por"), pick(l, "Rationale", "Justificación")],
          ["", "", ""],
          [3600, 1800, 3600]),
        H(pick(l, "4. Action Items", "4. Acciones")),
        gridTable(
          [pick(l, "Action", "Acción"), pick(l, "Owner", "Responsable"), pick(l, "Due date", "Fecha límite")],
          ["", "", "yyyy-mm-dd"],
          [4800, 2200, 2000]),
        H(pick(l, "5. Next Meeting", "5. Próxima Reunión")), ...blank(1))
      break

    case "change-request":
      c.push(fieldTable([
          [pick(l, "Change request #", "Solicitud de cambio #"), ""],
          [pick(l, "Requested by", "Solicitado por"), ""],
          [pick(l, "Date raised", "Fecha de solicitud"), ""],
          [pick(l, "Priority", "Prioridad"), pick(l, "Low / Medium / High / Critical", "Baja / Media / Alta / Crítica")],
        ]),
        H(pick(l, "1. Description of Change", "1. Descripción del Cambio")), ...blank(2),
        H(pick(l, "2. Reason / Justification", "2. Razón / Justificación")), ...blank(2),
        H(pick(l, "3. Impact Analysis", "3. Análisis de Impacto")),
        fieldTable([
          [pick(l, "Scope impact", "Impacto en alcance"), ""],
          [pick(l, "Schedule impact", "Impacto en cronograma"), pick(l, "Days added/removed", "Días añadidos/eliminados")],
          [pick(l, "Cost impact", "Impacto en costo"), ""],
          [pick(l, "Risk impact", "Impacto en riesgos"), ""],
          [pick(l, "If rejected", "Si se rechaza"), pick(l, "Consequence of not doing it", "Consecuencia de no hacerlo")],
        ]),
        H(pick(l, "4. Decision", "4. Decisión")),
        fieldTable([
          [pick(l, "Approved / Rejected", "Aprobado / Rechazado"), ""],
          [pick(l, "Approver", "Aprobador"), ""],
          [pick(l, "Date", "Fecha"), ""],
          [pick(l, "Comments", "Comentarios"), ""],
        ]))
      break

    case "lessons-learned":
      c.push(H(pick(l, "1. Project Summary", "1. Resumen del Proyecto")), ...blank(2),
        H(pick(l, "2. What Went Well", "2. Qué Funcionó Bien")),
        g("Practices worth repeating. Be specific — 'good communication' helps nobody.",
          "Prácticas que vale la pena repetir. Sé específico — 'buena comunicación' no ayuda a nadie."),
        gridTable(
          [pick(l, "Situation", "Situación"), pick(l, "What we did", "Qué hicimos"), pick(l, "Recommendation", "Recomendación")],
          ["", "", pick(l, "Do this again when…", "Repetir esto cuando…")],
          [2800, 3000, 3200]),
        H(pick(l, "3. What Didn't", "3. Qué No Funcionó")),
        gridTable(
          [pick(l, "Situation", "Situación"), pick(l, "Impact", "Impacto"), pick(l, "Recommendation", "Recomendación")],
          ["", "", pick(l, "Next time, instead…", "La próxima vez, en su lugar…")],
          [2800, 3000, 3200]),
        H(pick(l, "4. Top 3 Takeaways", "4. Tres Conclusiones Clave")), ...blank(3))
      break

    case "handover-plan":
      c.push(H(pick(l, "1. Scope of Handover", "1. Alcance de la Transferencia")),
        g("What is being handed over, from whom, to whom, and when.",
          "Qué se transfiere, de quién, a quién y cuándo."), ...blank(2),
        H(pick(l, "2. Deliverables & Owners", "2. Entregables y Responsables")),
        gridTable(
          [pick(l, "Deliverable", "Entregable"), pick(l, "Handed to", "Transferido a"), pick(l, "Date", "Fecha"), pick(l, "Accepted", "Aceptado")],
          ["", "", "yyyy-mm-dd", pick(l, "Y/N", "S/N")],
          [3400, 2600, 1600, 1400]),
        H(pick(l, "3. Documentation Provided", "3. Documentación Entregada")), ...blank(2),
        H(pick(l, "4. Training & Knowledge Transfer", "4. Capacitación y Transferencia de Conocimiento")),
        gridTable(
          [pick(l, "Audience", "Audiencia"), pick(l, "Topic", "Tema"), pick(l, "Delivered by", "Impartido por"), pick(l, "Date", "Fecha")],
          ["", "", "", ""],
          [2400, 3000, 2200, 1400]),
        H(pick(l, "5. Support Model", "5. Modelo de Soporte")),
        fieldTable([
          [pick(l, "Support owner", "Responsable de soporte"), ""],
          [pick(l, "Escalation path", "Ruta de escalamiento"), ""],
          [pick(l, "Warranty period", "Período de garantía"), ""],
        ]),
        H(pick(l, "6. Outstanding Items", "6. Pendientes")), ...blank(2))
      break

    case "closure-report":
      c.push(H(pick(l, "1. Objectives vs Outcome", "1. Objetivos vs. Resultado")),
        g("Did the project deliver what the charter promised?",
          "¿El proyecto entregó lo que prometía el acta de constitución?"), ...blank(2),
        H(pick(l, "2. Performance Against Baseline", "2. Desempeño vs. Línea Base")),
        gridTable(
          [pick(l, "Measure", "Medida"), pick(l, "Baseline", "Línea base"), pick(l, "Actual", "Real"), pick(l, "Variance", "Variación")],
          [pick(l, "Cost", "Costo"), "", "", ""],
          [2600, 2000, 2000, 2400]),
        H(pick(l, "3. Benefits Realized", "3. Beneficios Realizados")),
        gridTable(
          [pick(l, "Benefit", "Beneficio"), pick(l, "Target", "Objetivo"), pick(l, "Actual", "Real"), pick(l, "Status", "Estado")],
          ["", "", "", pick(l, "Realized / Partial / Missed", "Realizado / Parcial / No logrado")],
          [3200, 1800, 1800, 2200]),
        H(pick(l, "4. Outstanding Items", "4. Pendientes")), ...blank(2),
        H(pick(l, "5. Formal Sign-off", "5. Aprobación Formal")),
        fieldTable([
          [pick(l, "Sponsor", "Patrocinador"), ""],
          [pick(l, "Date", "Fecha"), ""],
          [pick(l, "Comments", "Comentarios"), ""],
        ]))
      break

    default:
      c.push(P(""))
  }
  return c
}

export async function buildDocx(id: string, l: L): Promise<Buffer> {
  const t = getDocTemplate(id)!
  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri" } } } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
      children: [
        ...docHeader(t, l),
        ...docBody(id, l),
        new Paragraph({ spacing: { before: 400 },
          children: [R(pick(l,
            "Template provided by FlowSync PM · flowsyncpm.com · Aligned with industry-standard PM practice",
            "Plantilla provista por FlowSync PM · flowsyncpm.com · Alineada con prácticas estándar de gestión de proyectos"),
            { size: 15, color: SLATE, italics: true })] }),
      ],
    }],
  })
  return Buffer.from(await Packer.toBuffer(doc))
}

// ── Excel registers ──────────────────────────────────────────────────────────
interface SheetSpec { cols: { header: string; key: string; width: number }[]; sample: any[]; note: string }

function sheetSpec(id: string, l: L): SheetSpec {
  const p = (en: string, es: string) => pick(l, en, es)
  switch (id) {
    case "stakeholder-register":
      return {
        note: p("Map everyone affected by the project. Influence × Interest tells you how to engage them.",
                "Mapea a todos los afectados por el proyecto. Influencia × Interés indica cómo relacionarte."),
        cols: [
          { header: p("Name","Nombre"), key:"n", width:24 },
          { header: p("Role / Title","Rol / Cargo"), key:"r", width:24 },
          { header: p("Organization","Organización"), key:"o", width:22 },
          { header: p("Influence (H/M/L)","Influencia (A/M/B)"), key:"i", width:16 },
          { header: p("Interest (H/M/L)","Interés (A/M/B)"), key:"t", width:16 },
          { header: p("Engagement strategy","Estrategia de relación"), key:"e", width:40 },
          { header: p("Contact","Contacto"), key:"c", width:26 },
        ],
        sample: [{ n:p("Jane Doe","Juana Pérez"), r:p("Operations Director","Directora de Operaciones"),
                   o:p("Client","Cliente"), i:p("High","Alta"), t:p("High","Alto"),
                   e:p("Manage closely — weekly 1:1","Gestionar de cerca — 1:1 semanal"), c:"jane@example.com" }],
      }
    case "wbs":
      return {
        note: p("Decompose scope top-down. Level 1 = phases, Level 2 = deliverables, Level 3 = work packages.",
                "Descompón el alcance de arriba hacia abajo. Nivel 1 = fases, Nivel 2 = entregables, Nivel 3 = paquetes de trabajo."),
        cols: [
          { header: p("WBS Code","Código EDT"), key:"c", width:14 },
          { header: p("Level","Nivel"), key:"l", width:10 },
          { header: p("Deliverable / Work package","Entregable / Paquete de trabajo"), key:"d", width:46 },
          { header: p("Description","Descripción"), key:"desc", width:44 },
          { header: p("Owner","Responsable"), key:"o", width:20 },
          { header: p("Est. hours","Horas est."), key:"h", width:12 },
        ],
        sample: [
          { c:"1",   l:1, d:p("Discovery","Descubrimiento"), desc:p("Understand the current state","Entender el estado actual"), o:"", h:"" },
          { c:"1.1", l:2, d:p("Stakeholder interviews","Entrevistas a interesados"), desc:"", o:"", h:16 },
        ],
      }
    case "task-plan":
      return {
        note: p("Fill this in and import it from Projects → Import from plan. Hours feed the workload engine.",
                "Complétalo e impórtalo desde Proyectos → Importar desde plan. Las horas alimentan el motor de carga."),
        cols: [
          { header: p("Task name","Nombre de tarea"), key:"t", width:44 },
          { header: p("Phase","Fase"), key:"p", width:22 },
          { header: p("Start (yyyy-mm-dd)","Inicio (aaaa-mm-dd)"), key:"s", width:18 },
          { header: p("Finish (yyyy-mm-dd)","Fin (aaaa-mm-dd)"), key:"f", width:18 },
          { header: p("Hours","Horas"), key:"h", width:10 },
          { header: p("Priority","Prioridad"), key:"pr", width:14 },
          { header: p("Assignee","Responsable"), key:"a", width:24 },
        ],
        sample: [{ t:p("Draft requirements","Redactar requisitos"), p:p("Planning","Planificación"),
                   s:"2026-08-03", f:"2026-08-14", h:24, pr:p("High","Alta"), a:"" }],
      }
    case "risk-register":
      return {
        note: p("Score = Probability × Impact (1–5 each). Anything scoring 15+ needs an owner and a response now.",
                "Puntuación = Probabilidad × Impacto (1–5 cada uno). Todo lo que llegue a 15+ necesita responsable y respuesta ya."),
        cols: [
          { header:"ID", key:"id", width:10 },
          { header: p("Risk description","Descripción del riesgo"), key:"d", width:46 },
          { header: p("Category","Categoría"), key:"c", width:18 },
          { header: p("Probability (1-5)","Probabilidad (1-5)"), key:"p", width:16 },
          { header: p("Impact (1-5)","Impacto (1-5)"), key:"i", width:14 },
          { header: p("Score","Puntuación"), key:"s", width:10 },
          { header: p("Response strategy","Estrategia de respuesta"), key:"r", width:22 },
          { header: p("Mitigation plan","Plan de mitigación"), key:"m", width:44 },
          { header: p("Owner","Responsable"), key:"o", width:20 },
        ],
        sample: [{ id:"RISK-001", d:p("Key resource unavailable during peak phase","Recurso clave no disponible en fase pico"),
                   c:p("Resource","Recurso"), p:3, i:4, s:12, r:p("Mitigate","Mitigar"),
                   m:p("Identify and cross-train a backup by month 2","Identificar y capacitar un respaldo para el mes 2"), o:"" }],
      }
    case "budget-plan":
      return {
        note: p("Categories match FlowSync's budget tab, so this imports cleanly. Variance = Planned − Actual.",
                "Las categorías coinciden con la pestaña de presupuesto de FlowSync. Variación = Planificado − Real."),
        cols: [
          { header: p("Category","Categoría"), key:"c", width:22 },
          { header: p("Line item","Partida"), key:"l", width:42 },
          { header: p("Planned cost","Costo planificado"), key:"p", width:18 },
          { header: p("Actual cost","Costo real"), key:"a", width:18 },
          { header: p("Variance","Variación"), key:"v", width:14 },
          { header: p("Notes","Notas"), key:"n", width:34 },
        ],
        sample: [{ c:p("LABOR","MANO DE OBRA"), l:p("Delivery team — 6 months","Equipo de entrega — 6 meses"), p:120000, a:0, v:120000, n:"" }],
      }
    case "comm-plan":
      return {
        note: p("Every stakeholder group should appear at least once. If a row has no owner, it won't happen.",
                "Cada grupo de interesados debe aparecer al menos una vez. Si una fila no tiene responsable, no ocurrirá."),
        cols: [
          { header: p("Audience","Audiencia"), key:"a", width:26 },
          { header: p("Information needed","Información requerida"), key:"i", width:42 },
          { header: p("Frequency","Frecuencia"), key:"f", width:18 },
          { header: p("Format","Formato"), key:"fo", width:20 },
          { header: p("Channel","Canal"), key:"c", width:20 },
          { header: p("Owner","Responsable"), key:"o", width:20 },
        ],
        sample: [{ a:p("Executive sponsor","Patrocinador ejecutivo"), i:p("Health, budget, key risks","Salud, presupuesto, riesgos clave"),
                   f:p("Monthly","Mensual"), fo:p("Executive deck","Presentación ejecutiva"), c:p("Steering meeting","Comité de dirección"), o:"" }],
      }
    case "issue-log":
      return {
        note: p("An issue is a problem happening NOW. A risk is one that might happen. Don't mix them.",
                "Una incidencia es un problema que ocurre AHORA. Un riesgo es uno que podría ocurrir. No los mezcles."),
        cols: [
          { header:"ID", key:"id", width:10 },
          { header: p("Issue description","Descripción de la incidencia"), key:"d", width:48 },
          { header: p("Raised by","Reportado por"), key:"r", width:20 },
          { header: p("Date raised","Fecha de reporte"), key:"dr", width:16 },
          { header: p("Severity","Severidad"), key:"s", width:14 },
          { header: p("Owner","Responsable"), key:"o", width:20 },
          { header: p("Target date","Fecha objetivo"), key:"t", width:16 },
          { header: p("Status","Estado"), key:"st", width:14 },
          { header: p("Resolution","Resolución"), key:"res", width:44 },
        ],
        sample: [{ id:"ISS-001", d:"", r:"", dr:"2026-08-03", s:p("High","Alta"), o:"", t:"", st:p("Open","Abierta"), res:"" }],
      }
    case "decision-log":
      return {
        note: p("Record the rationale, not just the decision. In six months nobody remembers why.",
                "Registra la justificación, no solo la decisión. En seis meses nadie recordará por qué."),
        cols: [
          { header:"ID", key:"id", width:10 },
          { header: p("Decision","Decisión"), key:"d", width:44 },
          { header: p("Date","Fecha"), key:"dt", width:14 },
          { header: p("Made by","Tomada por"), key:"m", width:22 },
          { header: p("Alternatives considered","Alternativas consideradas"), key:"a", width:40 },
          { header: p("Rationale","Justificación"), key:"r", width:44 },
          { header: p("Impact","Impacto"), key:"i", width:26 },
        ],
        sample: [{ id:"DEC-001", d:"", dt:"2026-08-03", m:"", a:"", r:"", i:"" }],
      }
    default:
      return { note:"", cols:[{ header:"", key:"a", width:20 }], sample:[] }
  }
}

export async function buildXlsx(id: string, l: L): Promise<Buffer> {
  const t = getDocTemplate(id)!
  const spec = sheetSpec(id, l)
  const wb = new ExcelJS.Workbook()
  wb.creator = "FlowSync PM"
  wb.created = new Date()

  const ws = wb.addWorksheet(pick(l, t.name, t.nameEs).slice(0, 30))

  // Title + guidance rows
  ws.mergeCells(1, 1, 1, spec.cols.length)
  const title = ws.getCell(1, 1)
  title.value = pick(l, t.name, t.nameEs)
  title.font = { size: 15, bold: true, color: { argb: "FF0D1B2A" } }
  ws.getRow(1).height = 24

  ws.mergeCells(2, 1, 2, spec.cols.length)
  const note = ws.getCell(2, 1)
  note.value = spec.note
  note.font = { size: 10, italic: true, color: { argb: "FF64748B" } }
  note.alignment = { wrapText: true, vertical: "middle" }
  ws.getRow(2).height = 30

  // Header row at 4
  ws.getRow(3).height = 6
  const header = ws.getRow(4)
  spec.cols.forEach((c, i) => {
    const cell = header.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D1B2A" } }
    cell.alignment = { vertical: "middle", wrapText: true }
    cell.border = { bottom: { style: "thin", color: { argb: "FF1B6CA8" } } }
    ws.getColumn(i + 1).width = c.width
  })
  header.height = 26

  // Sample rows (greyed — meant to be overwritten)
  spec.sample.forEach(row => {
    const r = ws.addRow(spec.cols.map(c => row[c.key] ?? ""))
    r.font = { italic: true, color: { argb: "FF94A3B8" }, size: 10 }
  })

  // Blank rows ready to fill
  for (let i = 0; i < 40; i++) ws.addRow(spec.cols.map(() => ""))

  ws.views = [{ state: "frozen", ySplit: 4 }]
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: spec.cols.length } }

  return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer)
}

export async function buildTemplate(id: string, locale: L): Promise<{ buf: Buffer; filename: string; mime: string }> {
  const t = getDocTemplate(id)
  if (!t) throw new Error("Unknown template")
  const base = (locale === "es" ? t.nameEs : t.name).replace(/[^\w\s-]/g, "").replace(/\s+/g, "_")
  if (t.format === "xlsx") {
    return {
      buf: await buildXlsx(id, locale),
      filename: `${base}.xlsx`,
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
  }
  return {
    buf: await buildDocx(id, locale),
    filename: `${base}.docx`,
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }
}
