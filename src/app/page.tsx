// src/app/page.tsx
// Root redirect — authenticated users go to dashboard, others see landing
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import LandingPage from "@/components/landing/LandingPage"

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://flowsyncpm.com"

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "FlowSync PM",
      url: SITE,
      logo: `${SITE}/logo-light.svg`,
    },
    {
      "@type": "SoftwareApplication",
      name: "FlowSync PM",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE,
      description:
        "Enterprise project management platform for PMOs and multi-project organizations — Gantt and WBS planning, budgets and EVM, risk management, and AI-powered status reports.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free trial" },
    },
  ],
}

export default async function RootPage() {
  const session = await auth()
  if (session?.user?.id) redirect("/dashboard")
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  )
}
