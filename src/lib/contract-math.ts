// src/lib/contract-math.ts
// Single source of truth for contract pricing. Consumed by ContractsPanel
// (Calculate, first invoice), ContractsWorkspace (invoice composer) and the
// printable agreement (server). Never duplicate this formula.
//
// Model (agreed 2026-08-16):
//   • Seats, contributor bundles and extra OCR packs are MONTHLY, billed for the
//     whole term (×12 annual). First 200-page OCR pack is always included; every
//     extra pack is $10/mo (list) and lowering it requires a request.
//   • Service is a PREPAID BLOCK: N blocks of `serviceBundleHours` (10 h) at
//     hourly rate × hours, one-time. Hours are consumed across the whole term.
//     Overage is billed in whole additional blocks.
//   • Onboarding is a one-time fee. "bundleInOnboarding" makes the first block
//     free with onboarding.
//   • Mid-term increments are prorated by REMAINING MONTHS INCLUDING the request
//     month (Apr 1 → Jan 1 = 10). Renewal re-bills the full new quantities ×12
//     plus a fresh service block; unused hours don't roll over.

export function contractMath(f: any) {
  const nn = (v: any, def = 0) => (v === "" || v == null ? def : Number(v) || 0)
  const seatPrice   = nn(f.seatUnitPrice, 39)
  const bundlePrice = nn(f.contributorBundlePrice, 20)
  const ocrPrice    = nn(f.ocrPackPrice, 10)
  const perMoSeats  = nn(f.paidSeats) * seatPrice
  const perMoBund   = nn(f.contributorBundles) * bundlePrice
  const subDisc     = Math.min(100, nn(f.subscriptionDiscountPct))
  const onbDisc     = Math.min(100, nn(f.onboardingDiscountPct))
  const svcDisc     = Math.min(100, nn(f.serviceDiscountPct))
  // First 200-page pack is included in the plan; only extra packs bill.
  const ocrPacks    = Math.max(0, Math.ceil(nn(f.ocrPageCap) / 200) - 1)
  const perMoOcr    = ocrPacks * ocrPrice
  const pkgHours    = nn(f.serviceBundleHours, 10)
  const pkgPrice    = r(pkgHours * nn(f.serviceHourlyRate) * (1 - svcDisc / 100))
  // Prepaid service blocks (one-time). Field name kept for schema stability.
  const svcBlocks   = nn(f.serviceRetainerPackages)
  const cyc         = f.billingCycle === "MONTHLY" ? 1 : 12
  const subAnnual   = r((perMoSeats + perMoBund) * (1 - subDisc / 100) * cyc)
  const ocrAnnual   = r(perMoOcr * cyc)
  const svcOneTime  = r(svcBlocks * pkgPrice)
  const firstFree   = f.bundleInOnboarding && svcBlocks > 0 ? pkgPrice : 0
  const onboarding  = r(nn(f.onboardingFee) * (1 - onbDisc / 100))
  const total       = r(subAnnual + ocrAnnual + svcOneTime - firstFree + onboarding)
  return { seatPrice, bundlePrice, ocrPrice, perMoSeats, perMoBund, perMoOcr,
           ocrPacks, pkgPrice, pkgHours, svcBlocks, cyc,
           subDisc, onbDisc, svcDisc, subAnnual, ocrAnnual, svcOneTime,
           firstFree, onboarding, total,
           // legacy aliases still read by older callers
           retainer: svcBlocks, perMoSvc: 0, svcAnnual: svcOneTime }
}

/** Remaining whole months from `asOf` to `endDate`, counting the request
 *  month in full. Apr 1 → Jan 1 = 10. Never below 1 while inside the term. */
export function remainingMonths(asOf: Date, endDate: Date): number {
  const m = (endDate.getUTCFullYear() - asOf.getUTCFullYear()) * 12
          + (endDate.getUTCMonth() - asOf.getUTCMonth())
  return Math.max(1, m + 1)   // +1 = the request month itself
}

export type InvoiceLine = {
  item: "seats"|"bundles"|"ocr"|"service"|"onboarding"|"subDisc"|"firstFree"
  qty: number; unit: number; unitLabel: string; period: string; amount: number
}

const nn = (v: any) => (v === "" || v == null ? 0 : Number(v) || 0)

/** First invoice: full-term subscription + prepaid service + onboarding. */
export function firstInvoiceLines(c: any): InvoiceLine[] {
  const m = contractMath(c); const L: InvoiceLine[] = []
  const per = m.cyc === 12 ? "annual" : "monthly"
  if (nn(c.paidSeats) > 0) L.push({ item:"seats", qty:nn(c.paidSeats), unit:m.seatPrice, unitLabel:"/mo", period:per, amount:r(m.perMoSeats*m.cyc) })
  if (nn(c.contributorBundles) > 0) L.push({ item:"bundles", qty:nn(c.contributorBundles), unit:m.bundlePrice, unitLabel:"/mo", period:per, amount:r(m.perMoBund*m.cyc) })
  if (m.subDisc > 0) L.push({ item:"subDisc", qty:1, unit:0, unitLabel:"", period:"", amount:-r((m.perMoSeats+m.perMoBund)*m.cyc*m.subDisc/100) })
  if (m.ocrPacks > 0) L.push({ item:"ocr", qty:m.ocrPacks, unit:m.ocrPrice, unitLabel:"/mo", period:per, amount:m.ocrAnnual })
  if (m.svcBlocks > 0) L.push({ item:"service", qty:m.svcBlocks, unit:m.pkgPrice, unitLabel:"", period:"one-time", amount:m.svcOneTime })
  if (m.firstFree > 0) L.push({ item:"firstFree", qty:1, unit:m.pkgPrice, unitLabel:"", period:"one-time", amount:-m.firstFree })
  if (m.onboarding > 0) L.push({ item:"onboarding", qty:1, unit:nn(c.onboardingFee), unitLabel:"", period:"one-time", amount:m.onboarding })
  return L
}

/** Increment invoice: added quantities, prorated by remaining months
 *  (request month included). Service blocks are one-time, never prorated. */
export function incrementInvoiceLines(c: any, add: {
  seats?: number; bundles?: number; ocrPacks?: number; serviceBlocks?: number
}, asOf: Date): InvoiceLine[] {
  const m = contractMath(c); const L: InvoiceLine[] = []
  const months = c.endDate ? remainingMonths(asOf, new Date(c.endDate)) : m.cyc
  const per = `${months} mo`
  const disc = 1 - m.subDisc / 100
  if ((add.seats||0) > 0) L.push({ item:"seats", qty:add.seats!, unit:m.seatPrice, unitLabel:"/mo", period:per, amount:r(add.seats!*m.seatPrice*months*disc) })
  if ((add.bundles||0) > 0) L.push({ item:"bundles", qty:add.bundles!, unit:m.bundlePrice, unitLabel:"/mo", period:per, amount:r(add.bundles!*m.bundlePrice*months*disc) })
  if ((add.ocrPacks||0) > 0) L.push({ item:"ocr", qty:add.ocrPacks!, unit:m.ocrPrice, unitLabel:"/mo", period:per, amount:r(add.ocrPacks!*m.ocrPrice*months) })
  if ((add.serviceBlocks||0) > 0) L.push({ item:"service", qty:add.serviceBlocks!, unit:m.pkgPrice, unitLabel:"", period:"one-time", amount:r(add.serviceBlocks!*m.pkgPrice) })
  return L
}

/** Renewal invoice: full new quantities ×cycle + fresh service block(s).
 *  No onboarding, no first-free. Unused hours don't roll over. */
export function renewalInvoiceLines(c: any): InvoiceLine[] {
  const m = contractMath(c); const L: InvoiceLine[] = []
  const per = m.cyc === 12 ? "annual" : "monthly"
  if (nn(c.paidSeats) > 0) L.push({ item:"seats", qty:nn(c.paidSeats), unit:m.seatPrice, unitLabel:"/mo", period:per, amount:r(m.perMoSeats*m.cyc) })
  if (nn(c.contributorBundles) > 0) L.push({ item:"bundles", qty:nn(c.contributorBundles), unit:m.bundlePrice, unitLabel:"/mo", period:per, amount:r(m.perMoBund*m.cyc) })
  if (m.subDisc > 0) L.push({ item:"subDisc", qty:1, unit:0, unitLabel:"", period:"", amount:-r((m.perMoSeats+m.perMoBund)*m.cyc*m.subDisc/100) })
  if (m.ocrPacks > 0) L.push({ item:"ocr", qty:m.ocrPacks, unit:m.ocrPrice, unitLabel:"/mo", period:per, amount:m.ocrAnnual })
  const blocks = Math.max(1, m.svcBlocks)   // renewal always brings a fresh block
  if (nn(c.serviceHourlyRate) > 0) L.push({ item:"service", qty:blocks, unit:m.pkgPrice, unitLabel:"", period:"one-time", amount:r(blocks*m.pkgPrice) })
  return L
}

export function sumLines(L: InvoiceLine[]) { return r(L.reduce((s, l) => s + l.amount, 0)) }
function r(x: number) { return Math.round(x * 100) / 100 }
