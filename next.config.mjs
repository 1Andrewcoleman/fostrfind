import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
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
