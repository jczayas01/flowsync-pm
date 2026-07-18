// src/app/robots.ts — search engine rules
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const site = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowsyncpm.com').replace(/\/$/, '')
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          // The product itself — auth-gated, no search value.
          '/dashboard', '/projects', '/settings', '/onboarding', '/my-tasks',
          '/intake', '/portfolio', '/programs', '/resources', '/admin',
          // Auth + invite links must never be indexed: invite URLs contain tokens.
          '/auth/', '/invite/',
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  }
}
