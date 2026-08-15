// src/app/(print)/print/contracts/[contractId]/agreement/page.tsx
// Printable Enterprise Agreement for a CustomerContract.
//
// Structure = Master Subscription Agreement (legal body, mirrors the MSA in the
// sales kit) + Exhibit A: Commercial Terms (generated from the contract record)
// + Exhibit B: Service Levels + Exhibit C: Onboarding milestones + signatures.
//
// Local ES/EN dictionary via ?lang. Every generated figure comes from
// contractMath — the same math as Calculate and the invoices, so the signed
// paper and the bill can never disagree.
//
// DRAFT until reviewed by counsel: the header carries an explicit review
// notice; the platform admin removes it in the sales-kit MSA once approved.
export const dynamic = "force-dynamic"

import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { LogoMark } from "@/components/shared/Logo"
import { PrintActions } from "@/components/shared/PrintActions"
import { contractMath } from "@/lib/contract-math"

function platformAdmins(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
}

const T = {
  es: {
    title: "ACUERDO EMPRESARIAL DE SUSCRIPCIÓN", sub: "Master Subscription Agreement",
    draftNotice: "BORRADOR PARA REVISIÓN LEGAL — no ejecutar hasta aprobación de asesor legal",
    parties: "Partes", provider: "Proveedor", customer: "Cliente",
    providerLine: "FLOW SYNC PM, Registro de Comerciante Núm. 1552654-0010, NAICS 54151, Puerto Rico, EE. UU. (\u201Cel Proveedor\u201D)",
    customerLine: (n: string) => `${n} (\u201Cel Cliente\u201D)`,
    effective: "Fecha de vigencia", term: "Vigencia", renewal: "Decisión de renovación",
    autoRenew: "Renovación automática", yes: "Sí", no: "No",
    s: [
      ["1. Objeto", "El Proveedor concede al Cliente una licencia no exclusiva e intransferible para acceder y usar la plataforma FlowSync PM (\u201Cel Servicio\u201D) durante la Vigencia, conforme a este Acuerdo y sus Anexos."],
      ["2. Derechos contratados", "Las sillas, paquetes de colaboradores, tope de OCR, servicio profesional y demás derechos se detallan en el Anexo A. Con este Acuerdo activo, el Anexo A prevalece sobre cualquier plan de autoservicio."],
      ["3. Precio y facturación", "El Cliente pagará las cantidades del Anexo A según el ciclo de facturación indicado. Las facturas se emiten por adelantado al inicio de cada período y son pagaderas NET-30 desde su fecha, en USD, mediante ACH o transferencia. Los cargos por servicio profesional se facturan por trabajo registrado y aprobado, con los descuentos del Anexo A. Los cargos vencidos devengan 1.5% mensual o el máximo legal, lo que sea menor."],
      ["4. Uso aceptable", "El Cliente usará el Servicio conforme a la ley aplicable y las Políticas de Servicio del Proveedor, y es responsable de las credenciales y actividad de sus usuarios. El Cliente no realizará ingeniería inversa, reventa ni acceso automatizado no autorizado."],
      ["5. Datos del Cliente", "El Cliente conserva todo derecho sobre sus datos. El Proveedor los trata únicamente para prestar el Servicio, según el Anexo de Procesamiento de Datos (DPA) cuando esté suscrito, con cifrado en tránsito y en reposo, control de acceso por roles y registros de auditoría."],
      ["6. Subprocesadores y procesamiento con IA", "El Cliente autoriza a los subprocesadores listados en la Información Comercial y de Seguridad (Anthropic, Vercel, Supabase/AWS, Stripe, Zoho). Las funciones de IA son asistivas con revisión humana; los datos del Cliente no se usan para entrenar modelos; el Cliente puede desactivar toda la IA de su workspace (aplicación del lado del servidor, con registro de auditoría)."],
      ["7. Niveles de servicio", "El Proveedor prestará soporte según el Anexo B. Los créditos por incumplimiento de disponibilidad, cuando apliquen, se acuerdan en el Anexo B y son el único remedio por dicho incumplimiento."],
      ["8. Confidencialidad", "Cada parte protegerá la información confidencial de la otra con al menos el cuidado razonable, y la usará solo para cumplir este Acuerdo, durante la Vigencia y tres (3) años después."],
      ["9. Propiedad intelectual", "El Proveedor conserva todos los derechos sobre el Servicio y sus mejoras. Las sugerencias del Cliente pueden usarse sin obligación. Ningún derecho se cede salvo la licencia de la cláusula 1."],
      ["10. Garantías y exclusiones", "El Proveedor garantiza que el Servicio funcionará sustancialmente conforme a su documentación. SALVO LO EXPRESAMENTE INDICADO, EL SERVICIO SE PRESTA \u201CTAL CUAL\u201D SIN OTRAS GARANTÍAS, EXPRESAS O IMPLÍCITAS."],
      ["11. Limitación de responsabilidad", "NINGUNA PARTE RESPONDERÁ POR DAÑOS INDIRECTOS, INCIDENTALES O CONSECUENTES. LA RESPONSABILIDAD TOTAL DE CADA PARTE NO EXCEDERÁ LAS CANTIDADES PAGADAS POR EL CLIENTE EN LOS DOCE (12) MESES ANTERIORES AL EVENTO. Estas limitaciones no aplican a incumplimientos de confidencialidad, indemnización ni pagos debidos."],
      ["12. Vigencia y terminación", "Este Acuerdo rige durante la Vigencia y se renueva según lo indicado arriba, salvo aviso escrito con al menos treinta (30) días antes de la Fecha de decisión de renovación. Cualquier parte puede terminar por incumplimiento material no subsanado en treinta (30) días tras aviso. Al terminar, el Cliente puede exportar sus datos por treinta (30) días; después el Proveedor los eliminará conforme a las Políticas de Servicio."],
      ["13. Ley aplicable y disputas", "Este Acuerdo se rige por las leyes del Estado Libre Asociado de Puerto Rico. Las partes intentarán resolver disputas de buena fe en treinta (30) días antes de acudir a los tribunales de San Juan, Puerto Rico, a cuya jurisdicción se someten."],
      ["14. Disposiciones generales", "Este Acuerdo con sus Anexos constituye el acuerdo íntegro y sustituye toda propuesta previa. Las modificaciones requieren firma de ambas partes. Si una cláusula resulta inválida, el resto subsiste. Ninguna parte podrá ceder el Acuerdo sin consentimiento, salvo a un sucesor de todo su negocio. Las notificaciones se harán por escrito a los contactos designados."],
    ],
    exA: "ANEXO A — Términos comerciales", exB: "ANEXO B — Niveles de servicio",
    exC: "ANEXO C — Hitos de implementación", sign: "FIRMAS",
    item: "Concepto", qty: "Cant.", unit: "Precio unitario", period: "Período", amount: "Importe",
    seats: "Sillas pagadas", bundles: "Paquetes de colaboradores (×10)", ocr: "Paquetes OCR adicionales (+200 pág./mes; primer paquete incluido)",
    retainer: (h: number) => `Retainer de servicio (${h} h/mes)`, svcRate: "Tarifa de servicio profesional",
    subDisc: "Descuento de suscripción", onbDisc: "Descuento de onboarding", svcDisc: "Descuento de servicio",
    firstFree: "Primer paquete de servicio incluido en onboarding", onboarding: "Onboarding (cargo único)",
    perMo: "/mes", perYr: "anual", oneTime: "único", perHr: "/hora",
    subtotalRec: "Suscripción anualizada", totalYear1: "TOTAL PRIMER AÑO", totalRenewal: "Total renovación anual",
    ocrCap: "Tope OCR", pages: "páginas/mes",
    tier: "Nivel de soporte", response: "Primera respuesta", uptime: "Compromiso de disponibilidad",
    slaNotes: "Notas de SLA", hours: "horas", none: "—",
    milestone: "Hito", due: "Fecha", ms_amount: "Importe",
    noMs: "Sin hitos definidos — la implementación se factura como cargo único de onboarding.",
    forProvider: "Por el Proveedor — FLOW SYNC PM", forCustomer: "Por el Cliente",
    name: "Nombre", titleL: "Cargo", date: "Fecha", signature: "Firma",
    notes: "Notas del contrato",
    footer: "Documento generado desde el registro del contrato — los importes son los mismos que facturan Calculate y las facturas del sistema.",
  },
  en: {
    title: "ENTERPRISE SUBSCRIPTION AGREEMENT", sub: "Master Subscription Agreement",
    draftNotice: "DRAFT FOR LEGAL REVIEW — do not execute until approved by counsel",
    parties: "Parties", provider: "Provider", customer: "Customer",
    providerLine: "FLOW SYNC PM, Merchant Registration No. 1552654-0010, NAICS 54151, Puerto Rico, USA (\u201CProvider\u201D)",
    customerLine: (n: string) => `${n} (\u201CCustomer\u201D)`,
    effective: "Effective date", term: "Term", renewal: "Renewal decision date",
    autoRenew: "Auto-renewal", yes: "Yes", no: "No",
    s: [
      ["1. Subject", "Provider grants Customer a non-exclusive, non-transferable license to access and use the FlowSync PM platform (the \u201CService\u201D) during the Term, under this Agreement and its Exhibits."],
      ["2. Entitlements", "Seats, contributor bundles, OCR cap, professional services and all other entitlements are detailed in Exhibit A. While this Agreement is active, Exhibit A prevails over any self-service plan."],
      ["3. Fees and billing", "Customer will pay the amounts in Exhibit A per the stated billing cycle. Invoices are issued in advance at the start of each period and are due NET-30 from invoice date, in USD, by ACH or wire. Professional-service charges are invoiced from recorded, approved work with the discounts in Exhibit A. Overdue amounts accrue 1.5% per month or the legal maximum, whichever is lower."],
      ["4. Acceptable use", "Customer will use the Service in compliance with applicable law and Provider's Service Policies, and is responsible for its users' credentials and activity. Customer will not reverse-engineer, resell, or perform unauthorized automated access."],
      ["5. Customer Data", "Customer retains all rights in its data. Provider processes it solely to deliver the Service, under the Data Processing Addendum (DPA) when executed, with encryption in transit and at rest, role-based access control, and audit logs."],
      ["6. Sub-processors and AI processing", "Customer authorizes the sub-processors listed in the Business Information & Security document (Anthropic, Vercel, Supabase/AWS, Stripe, Zoho). AI features are assistive with human review; Customer Data is not used to train models; Customer may disable all AI for its workspace (server-side enforcement, audit-logged)."],
      ["7. Service levels", "Provider will deliver support per Exhibit B. Availability credits, where applicable, are agreed in Exhibit B and are the sole remedy for such breach."],
      ["8. Confidentiality", "Each party will protect the other's confidential information with at least reasonable care and use it only to perform this Agreement, during the Term and for three (3) years after."],
      ["9. Intellectual property", "Provider retains all rights in the Service and its improvements. Customer suggestions may be used without obligation. No rights are transferred except the license in Section 1."],
      ["10. Warranties and disclaimers", "Provider warrants the Service will perform substantially per its documentation. EXCEPT AS EXPRESSLY STATED, THE SERVICE IS PROVIDED \u201CAS IS\u201D WITHOUT OTHER WARRANTIES, EXPRESS OR IMPLIED."],
      ["11. Limitation of liability", "NEITHER PARTY IS LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES. EACH PARTY'S TOTAL LIABILITY WILL NOT EXCEED THE AMOUNTS PAID BY CUSTOMER IN THE TWELVE (12) MONTHS BEFORE THE EVENT. These limits do not apply to breaches of confidentiality, indemnity, or amounts due."],
      ["12. Term and termination", "This Agreement runs for the Term and renews as stated above unless either party gives written notice at least thirty (30) days before the Renewal decision date. Either party may terminate for material breach uncured thirty (30) days after notice. On termination Customer may export its data for thirty (30) days; Provider then deletes it per the Service Policies."],
      ["13. Governing law and disputes", "This Agreement is governed by the laws of the Commonwealth of Puerto Rico. The parties will attempt good-faith resolution for thirty (30) days before resorting to the courts of San Juan, Puerto Rico, to whose jurisdiction they submit."],
      ["14. General", "This Agreement with its Exhibits is the entire agreement and supersedes prior proposals. Amendments require both signatures. If a clause is invalid the rest survives. Neither party may assign without consent, except to a successor of its whole business. Notices are in writing to designated contacts."],
    ],
    exA: "EXHIBIT A — Commercial Terms", exB: "EXHIBIT B — Service Levels",
    exC: "EXHIBIT C — Onboarding Milestones", sign: "SIGNATURES",
    item: "Item", qty: "Qty", unit: "Unit price", period: "Period", amount: "Amount",
    seats: "Paid seats", bundles: "Contributor bundles (×10)", ocr: "Additional OCR packs (+200 pages/mo; first pack included)",
    retainer: (h: number) => `Service retainer (${h} h/mo)`, svcRate: "Professional service rate",
    subDisc: "Subscription discount", onbDisc: "Onboarding discount", svcDisc: "Service discount",
    firstFree: "First service package included in onboarding", onboarding: "Onboarding (one-time)",
    perMo: "/mo", perYr: "annual", oneTime: "one-time", perHr: "/hour",
    subtotalRec: "Annualized subscription", totalYear1: "TOTAL FIRST YEAR", totalRenewal: "Annual renewal total",
    ocrCap: "OCR cap", pages: "pages/mo",
    tier: "Support tier", response: "First response", uptime: "Uptime commitment",
    slaNotes: "SLA notes", hours: "hours", none: "—",
    milestone: "Milestone", due: "Date", ms_amount: "Amount",
    noMs: "No milestones defined — onboarding is billed as a single one-time fee.",
    forProvider: "For Provider — FLOW SYNC PM", forCustomer: "For Customer",
    name: "Name", titleL: "Title", date: "Date", signature: "Signature",
    notes: "Contract notes",
    footer: "Generated from the contract record — amounts are the same ones Calculate and the system invoices use.",
  },
} as const

const money = (n: number, cur: string) =>
  n.toLocaleString("en-US", { style: "currency", currency: cur || "USD" })
const fdate = (d: any, lang: "es" | "en") => d
  ? new Date(d).toLocaleDateString(lang === "es" ? "es-PR" : "en-US",
      { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  : "—"

export default async function AgreementPrintPage({ params, searchParams }: {
  params: { contractId: string }; searchParams?: { lang?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/admin")
  const email = (session.user.email || "").toLowerCase()
  const allowed = platformAdmins()
  if (!allowed.length || !allowed.includes(email)) redirect("/dashboard")

  const c = await db.customerContract.findUnique({
    where: { id: params.contractId },
    include: {
      workspace: { select: { name: true } },
      onboardingMilestones: { orderBy: { sortOrder: "asc" } },
    } as any,
  }) as any
  if (!c) notFound()

  const lang: "es" | "en" = searchParams?.lang === "en" ? "en" : "es"
  const t = T[lang]
  const cur = c.currency || "USD"
  const m = contractMath(c)
  const n = (v: any) => (v == null ? 0 : Number(v))
  const cyc = c.billingCycle === "MONTHLY" ? 1 : 12

  const ink = "#0D1B2A", faint = "#64748B", border = "#E2E8F0"
  const h2: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: ink, letterSpacing: ".04em",
    margin: "26px 0 10px", paddingBottom: 5, borderBottom: `2px solid ${ink}` }
  const p: React.CSSProperties = { fontSize: 11.5, lineHeight: 1.6, color: ink, margin: "0 0 9px",
    textAlign: "justify" }
  const clauseT: React.CSSProperties = { fontWeight: 700 }
  const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", fontSize: 10,
    textTransform: "uppercase", letterSpacing: ".05em", color: faint, borderBottom: `1.5px solid ${ink}` }
  const td: React.CSSProperties = { padding: "6px 8px", fontSize: 11.5, borderBottom: `1px solid ${border}`,
    verticalAlign: "top" }
  const num: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }
  const kv: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: 11.5,
    padding: "4px 0", borderBottom: `1px solid ${border}` }

  // Exhibit A rows
  type Row = { item: string; qty: string; unit: string; period: string; amount: number; sub?: boolean; neg?: boolean }
  const rows: Row[] = []
  if (n(c.paidSeats) > 0) rows.push({ item: t.seats, qty: String(c.paidSeats),
    unit: money(m.seatPrice, cur) + t.perMo, period: cyc === 12 ? t.perYr : t.perMo,
    amount: m.perMoSeats * cyc })
  if (n(c.contributorBundles) > 0) rows.push({ item: t.bundles, qty: String(c.contributorBundles),
    unit: money(m.bundlePrice, cur) + t.perMo, period: cyc === 12 ? t.perYr : t.perMo,
    amount: m.perMoBund * cyc })
  if (m.subDisc > 0) rows.push({ item: `${t.subDisc} (${m.subDisc}%)`, qty: "", unit: "", period: "",
    amount: -Math.round((m.perMoSeats + m.perMoBund) * cyc * m.subDisc / 100 * 100) / 100, neg: true })
  if (m.ocrPacks > 0) rows.push({ item: t.ocr, qty: String(m.ocrPacks),
    unit: money(m.ocrPrice, cur) + t.perMo, period: cyc === 12 ? t.perYr : t.perMo, amount: m.ocrAnnual })
  if (m.retainer > 0) rows.push({ item: t.retainer(m.pkgHours), qty: String(m.retainer),
    unit: money(m.pkgPrice, cur) + t.perMo + (m.svcDisc > 0 ? ` (−${m.svcDisc}%)` : ""),
    period: cyc === 12 ? t.perYr : t.perMo, amount: m.svcAnnual })
  if (m.firstFree > 0) rows.push({ item: t.firstFree, qty: "1", unit: money(m.pkgPrice, cur), period: t.oneTime,
    amount: -m.firstFree, neg: true })
  if (m.onboarding > 0 || n(c.onboardingFee) > 0) rows.push({ item: t.onboarding + (m.onbDisc > 0 ? ` (−${m.onbDisc}%)` : ""),
    qty: "1", unit: money(n(c.onboardingFee), cur), period: t.oneTime, amount: m.onboarding })
  const renewalTotal = Math.round((m.subAnnual + m.ocrAnnual + m.svcAnnual) * 100) / 100

  return (
    <div style={{ background: "#F1F5F9", minHeight: "100vh", padding: "24px 0",
      fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", color: ink }}>
      <style>{`
        @media print {
          body { background: #fff !important; }
          .fs-inv-chrome { display: none !important; }
          .fs-inv-page { box-shadow: none !important; margin: 0 !important; border: none !important; width: auto !important; }
          .pb { page-break-before: always; }
          tr, .keep { page-break-inside: avoid; }
        }
        @page { size: letter; margin: 16mm; }
      `}</style>
      <PrintActions lang={lang} />

      <div className="fs-inv-page" style={{ width: 760, margin: "0 auto", background: "#fff",
        border: `1px solid ${border}`, borderRadius: 8, boxShadow: "0 8px 28px rgba(13,27,42,.10)",
        padding: "44px 52px" }}>

        {/* Draft banner */}
        <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", color: "#92400E", fontSize: 11,
          fontWeight: 700, padding: "8px 12px", borderRadius: 6, marginBottom: 20, textAlign: "center",
          letterSpacing: ".03em" }}>{t.draftNotice}</div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <LogoMark size={40} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>FlowSync <span style={{ color: "#F59E0B" }}>PM</span></div>
              <div style={{ fontSize: 11, color: faint }}>flowsyncpm.com</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: ".04em" }}>{t.title}</div>
            <div style={{ fontSize: 11, color: faint }}>{t.sub} · {c.name}</div>
          </div>
        </div>

        {/* Parties */}
        <div style={h2}>{t.parties}</div>
        <p style={p}><span style={clauseT}>{t.provider}: </span>{t.providerLine}</p>
        <p style={p}><span style={clauseT}>{t.customer}: </span>{t.customerLine(c.workspace?.name || "—")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px", marginTop: 6 }}>
          <div style={kv}><span style={{ color: faint }}>{t.effective}</span><b>{fdate(c.startDate, lang)}</b></div>
          <div style={kv}><span style={{ color: faint }}>{t.term}</span><b>{fdate(c.startDate, lang)} → {fdate(c.endDate, lang)}</b></div>
          <div style={kv}><span style={{ color: faint }}>{t.renewal}</span><b>{fdate(c.renewalDate, lang)}</b></div>
          <div style={kv}><span style={{ color: faint }}>{t.autoRenew}</span><b>{c.autoRenew ? t.yes : t.no}</b></div>
        </div>

        {/* Clauses */}
        {(t.s as readonly (readonly [string, string])[]).map(([h, body]) => (
          <div key={h} className="keep">
            <div style={{ fontSize: 12, fontWeight: 700, margin: "14px 0 3px" }}>{h}</div>
            <p style={p}>{body}</p>
          </div>
        ))}

        {/* Exhibit A */}
        <div className="pb" />
        <div style={h2}>{t.exA}</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>{t.item}</th><th style={{ ...th, ...num }}>{t.qty}</th>
            <th style={{ ...th, ...num }}>{t.unit}</th><th style={th}>{t.period}</th>
            <th style={{ ...th, ...num }}>{t.amount} ({cur})</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ ...td, color: r.neg ? "#059669" : ink }}>{r.item}</td>
                <td style={{ ...td, ...num }}>{r.qty}</td>
                <td style={{ ...td, ...num }}>{r.unit}</td>
                <td style={td}>{r.period}</td>
                <td style={{ ...td, ...num, fontWeight: 600, color: r.neg ? "#059669" : ink }}>
                  {r.neg ? "−" : ""}{money(Math.abs(r.amount), cur)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <div style={{ width: 320 }}>
            <div style={kv}><span style={{ color: faint }}>{t.subtotalRec}</span><b>{money(renewalTotal, cur)}</b></div>
            <div style={{ ...kv, borderTop: `2px solid ${ink}`, borderBottom: "none", fontSize: 14, fontWeight: 800, paddingTop: 8 }}>
              <span>{t.totalYear1}</span><span>{money(c.amount != null ? n(c.amount) : m.total, cur)}</span>
            </div>
            <div style={{ fontSize: 10.5, color: faint, marginTop: 4 }}>{t.totalRenewal}: {money(renewalTotal, cur)}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px", marginTop: 14 }}>
          <div style={kv}><span style={{ color: faint }}>{t.ocrCap}</span><b>{c.ocrPageCap ? `${c.ocrPageCap} ${t.pages}` : "200 " + t.pages}</b></div>
          <div style={kv}><span style={{ color: faint }}>{t.svcRate}</span>
            <b>{c.serviceHourlyRate ? money(n(c.serviceHourlyRate), cur) + t.perHr : t.none}{m.svcDisc > 0 ? ` (−${m.svcDisc}%)` : ""}</b></div>
        </div>

        {/* Exhibit B */}
        <div style={h2}>{t.exB}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
          <div style={kv}><span style={{ color: faint }}>{t.tier}</span><b>{c.supportTier || t.none}</b></div>
          <div style={kv}><span style={{ color: faint }}>{t.response}</span><b>{c.responseHours ? `${c.responseHours} ${t.hours}` : t.none}</b></div>
          <div style={kv}><span style={{ color: faint }}>{t.uptime}</span><b>{c.uptimePct ? `${n(c.uptimePct)}%` : t.none}</b></div>
        </div>
        {c.slaNotes && <p style={{ ...p, marginTop: 8 }}><span style={clauseT}>{t.slaNotes}: </span>{c.slaNotes}</p>}

        {/* Exhibit C */}
        <div style={h2}>{t.exC}</div>
        {c.onboardingMilestones?.length ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>{t.milestone}</th><th style={th}>{t.due}</th><th style={{ ...th, ...num }}>{t.ms_amount}</th></tr></thead>
            <tbody>{c.onboardingMilestones.map((ms: any) => (
              <tr key={ms.id}>
                <td style={td}>{ms.name}{ms.description ? <div style={{ fontSize: 10.5, color: faint }}>{ms.description}</div> : null}</td>
                <td style={td}>{fdate(ms.dueDate, lang)}</td>
                <td style={{ ...td, ...num }}>{money(n(ms.amount), cur)}</td>
              </tr>))}</tbody>
          </table>
        ) : <p style={p}>{t.noMs}</p>}

        {c.notes && (<><div style={h2}>{t.notes}</div><p style={{ ...p, whiteSpace: "pre-wrap" }}>{c.notes}</p></>)}

        {/* Signatures */}
        <div style={h2}>{t.sign}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 6 }} className="keep">
          {[t.forProvider, t.forCustomer].map(side => (
            <div key={side}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 22 }}>{side}</div>
              {[t.signature, t.name, t.titleL, t.date].map(l => (
                <div key={l} style={{ marginBottom: 16 }}>
                  <div style={{ borderBottom: `1px solid ${ink}`, height: 20 }} />
                  <div style={{ fontSize: 10, color: faint, marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9.5, color: faint, marginTop: 24, borderTop: `1px solid ${border}`, paddingTop: 8 }}>{t.footer}</div>
      </div>
    </div>
  )
}
