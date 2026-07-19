// src/app/sitemap.ts — public, indexable pages only.
// Auth pages are deliberately absent: they carry no search value and dilute the
// crawl. App pages are behind login and disallowed in robots.ts.
import { DOC_TEMPLATES } from "@/lib/doc-templates"
import { SITE_URL } from "@/lib/site-url"
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const site = SITE_URL
  const now = new Date()

  return [
    { url: site,                    lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${site}/pricing`,       lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${site}/free-templates`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...DOC_TEMPLATES.map(t => ({ url: `${site}/free-templates/${t.id}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 })),
    { url: `${site}/legal`,         lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${site}/legal/terms`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${site}/legal/billing`, lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${site}/legal/privacy`, lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${site}/legal/dpa`,     lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${site}/legal/cookies`, lastModified: now, changeFrequency: 'yearly',  priority: 0.1 },
    { url: `${site}/legal/dmca`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.1 },
    { url: `${site}/legal/ai`,      lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ]
}
