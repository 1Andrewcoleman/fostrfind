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
// is present; otherwise silently skips (silent: true keeps local
// `next build` output clean). Source maps are hidden from the public
// client bundle for security; Sentry still receives them via the
// upload step. The `org` value below is a placeholder until the user
// edits it to match their Sentry organisation slug or sets SENTRY_ORG
// in the build environment.
//
// TODO(step-47): replace 'fostr-fix' with the real Sentry org slug
// once the Sentry project is provisioned.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? 'fostr-fix',
  project: process.env.SENTRY_PROJECT ?? 'fostr-fix',
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
})
