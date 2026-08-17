// src/app/(app)/admin/contracts/[contractId]/invoices/[invoiceId]/print/page.tsx
// Printable invoice — the browser's print-to-PDF closes the billing loop
// without adding a PDF engine to the serverless bundle.
//
// Language comes from ?lang=es|en (default es) with a LOCAL dictionary, not
// next-intl: this document goes to the customer and its wording must be fixed
// and immune to dictionary churn — the same reasoning that keeps error.tsx in
// plain strings. Layout mirrors public/sales-kit/FlowSync_Factura_* (De /
// Facturar a, invoice meta strip, line items, totals, ACH + NET-30 footer).
// The EIN is deliberately absent — that lives only in the PRIVATE documents.
export const dynamic = "force-dynamic"

import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { LogoMark } from "@/components/shared/Logo"
import { PrintActions } from "@/components/shared/PrintActions"

function platformAdmins(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
}

const STRINGS = {
  es: {
    invoice: "FACTURA", from: "De", billTo: "Facturar a",
    number: "Núm. de factura", issued: "Fecha", terms: "Términos", due: "Vencimiento",
    description: "Descripción", qty: "Cant.", unit: "Precio unitario", amount: "Importe",
    service: "Servicio", onboarding: "Hito de implementación", otherCharges: "Otros cargos",
    discount: "Descuento",
    hours: "hrs", subtotal: "Subtotal", total: "Total a pagar",
    taxNote: "* Impuesto sobre ventas y uso de Puerto Rico (IVU) aplicado donde la ley lo requiera.",
    payTitle: "Pago",
    payAch: "ACH / transferencia bancaria: datos de remesa provistos al firmar el contrato.",
    payRef: "Favor de referenciar el número de factura en todos los pagos.",
    payQ: "Preguntas: billing@flowsyncpm.com",
    netTerms: "Términos de pago NET-30 desde la fecha de factura.",
    merchant: "Registro de Comerciante Núm. 1552654-0010",
    naics: "NAICS 54151 · Puerto Rico, EE. UU.",
    statusVOID: "ANULADA", statusDRAFT: "BORRADOR", statusPAID: "PAGADA",
    contractLabel: "Contrato",
  },
  en: {
    invoice: "INVOICE", from: "From", billTo: "Bill to",
    number: "Invoice no.", issued: "Issue date", terms: "Terms", due: "Due date",
    description: "Description", qty: "Qty", unit: "Unit price", amount: "Amount",
    service: "Service", onboarding: "Onboarding milestone", otherCharges: "Other charges",
    discount: "Discount",
    hours: "hrs", subtotal: "Subtotal", total: "Total due",
    taxNote: "* Puerto Rico sales and use tax (IVU) applied where required by law.",
    payTitle: "Payment",
    payAch: "ACH / bank transfer: remittance details provided at contract signing.",
    payRef: "Please reference the invoice number on all payments.",
    payQ: "Questions: billing@flowsyncpm.com",
    netTerms: "Payment terms NET-30 from invoice date.",
    merchant: "Merchant Registration No. 1552654-0010",
    naics: "NAICS 54151 · Puerto Rico, USA",
    statusVOID: "VOID", statusDRAFT: "DRAFT", statusPAID: "PAID",
    contractLabel: "Contract",
  },
} as const

function fmtMoney(n: number, currency: string) {
  return n.toLocaleString("en-US", { style: "currency", currency: currency || "USD" })
}
function fmtDate(d: Date | null | undefined, lang: "es" | "en") {
  if (!d) return "—"
  return new Date(d).toLocaleDateString(lang === "es" ? "es-PR" : "en-US",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}

export default async function InvoicePrintPage({ params, searchParams }: {
  params: { contractId: string; invoiceId: string }
  searchParams?: { lang?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/admin")
  const email = (session.user.email || "").toLowerCase()
  const allowed = platformAdmins()
  if (!allowed.length || !allowed.includes(email)) redirect("/dashboard")

  const lang: "es" | "en" = searchParams?.lang === "en" ? "en" : "es"
  const t = STRINGS[lang]

  const inv = await db.contractInvoice.findFirst({
    where: { id: params.invoiceId, contractId: params.contractId },
    include: {
      contract: { include: { workspace: { select: { name: true } } } },
      serviceEntries: { orderBy: { entryDate: "asc" } },
      onboardingMilestones: { orderBy: { sortOrder: "asc" } },
    },
  })
  if (!inv) notFound()

  const currency = inv.currency || inv.contract.currency || "USD"
  const amount = Number(inv.amount)

  type Line = { desc: string; sub?: string; qty: string; unit: string; amount: number }
  const lines: Line[] = []
  for (const s of inv.serviceEntries) {
    lines.push({
      desc: s.description,
      sub: `${t.service} · ${fmtDate(s.entryDate, lang)}`,
      qty: `${Number(s.hours)} ${t.hours}`,
      unit: fmtMoney(Number(s.rate), currency),
      amount: Number(s.amount),
    })
  }
  for (const m of inv.onboardingMilestones) {
    lines.push({
      desc: m.name,
      sub: t.onboarding + (m.description ? ` · ${m.description}` : ""),
      qty: "1",
      unit: fmtMoney(Number(m.amount), currency),
      amount: Number(m.amount),
    })
  }
  // Composer invoices carry structured lines — those win over everything.
  const structured: any[] = Array.isArray(inv.lines) ? (inv.lines as any[]) : []
  if (structured.length) {
    lines.length = 0
    for (const l of structured) {
      const per = l.period === "annual" ? (lang === "es" ? "anual" : "annual")
        : l.period === "monthly" ? (lang === "es" ? "mensual" : "monthly")
        : l.period === "one-time" ? (lang === "es" ? "único" : "one-time")
        : String(l.period || "")
      lines.push({
        desc: String(l.label), sub: per || undefined,
        qty: String(l.qty ?? 1),
        unit: l.unit ? fmtMoney(Number(l.unit), currency) + String(l.unitLabel || "") : "—",
        amount: Number(l.amount) || 0,
      })
    }
  }
  const linesSum = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100
  // A hand-entered invoice has no linked work; the amount itself is the line.
  // A linked invoice whose amount drifted from its lines gets the difference
  // shown explicitly — a total that doesn't match its rows is a dispute.
  const diff = Math.round((amount - linesSum) * 100) / 100
  if (lines.length === 0) {
    lines.push({ desc: inv.contract.name, sub: inv.notes || undefined, qty: "1",
      unit: fmtMoney(amount, currency), amount })
  } else if (diff !== 0 && !structured.length) {
    lines.push({ desc: diff < 0 ? t.discount : t.otherCharges, qty: "1",
      unit: fmtMoney(diff, currency), amount: diff })
  }

  const ink = "#0D1B2A", faint = "#64748B", border = "#E2E8F0"
  const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 10.5,
    textTransform: "uppercase", letterSpacing: ".05em", color: faint,
    borderBottom: `2px solid ${ink}` }
  const td: React.CSSProperties = { padding: "9px 10px", fontSize: 12.5,
    borderBottom: `1px solid ${border}`, verticalAlign: "top" }
  const num: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums" }

  const watermark = inv.status === "VOID" ? t.statusVOID
                  : inv.status === "DRAFT" ? t.statusDRAFT : null

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

        {watermark && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
            pointerEvents: "none" }}>
            <div style={{ fontSize: 92, fontWeight: 800, color: "rgba(220,38,38,.08)",
              transform: "rotate(-24deg)", letterSpacing: ".1em" }}>{watermark}</div>
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
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: ".04em" }}>{t.invoice}</div>
            <div style={{ fontSize: 12.5, color: faint, marginTop: 2 }}>{inv.number}</div>
            {inv.status === "PAID" && (
              <div style={{ display: "inline-block", marginTop: 6, padding: "2px 10px",
                border: "1.5px solid #059669", borderRadius: 12, color: "#059669",
                fontSize: 11, fontWeight: 700 }}>{t.statusPAID}</div>
            )}
          </div>
        </div>

        {/* From / Bill to */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 30 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: faint,
              textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>{t.from}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.65 }}>
              <strong>FLOW SYNC PM</strong><br />
              {t.merchant}<br />
              {t.naics}<br />
              billing@flowsyncpm.com
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: faint,
              textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>{t.billTo}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.65 }}>
              <strong>{inv.contract.workspace.name}</strong><br />
              {t.contractLabel}: {inv.contract.name}
            </div>
          </div>
        </div>

        {/* Meta strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0,
          marginTop: 26, border: `1px solid ${border}`, borderRadius: 6, overflow: "hidden" }}>
          {[[t.number, inv.number], [t.issued, fmtDate(inv.issueDate, lang)],
            [t.terms, "NET-30"], [t.due, fmtDate(inv.dueDate, lang)]].map(([k, v], i) => (
            <div key={k} style={{ padding: "8px 12px",
              borderLeft: i ? `1px solid ${border}` : "none", background: "#F8FAFC" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: faint,
                textTransform: "uppercase", letterSpacing: ".05em" }}>{k}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Line items */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 26 }}>
          <thead><tr>
            <th style={th}>{t.description}</th>
            <th style={{ ...th, ...num }}>{t.qty}</th>
            <th style={{ ...th, ...num }}>{t.unit}</th>
            <th style={{ ...th, ...num }}>{t.amount} ({currency})</th>
          </tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td style={td}>
                  {l.desc}
                  {l.sub && <div style={{ fontSize: 10.5, color: faint, marginTop: 2 }}>{l.sub}</div>}
                </td>
                <td style={{ ...td, ...num }}>{l.qty}</td>
                <td style={{ ...td, ...num }}>{l.unit}</td>
                <td style={{ ...td, ...num, fontWeight: 600 }}>{fmtMoney(l.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <div style={{ width: 280 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              padding: "6px 10px", fontSize: 12.5 }}>
              <span style={{ color: faint }}>{t.subtotal}</span>
              <span style={num as any}>{fmtMoney(amount, currency)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 10px",
              borderTop: `2px solid ${ink}`, fontSize: 14.5, fontWeight: 800 }}>
              <span>{t.total} ({currency})</span>
              <span style={num as any}>{fmtMoney(amount, currency)}</span>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 10.5, color: faint, marginTop: 8 }}>{t.taxNote}</div>

        {/* Payment */}
        <div style={{ marginTop: 30, paddingTop: 16, borderTop: `1px solid ${border}` }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: faint,
            textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>{t.payTitle}</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.8, color: ink }}>
            {t.payAch}<br />{t.payRef}<br />{t.payQ}
          </div>
          <div style={{ fontSize: 10.5, color: faint, marginTop: 12 }}>{t.netTerms}</div>
        </div>

        {inv.notes && !structured.length && lines[0]?.sub !== inv.notes && (
          <div style={{ marginTop: 14, fontSize: 11.5, color: faint,
            whiteSpace: "pre-wrap" }}>{inv.notes}</div>
        )}
      </div>
    </div>
  )
}
