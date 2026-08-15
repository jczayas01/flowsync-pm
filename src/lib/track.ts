"use client"
// src/lib/track.ts
//
// One place for the marketing funnel events, so every call site sends the same
// parameter names and GA4 can actually group them.
//
// Why this exists: the analytics showed 11 form_start and zero sign_up. That
// tells you people are dropping, but not where — the automatic events don't
// know the difference between the nav CTA and the pricing CTA, or between a
// visitor who read the Spanish page and one who read the English one.


import { sendGAEvent } from "@next/third-parties/google"

type Params = Record<string, string | number | boolean | undefined>

function send(name: string, params: Params = {}) {
  try {
    sendGAEvent("event", name, {
      // Language is on every event: the whole Spanish-market bet is unfalsifiable
      // without being able to split the funnel by it.
      lang: typeof document !== "undefined"
        ? (document.documentElement.lang || (location.pathname.startsWith("/es") ? "es" : "en"))
        : "en",
      ...params,
    })
  } catch { /* analytics must never break a click */ }
}

/** A call-to-action was clicked. `location` says which one — nav, hero, pricing, footer. */
export const trackCta = (location: string, label?: string) =>
  send("cta_click", { location, label })

/** Someone switched between the English and Spanish pages. */
export const trackLanguage = (to: "en" | "es", from: string) =>
  send("language_switch", { to, from })

/** Someone headed for the sign-in page. */
export const trackSignIn = (location: string) =>
  send("signin_click", { location })

/** The sign-up form was actually engaged with — the step before sign_up. */
export const trackSignUpStarted = (method = "password") =>
  send("sign_up_started", { method })

/** A sign-up attempt failed, with the reason. This is where the 11 went. */
export const trackSignUpFailed = (reason: string) =>
  send("sign_up_failed", { reason: reason.slice(0, 100) })
