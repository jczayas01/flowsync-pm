// src/app/(marketing)/layout.tsx
// Marketing surface layout — mounts the Meta Pixel for pricing, legal and
// SEO/template pages. The (app) group deliberately has no such mount.
import { MetaPixel } from "@/components/marketing/MetaPixel"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MetaPixel />
      {children}
    </>
  )
}
