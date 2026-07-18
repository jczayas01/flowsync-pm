// src/app/page.tsx
// Root redirect — authenticated users go to dashboard, others see landing
import { SITE_URL } from "@/lib/site-url"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import LandingPage from "@/components/landing/LandingPage"

const SITE = SITE_URL

export const metadata = {
  alternates: { canonical: '/' },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "FlowSync PM",
      url: SITE,
      logo: `${SITE}/icon.svg`,   // served by src/app/icon.svg — there is no public/ dir
    },
    {
      "@type": "SoftwareApplication",
      name: "FlowSync PM",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE,
      description:
        "Enterprise project management platform for PMOs and multi-project organizations — Gantt and WBS planning, budgets and EVM, risk management, and AI-powered status reports.",
      inLanguage: ["en", "es"],
      // Real pricing. "price: 0" told Google this was freeware — it isn't, and the
      // range is what makes it comparable to the tools buyers search alongside.
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: "19",
        highPrice: "39",
        offerCount: "3",
        offers: [
          { "@type": "Offer", name: "Trial",    price: "0",  priceCurrency: "USD",
            description: "Two months free, full product, no credit card required." },
          { "@type": "Offer", name: "Starter",  price: "19", priceCurrency: "USD",
            description: "Per user, per month. Unlimited projects, Gantt, EVM, AI reports." },
          { "@type": "Offer", name: "Business", price: "39", priceCurrency: "USD",
            description: "Per user, per month for paid roles, plus $20/mo per 10 contributor users. Portfolio, SSO, governance." },
        ],
      },
      featureList: [
        "Gantt chart with critical path and baselines",
        "Budget tracking with earned value management (CPI, SPI, EAC)",
        "Risk and issue registers with probability-impact scoring",
        "AI-generated status reports",
        "AI import of existing project plans from Word, Excel and PDF",
        "Governance documentation and phase gates",
        "Portfolio and program hierarchy",
        "Bilingual English and Spanish interface",
      ],
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
