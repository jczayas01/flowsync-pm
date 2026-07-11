// src/app/robots.ts — search engine rules
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_APP_URL || 'https://flowsyncpm.com'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard', '/projects', '/settings', '/onboarding', '/my-tasks', '/intake', '/portfolio'],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
  }
}
