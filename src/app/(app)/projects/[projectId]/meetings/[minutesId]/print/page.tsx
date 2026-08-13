// src/app/(app)/projects/[projectId]/meetings/[minutesId]/print/page.tsx
// Printable meeting minutes — browser print-to-PDF, same pattern as the
// contract invoice. Access mirrors the meetings page (signed-in member of a
// workspace) plus a check that the minute belongs to the requested project.
// Local ES/EN dictionary via ?lang so the document wording is fixed.
export const dynamic = "force-dynamic"

import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { LogoMark } from "@/components/shared/Logo"
import { PrintActions } from "@/components/shared/PrintActions"

const STRINGS = {
  es: {
    doc: "MINUTA DE REUNIÓN", project: "Proyecto", code: "Código", type: "Tipo",
    date: "Fecha", location: "Lugar", facilitator: "Facilitador", status: "Estatus",
    attendees: "Asistentes", agenda: "Agenda", discussion: "Discusión",
    decisions: "Decisiones", actions: "Acciones acordadas",
    action: "Acción", owner: "Responsable", due: "Fecha límite",
    next: "Próxima reunión", nextAgenda: "Agenda propuesta",
    preparedBy: "Preparada por", approvedBy: "Aprobada por",
    types: { KICKOFF: "Kickoff", STATUS: "Estatus", PHASE_GATE: "Compuerta de fase",
      RISK_REVIEW: "Revisión de riesgos", STEERING: "Comité directivo",
      SPRINT_PLANNING: "Planificación de sprint", RETROSPECTIVE: "Retrospectiva",
      AD_HOC: "Ad hoc", OTHER: "Otra" } as Record<string, string>,
    statuses: { DRAFT: "BORRADOR", FINAL: "FINAL", APPROVED: "APROBADA" } as Record<string, string>,
  },
  en: {
    doc: "MEETING MINUTES", project: "Project", code: "Code", type: "Type",
    date: "Date", location: "Location", facilitator: "Facilitator", status: "Status",
    attendees: "Attendees", agenda: "Agenda", discussion: "Discussion",
    decisions: "Decisions", actions: "Action items",
    action: "Action", owner: "Owner", due: "Due date",
    next: "Next meeting", nextAgenda: "Proposed agenda",
    preparedBy: "Prepared by", approvedBy: "Approved by",
    types: { KICKOFF: "Kickoff", STATUS: "Status", PHASE_GATE: "Phase gate",
      RISK_REVIEW: "Risk review", STEERING: "Steering committee",
      SPRINT_PLANNING: "Sprint planning", RETROSPECTIVE: "Retrospective",
      AD_HOC: "Ad hoc", OTHER: "Other" } as Record<string, string>,
    statuses: { DRAFT: "DRAFT", FINAL: "FINAL", APPROVED: "APPROVED" } as Record<string, string>,
  },
} as const

// Same normalization as MeetingsTab: fields may be a plain string or a JSON
// array of objects ({name,role} | {decision,owner} | {action,owner,dueDate}).
function toList(v: any): string[] {
  if (v == null) return []
  if (typeof v === "string") return v.split("\n").map(x => x.trim()).filter(Boolean)
  if (Array.isArray(v)) {
    return v.map((item: any) => {
      if (item == null) return ""
      if (typeof item === "string") return item
      if (typeof item === "object") {
        if (item.name)     return item.role ? `${item.name} (${item.role})` : item.name
        if (item.decision) return item.owner ? `${item.decision} — ${item.owner}` : item.decision
        if (item.action)   return item.owner
          ? `${item.action} — ${item.owner}${item.dueDate ? ` (${item.dueDate})` : ""}`
          : item.action
        return Object.values(item).filter(Boolean).join(" — ")
      }
      return String(item)
    }).filter(Boolean)
  }
  if (typeof v === "object") return [Object.values(v).filter(Boolean).join(" — ")]
  return [String(v)]
}

function actionRows(v: any): { action: string; owner: string; due: string }[] {
  if (Array.isArray(v)) {
    const objs = v.filter((i: any) => i && typeof i === "object" && i.action)
    if (objs.length) return objs.map((i: any) => ({
      action: String(i.action), owner: i.owner ? String(i.owner) : "—",
      due: i.dueDate ? String(i.dueDate) : "—",
    }))
  }
  return toList(v).map(t => ({ action: t, owner: "—", due: "—" }))
}

function fmtDate(d: Date | null | undefined, lang: "es" | "en") {
  if (!d) return "—"
  return new Date(d).toLocaleDateString(lang === "es" ? "es-PR" : "en-US",
    { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}

export default async function MinutesPrintPage({ params, searchParams }: {
  params: { projectId: string; minutesId: string }
  searchParams?: { lang?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId: true },
  })
  if (!membership) redirect("/dashboard")

  const m = await db.meetingMinutes.findFirst({
    where: { id: params.minutesId, projectId: params.projectId },
    include: {
      project:    { select: { name: true, code: true } },
      createdBy:  { select: { name: true, email: true } },
      approvedBy: { select: { name: true, email: true } },
    },
  }) as any
  if (!m) notFound()

  const lang: "es" | "en" = searchParams?.lang === "en" ? "en" : "es"
  const t = STRINGS[lang]

  const attendees = toList(m.attendees)
  const decisions = toList(m.decisions)
  const actions   = actionRows(m.actionItems)

  const ink = "#0D1B2A", faint = "#64748B", border = "#E2E8F0"
  const secH: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: ink,
    textTransform: "uppercase", letterSpacing: ".06em", margin: "22px 0 8px",
    paddingBottom: 4, borderBottom: `2px solid ${ink}` }
  const body: React.CSSProperties = { fontSize: 12.5, lineHeight: 1.6, color: ink,
    whiteSpace: "pre-wrap" }
  const th: React.CSSProperties = { textAlign: "left", padding: "6px 10px", fontSize: 10.5,
    textTransform: "uppercase", letterSpacing: ".05em", color: faint,
    borderBottom: `1.5px solid ${ink}` }
  const td: React.CSSProperties = { padding: "7px 10px", fontSize: 12.5,
    borderBottom: `1px solid ${border}`, verticalAlign: "top" }

  return (
    <div style={{ background: "#F1F5F9", minHeight: "100vh", padding: "24px 0",
      fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", color: ink }}>
      <style>{`
        @media print {
          body { background: #fff !important; }
          .fs-inv-chrome { display: none !important; }
          .fs-inv-page { box-shadow: none !important; margin: 0 !important;
            border: none !important; width: auto !important; }
        }
        @page { size: letter; margin: 14mm; }
      `}</style>

      <PrintActions lang={lang} />

      <div className="fs-inv-page" style={{ position: "relative", width: 760, margin: "0 auto",
        background: "#fff", border: `1px solid ${border}`, borderRadius: 8,
        boxShadow: "0 8px 28px rgba(13,27,42,.10)", padding: "44px 48px" }}>

        {m.status === "DRAFT" && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
            pointerEvents: "none" }}>
            <div style={{ fontSize: 92, fontWeight: 800, color: "rgba(220,38,38,.07)",
              transform: "rotate(-24deg)", letterSpacing: ".1em" }}>
              {t.statuses.DRAFT}
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <LogoMark size={40} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-.01em" }}>
                FlowSync <span style={{ color: "#F59E0B" }}>PM</span>
              </div>
              <div style={{ fontSize: 11, color: faint }}>flowsyncpm.com</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: ".04em" }}>{t.doc}</div>
            <div style={{ fontSize: 12.5, color: faint, marginTop: 2 }}>{m.code}</div>
          </div>
        </div>

        {/* Title */}
        <div style={{ fontSize: 16.5, fontWeight: 700, marginTop: 26, lineHeight: 1.35 }}>
          {m.title}
        </div>
        <div style={{ fontSize: 12.5, color: faint, marginTop: 3 }}>
          {t.project}: {m.project?.code ? `${m.project.code} — ` : ""}{m.project?.name || "—"}
        </div>

        {/* Meta grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          marginTop: 18, border: `1px solid ${border}`, borderRadius: 6, overflow: "hidden" }}>
          {[[t.date, fmtDate(m.meetingDate, lang)],
            [t.type, t.types[m.meetingType] || m.meetingType],
            [t.status, t.statuses[m.status] || m.status],
            [t.location, m.location || "—"],
            [t.facilitator, m.facilitator || "—"],
            [t.preparedBy, m.createdBy?.name || m.createdBy?.email || "—"],
          ].map(([k, v], i) => (
            <div key={i} style={{ padding: "8px 12px", background: "#F8FAFC",
              borderLeft: i % 3 ? `1px solid ${border}` : "none",
              borderTop: i >= 3 ? `1px solid ${border}` : "none" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: faint,
                textTransform: "uppercase", letterSpacing: ".05em" }}>{k}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Attendees */}
        {attendees.length > 0 && (<>
          <div style={secH}>{t.attendees} ({attendees.length})</div>
          <div style={{ ...body, columns: attendees.length > 6 ? 2 : 1, columnGap: 32 }}>
            {attendees.map((a, i) => (
              <div key={i} style={{ breakInside: "avoid", padding: "1.5px 0" }}>• {a}</div>
            ))}
          </div>
        </>)}

        {/* Agenda */}
        {m.agenda && (<>
          <div style={secH}>{t.agenda}</div>
          <div style={body}>{m.agenda}</div>
        </>)}

        {/* Discussion */}
        {m.discussion && (<>
          <div style={secH}>{t.discussion}</div>
          <div style={body}>{m.discussion}</div>
        </>)}

        {/* Decisions */}
        {decisions.length > 0 && (<>
          <div style={secH}>{t.decisions}</div>
          <div style={body}>
            {decisions.map((d, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "2.5px 0" }}>
                <span style={{ color: "#F59E0B", fontWeight: 700 }}>{i + 1}.</span>
                <span>{d}</span>
              </div>
            ))}
          </div>
        </>)}

        {/* Action items */}
        {actions.length > 0 && (<>
          <div style={secH}>{t.actions}</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...th, width: 24 }}>#</th>
              <th style={th}>{t.action}</th>
              <th style={{ ...th, width: 150 }}>{t.owner}</th>
              <th style={{ ...th, width: 110 }}>{t.due}</th>
            </tr></thead>
            <tbody>
              {actions.map((a, i) => (
                <tr key={i}>
                  <td style={{ ...td, color: faint }}>{i + 1}</td>
                  <td style={td}>{a.action}</td>
                  <td style={td}>{a.owner}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{a.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>)}

        {/* Next meeting */}
        {(m.nextMeeting || m.nextAgenda) && (<>
          <div style={secH}>{t.next}</div>
          <div style={body}>
            {m.nextMeeting && <div>{fmtDate(m.nextMeeting, lang)}</div>}
            {m.nextAgenda && (
              <div style={{ marginTop: 4, color: faint }}>
                {t.nextAgenda}: {m.nextAgenda}
              </div>
            )}
          </div>
        </>)}

        {/* Sign-off */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40,
          marginTop: 40, paddingTop: 18, borderTop: `1px solid ${border}` }}>
          <div>
            <div style={{ borderBottom: `1px solid ${ink}`, height: 34 }} />
            <div style={{ fontSize: 11, color: faint, marginTop: 5 }}>
              {t.preparedBy}: {m.createdBy?.name || m.createdBy?.email || ""}
            </div>
          </div>
          <div>
            <div style={{ borderBottom: `1px solid ${ink}`, height: 34 }} />
            <div style={{ fontSize: 11, color: faint, marginTop: 5 }}>
              {t.approvedBy}: {m.approvedBy?.name || m.approvedBy?.email || "______________"}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
