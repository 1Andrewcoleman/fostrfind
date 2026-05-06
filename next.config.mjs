import { withSentryConfig } from '@sentry/nextjs'

/**
 * Security headers applied to every response.
 *
 * CSP policy notes:
 *  - script-src 'unsafe-inline': required by Next.js inline scripts and
 *    Sentry SDK until a nonce-based approach is adopted.
 *  - script-src 'unsafe-eval': required by Next.js dev mode; consider
 *    removing in production-only builds in a future iteration.
 *  - connect-src includes Supabase REST/realtime, Sentry DSN, and the app
 *    URL for server actions.
 *  - frame-ancestors 'none': replaces X-Frame-Options for modern browsers
 *    while X-Frame-Options provides compatibility with older clients.
 *
 * Tighten script-src when Sentry nonce support is added.
 */
const SUPABASE_HOSTS = 'https://*.supabase.co https://*.supabase.in'
const SENTRY_HOSTS = 'https://*.sentry.io https://*.ingest.sentry.io'

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `img-src 'self' data: blob: https://images.unsplash.com ${SUPABASE_HOSTS}`,
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
  `connect-src 'self' ${SUPABASE_HOSTS} wss://*.supabase.co ${SENTRY_HOSTS}`,
  "media-src 'none'",
  "worker-src blob:",
].join('; ')

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: cspDirectives,
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Apply to every route (static assets, pages, API routes).
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  images: {
    remotePatterns: [
      // Dev-only: seeded demo dog photos come from Unsplash.
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Real user uploads (dog photos, shelter logos, foster avatars) live
      // in Supabase Storage. `*.supabase.co` covers projects in all regions.
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },
}

// Sentry build-time wrapper. Uploads source maps when SENTRY_AUTH_TOKEN
// is present; otherwise silently skips. Source maps are hidden from the
// public client bundle for security; Sentry still receives them via the
// upload step. The `org` and `project` slugs default to `fostr-find` —
// override with SENTRY_ORG / SENTRY_PROJECT env vars if your Sentry
// dashboard uses different slugs.
//
// `silent: !process.env.CI` keeps local `next build` output clean while
// surfacing Sentry plugin output (including upload errors) on Vercel
// and other CI providers, where CI=1 is set automatically.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? 'fostr-find',
  project: process.env.SENTRY_PROJECT ?? 'fostr-find',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
})
