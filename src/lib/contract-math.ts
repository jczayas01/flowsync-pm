// src/lib/contract-math.ts
// Single source of truth for contract pricing. Consumed by ContractsPanel
// (Calculate, first invoice), ContractsWorkspace (subscription invoice) and
// the printable agreement (server). Never duplicate this formula.

/** One source of truth for contract pricing — Calculate, the breakdown line
 *  and the first invoice all read this. Mirrors the negotiation sheet:
 *  (seats + contributor bundles + extra OCR packs + service retainer) per
 *  month × cycle, per-component discounts, first OCR pack always included,
 *  onboarding one-time. */
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
  const pkgHours    = nn(f.serviceBundleHours)
  const pkgPrice    = Math.round(pkgHours * nn(f.serviceHourlyRate) * (1 - svcDisc / 100) * 100) / 100
  const retainer    = nn(f.serviceRetainerPackages)
  const perMoSvc    = retainer * pkgPrice
  const cyc         = f.billingCycle === "MONTHLY" ? 1 : 12
  const r2 = (x: number) => Math.round(x * 100) / 100
  const subAnnual   = r2((perMoSeats + perMoBund) * (1 - subDisc / 100) * cyc)
  const ocrAnnual   = r2(perMoOcr * cyc)
  const svcAnnual   = r2(perMoSvc * cyc)
  // Onboarding-included package: one package free, once, on the first bill.
  const firstFree   = f.bundleInOnboarding && retainer > 0 ? pkgPrice : 0
  const onboarding  = r2(nn(f.onboardingFee) * (1 - onbDisc / 100))
  const total       = r2(subAnnual + ocrAnnual + svcAnnual - firstFree + onboarding)
  return { seatPrice, bundlePrice, ocrPrice, perMoSeats, perMoBund, perMoOcr,
           ocrPacks, pkgPrice, pkgHours, retainer, perMoSvc, cyc,
           subDisc, onbDisc, svcDisc, subAnnual, ocrAnnual, svcAnnual,
           firstFree, onboarding, total }
}
