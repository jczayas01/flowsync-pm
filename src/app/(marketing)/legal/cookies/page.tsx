import { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/LegalPage'
export const metadata: Metadata = { title: 'Cookie Policy — FlowSync PM' }
export default function Cookies() {
  return <LegalPage title="Cookie Policy" lastUpdated="July 1, 2026" sections={[
    { title:"What Are Cookies", content:"Cookies are small text files stored on your device by your browser. FlowSync PM uses cookies to maintain your session, remember your preferences, and improve the Service." },
    { title:"Cookies We Use", content:"NECESSARY (cannot be disabled): next-auth.session-token — Authentication session, 30 days; next-auth.csrf-token — CSRF protection, session; __Secure-next-auth.session-token — Secure session cookie, 30 days. FUNCTIONAL (optional): theme — UI theme preference, 1 year; timezone — Timezone preference, 1 year. ANALYTICS (optional, opt-in only): We may use privacy-friendly analytics. We do not use Google Analytics, Facebook Pixel, or any advertising cookies." },
    { title:"Third-Party Cookies", content:"Stripe sets cookies for payment processing when you visit billing pages. These are governed by Stripe's Cookie Policy." },
    { title:"Managing Cookies", content:"You can control cookies through your browser settings. Disabling necessary cookies will prevent you from logging in. You may also use browser extensions to block analytics cookies." },
    { title:"Contact", content:"Questions about cookies: privacy@flowsyncpm.com" },
  ]} />
}
