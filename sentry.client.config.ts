// Sentry client init — runs once in every browser bundle.
//
// Lives at the project ROOT (not under `src/`) because @sentry/nextjs's
// build-time config wrapper looks for these three filenames at the
// repository root by convention. Moving any of them invalidates the
// auto-discovery.
//
// `enabled` is gated on NODE_ENV rather than on Fostr Fix's DEV_MODE
// flag (DEV_MODE is Supabase-specific). This keeps Sentry quiet in
// `next dev` and `vitest run` while still firing on real-Supabase
// staging deploys where NODE_ENV === 'production'.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 10% sampling keeps us comfortably under the free-tier transaction
  // quota during the pilot. Bump after we have baseline traffic data.
  tracesSampleRate: 0.1,
  // Session replays are off for now — they ship a heavy bundle and we
  // do not yet have a privacy/redaction story for foster PII.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  enabled: process.env.NODE_ENV === 'production',
})
