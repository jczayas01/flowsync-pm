import { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/LegalPage'
export const metadata: Metadata = { title: 'DMCA Policy — FlowSync PM' }
export default function DMCA() {
  return <LegalPage title="DMCA & Copyright Policy" lastUpdated="July 1, 2026" sections={[
    { title:"Copyright Respect", content:"FlowSync PM respects intellectual property rights and expects users to do the same. The Template Marketplace and document upload features allow users to share content. Users may only upload content they own or have the right to distribute." },
    { title:"DMCA Takedown Procedure", content:"If you believe content on FlowSync PM infringes your copyright, send a written notice to dmca@flowsyncpm.com including: (1) Identification of the copyrighted work; (2) Identification of the infringing material and its location; (3) Your contact information; (4) A statement that you have a good faith belief the use is unauthorized; (5) A statement that the information is accurate, under penalty of perjury; (6) Your physical or electronic signature." },
    { title:"Counter-Notification", content:"If your content was removed in error, you may send a counter-notification to dmca@flowsyncpm.com including: (1) Your contact information; (2) Identification of the removed material; (3) A statement under penalty of perjury that removal was in error; (4) Consent to jurisdiction in Puerto Rico or your local federal district." },
    { title:"Repeat Infringers", content:"FlowSync PM will terminate accounts of users who are found to be repeat copyright infringers." },
    { title:"Template Marketplace", content:"Templates sold in the FlowSync PM Marketplace must be original works of the seller or properly licensed. Sellers warrant they have the right to sell each template. FlowSync PM may remove templates and suspend seller accounts upon verified copyright complaints." },
    { title:"Contact", content:"DMCA Agent: FlowSync PM, dmca@flowsyncpm.com" },
  ]} />
}
