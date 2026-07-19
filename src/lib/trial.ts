// src/lib/trial.ts
// Trial lifecycle — the single source of truth for what a workspace may do.
//
// Model A promises, in the legal terms and on every pricing surface:
//   "If the trial ends without a subscription, nothing is charged; workspace
//    access is limited until a subscription begins."
// This file is what makes that sentence true. Paid plans never expire here —
// Stripe's webhook manages their lifecycle.

export type TrialState =
  | { status: "subscribed" }                     // paid plan — trial logic doesn't apply
  | { status: "active";  daysLeft: number }      // trial, >14 days remaining
  | { status: "ending";  daysLeft: number }      // trial, final 14 days — show countdown
  | { status: "expired"; daysAgo: number }       // trial over, unsubscribed — read-only

export function trialState(ws: { plan: string; trialEndsAt: Date | null }): TrialState {
  if (ws.plan !== "FREE") return { status: "subscribed" }
  // FREE with no end date: legacy/comped workspace — treat as active, never expire.
  if (!ws.trialEndsAt) return { status: "active", daysLeft: 9999 }

  const msLeft = ws.trialEndsAt.getTime() - Date.now()
  const days = Math.ceil(msLeft / 86_400_000)
  if (days < 0)   return { status: "expired", daysAgo: -days }
  if (days <= 14) return { status: "ending",  daysLeft: Math.max(days, 0) }
  return { status: "active", daysLeft: days }
}

/** True when the workspace must be read-only. */
export function trialLocked(ws: { plan: string; trialEndsAt: Date | null }): boolean {
  return trialState(ws).status === "expired"
}
