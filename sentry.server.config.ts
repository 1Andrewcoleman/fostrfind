// Sentry Node-runtime init — loaded by `instrumentation.ts` when
// NEXT_RUNTIME === 'nodejs'.
//
// Lives at the project ROOT by Sentry's auto-discovery convention.
// `enabled` keys off NODE_ENV (not Fostr Fix's Supabase-specific
// DEV_MODE) so test + dev runs never publish events.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',
})
