// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://flowsyncpm.com'
const DESC = 'FlowSync PM is an enterprise project management platform for PMOs and multi-project organizations — plan with Gantt and WBS, track budgets and EVM, manage risks, and generate AI-powered status reports.'

export const metadata: Metadata = {
  other: { google: "notranslate" },
  title: { default: 'FlowSync PM — Enterprise Project & PMO Management', template: '%s · FlowSync PM' },
  description: DESC,
  metadataBase: new URL(SITE),
  keywords: [
    'project management software', 'PMO platform', 'enterprise project management',
    'Gantt chart', 'WBS', 'earned value management', 'EVM', 'risk management',
    'project portfolio management', 'AI status reports', 'project intake',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE,
    siteName: 'FlowSync PM',
    title: 'FlowSync PM — Enterprise Project & PMO Management',
    description: DESC,
  },
  twitter: {
    card: 'summary',
    title: 'FlowSync PM — Enterprise Project & PMO Management',
    description: DESC,
  },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
  },
  applicationName: 'FlowSync PM',
  category: 'Business Software',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" translate="no" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
