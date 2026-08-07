// src/lib/landing-faqs.ts
//
// The landing FAQs live here rather than inside the landing component because
// two things need them: the page that renders them and the server that marks
// them up as FAQPage. A client component can't hand an array to the server, and
// duplicating the copy is how the visible answers and the structured data drift
// apart — which search engines treat as deception.
export const FAQS = [
  { q:"Can I try it before paying?",
    a:"Yes. Every account starts with a two-month free trial of the full product, with no feature limits — and no credit card. When you're ready, subscribe from Settings → Billing; if you do it during the trial, your card isn't charged until the trial actually ends. If two months pass and you haven't subscribed, nothing is charged — your work stays safe and read-only until you do." },
  { q:"Do I pay for everyone on the team?",
    a:"No. On Business you pay per user only for the roles that drive and govern the work: sponsors, PMO directors, program and project managers, product owners, PMO analysts. Everyone who contributes or just needs visibility — team members, stakeholders, clients, external resources — comes in bundles at $20/mo per 10 people." },
  { q:"What can it actually read from my plan?",
    a:"Upload a project plan in Word, Excel or PDF and it extracts phases, milestones, tasks with dates and effort, risks with scoring, budget lines, and requirements. You review everything before it commits — nothing is written to your project until you approve it." },
  { q:"Does it support Waterfall, Agile and Hybrid in one workspace?",
    a:"Yes — all three share the same data model. A predictive project shows phases and a Gantt. An agile one shows a backlog and sprint board. Hybrid runs both. You can run all three at once, in one portfolio." },
  { q:"How does billing work outside the United States?",
    a:"Prices are in US dollars and payment is by credit or debit card through Stripe — cards issued anywhere in the Americas work. Formal invoices are issued for customers in the United States and Puerto Rico. We do not issue country-specific tax documents elsewhere, including CFDI in Mexico. Every customer gets a Stripe receipt with our business details, which is valid proof of purchase but not a local tax invoice. If your organization requires local tax invoicing to buy, write to billing@flowsyncpm.com before subscribing and we'll tell you honestly whether we can serve you today." },
  { q:"Is it suitable for regulated or audited work?",
    a:"The platform keeps a full audit log, role-based data controls, and a governance repository holding charter, quality plan, decisions, minutes and handover records. Enterprise adds a Data Processing Agreement and custom terms." },
]
