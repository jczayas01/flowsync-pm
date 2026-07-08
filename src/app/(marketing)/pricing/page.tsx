// src/app/(marketing)/pricing/page.tsx
import { Metadata } from 'next'
import { PricingPage } from '@/components/marketing/PricingPage'

export const metadata: Metadata = {
  title: 'Pricing — FlowSync PM',
  description: 'Simple, transparent pricing for every team size. From solo PMs to enterprise PMOs.',
}

export default function Pricing() {
  return <PricingPage />
}
