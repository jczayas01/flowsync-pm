// src/lib/date-locale.ts
//
// Which locale dates should be formatted in.
//
// Every date in the product was hardcoded to "en-US", so a user working entirely
// in Spanish read "Aug 4" and "8/4/2026" — a small thing that quietly says the
// product was built for someone else and translated afterwards. Which is exactly
// what we tell people we don't do.
//
// It reads the language the page is already running in (<html lang>, set by
// next-intl) rather than threading a locale through every call site, so adopting
// it is a one-word change at each of eighty-odd places instead of a refactor.
// Server-side rendering has no document; there it falls back to en-US, and the
// value is corrected on hydration.

export function dateLocale(): string {
  if (typeof document !== "undefined") {
    const l = document.documentElement.lang
    if (l?.startsWith("es")) return "es-MX"   // Latin American conventions, not Spain's
    if (l) return l
  }
  return "en-US"
}

/** Same idea for numbers and currency, where the thousands separator differs. */
export function numberLocale(): string {
  return dateLocale()
}
