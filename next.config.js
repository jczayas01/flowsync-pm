const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Type errors now FAIL the build (retired the escape hatch — Jul 2026).
  typescript: { ignoreBuildErrors: false },
  experimental: {
    // Native modules must load at runtime, not be bundled — webpack chokes on
    // .node binaries. @napi-rs/canvas renders PDF pages for the OCR feature;
    // unpdf rides along because it dynamically imports the canvas.
    serverComponentsExternalPackages: ["@napi-rs/canvas", "unpdf"],
  },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "graph.microsoft.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ]
  },
}
module.exports = withNextIntl(nextConfig)
