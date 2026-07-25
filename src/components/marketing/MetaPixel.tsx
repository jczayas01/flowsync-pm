"use client"
// src/components/marketing/MetaPixel.tsx
// Meta Pixel — MARKETING SURFACES ONLY. Never mount this inside the (app)
// group: an ad tracker on authenticated screens where customer project data
// lives is a compliance non-starter, and our security posture says so.
//
// Fully env-gated: without NEXT_PUBLIC_META_PIXEL_ID the component renders
// nothing and pixelTrack() is a no-op, so preview/dev/self-hosted builds
// carry no tracker.

import Script from "next/script"
import { useEffect } from "react"
import { usePathname } from "next/navigation"

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

declare global {
  // eslint-disable-next-line no-var
  var fbq: ((...args: any[]) => void) | undefined
}

/** Fire a standard or custom Meta event. Safe to call anywhere. */
export function pixelTrack(event: string, params?: Record<string, unknown>) {
  if (!PIXEL_ID || typeof window === "undefined" || !window.fbq) return
  window.fbq("track", event, params)
}

export function MetaPixel() {
  const pathname = usePathname()

  // SPA navigations between marketing pages → PageView per route.
  useEffect(() => {
    if (!PIXEL_ID || !window.fbq) return
    window.fbq("track", "PageView")
  }, [pathname])

  if (!PIXEL_ID) return null
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">{`
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${PIXEL_ID}');
        fbq('track', 'PageView');
      `}</Script>
      <noscript>
        <img height="1" width="1" style={{ display: "none" }} alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`} />
      </noscript>
    </>
  )
}
