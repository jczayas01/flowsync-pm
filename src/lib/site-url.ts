// src/lib/site-url.ts
// The canonical site URL, normalized.
//
// Twelve files build URLs from NEXT_PUBLIC_APP_URL. A human editing that env var
// in the Vercel dashboard will eventually type it without the scheme — it
// happened, and `new URL("flowsyncpm.com")` in the root layout's metadataBase
// took the whole build down. Worse, email links built by concatenation
// ("flowsyncpm.com/invite/…") fail silently in mail clients.
//
// Rule: nothing reads process.env.NEXT_PUBLIC_APP_URL directly. Import SITE_URL.
const raw = (process.env.NEXT_PUBLIC_APP_URL || "https://flowsyncpm.com").trim()

export const SITE_URL = (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  .replace(/\/+$/, "")   // no trailing slash — every caller appends its own path
