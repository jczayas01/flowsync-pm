// src/lib/stripe/plan-limits.ts
// Pure plan-limit data — importable from CLIENT components (no Stripe SDK,
// no secrets). src/lib/stripe/client.ts re-exports these for server use.

export type PlanLimits = {
  projects:       number   // -1 = unlimited
  users:          number   // -1 = unlimited
  storage:        string
  aiReports:      boolean
  wordExport:     boolean
  evm:            boolean
  fullGovernance: boolean
  executiveDash:  boolean
  portfolio:      boolean
  automations:    number   // -1 = unlimited
  sso:            boolean
  whiteLabel:     boolean
  m365:           boolean
  ocr:            boolean   // AI reading of scanned documents
  apiAccess:      boolean
  auditLog:       string   // "30d" | "1y" | "unlimited"
  support:        string
}

export const STARTER_LIMITS: PlanLimits = {
  projects:-1, users:-1, storage:"10 GB",
  aiReports:true, wordExport:true, evm:true, fullGovernance:true,
  executiveDash:false, portfolio:false, automations:5,
  sso:false, whiteLabel:false, m365:false, ocr:false, apiAccess:false,
  auditLog:"30d", support:"Community & email",
}

export const BUSINESS_LIMITS: PlanLimits = {
  projects:-1, users:-1, storage:"100 GB",
  aiReports:true, wordExport:true, evm:true, fullGovernance:true,
  executiveDash:true, portfolio:true, automations:-1,
  sso:true, whiteLabel:false, m365:true, ocr:true, apiAccess:true,
  auditLog:"1y", support:"Email",
}

export const ENTERPRISE_LIMITS: PlanLimits = {
  ...BUSINESS_LIMITS,
  storage:"Unlimited", whiteLabel:true, auditLog:"unlimited",
  support:"Dedicated",
}
