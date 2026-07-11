// src/app/sitemap.ts — public pages only (app pages are auth-gated)
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_APP_URL || 'https://flowsyncpm.com'
  return [
    { url: site, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${site}/auth/signin`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ]
}
