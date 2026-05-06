// Sentry Node-runtime init — loaded by `instrumentation.ts` when
// NEXT_RUNTIME === 'nodejs'.
//
// Lives at the project ROOT by Sentry's auto-discovery convention.
// `enabled` keys off NODE_ENV (not Fostr Find's Supabase-specific
// DEV_MODE) so test + dev runs never publish events.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',

  // PII scrubbing: strip known sensitive fields from event payloads before
  // they are transmitted to Sentry. Add to this list whenever new PII fields
  // appear in error contexts or breadcrumbs.
  beforeSend(event) {
    // Strip any keys that might carry PII from request bodies / extra context.
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'authorization', 'cookie',
      'email', 'phone', 'ein', 'first_name', 'last_name', 'avatar_url',
      'bio', 'children_info', 'other_pets_info', 'emergency_contact_name',
      'emergency_contact_phone',
    ]

    if (event.request?.data && typeof event.request.data === 'object') {
      const data = { ...(event.request.data as Record<string, unknown>) }
      for (const key of sensitiveKeys) {
        if (key in data) data[key] = '[Filtered]'
      }
      event.request.data = data
    }

    return event
  },
})
