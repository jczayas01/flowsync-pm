// src/app/layout.tsx — root layout with cookie banner
import type { Metadata } from "next"
import { CookieBanner } from "@/components/legal/CookieBanner"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "FlowSync PM", template: "%s — FlowSync PM" },
  description: "Enterprise project management for PMOs and healthcare IT organizations.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://flowsyncpm.com"),
  openGraph: {
    type:        "website",
    siteName:    "FlowSync PM",
    title:       "FlowSync PM — Enterprise Project Management",
    description: "Waterfall, Agile, and Scrum in one platform. Built for PMOs and healthcare IT.",
    url:         "https://flowsyncpm.com",
  },
  robots: {
    index:  true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
        <CookieBanner />
      </body>
    </html>
  )
}
