// Next.js 14 instrumentation hook.
//
// `register()` is invoked by Next once per server boot, before any
// route handler or RSC runs. We branch on `NEXT_RUNTIME` so the Node
// runtime loads the Node-side Sentry init and the Edge runtime loads
// its (lighter) Edge init. The dynamic imports are deliberate — a
// top-level `import` would pull both runtimes' code into every bundle
// and defeat Sentry's runtime-aware tree-shaking.
//
// The client bundle does NOT come through here; `sentry.client.config`
// is loaded automatically by @sentry/nextjs's webpack plugin.
//
// `onRequestError` is the recommended Next.js 15+ / @sentry/nextjs >=
// 8.28 hook for auto-capturing every unhandled server-side request
// error (RSC, route handlers, server actions). It complements the
// per-segment error.tsx boundaries and Sentry's automatic instrumentation.

import * as Sentry from '@sentry/nextjs'

export async function register(): Promise<void> {
  // F-03 / F-04: Second enforcement layer for env var assertions.
  // next.config.mjs asserts at build time (catching the earliest possible
  // moment); this catches pre-built artifacts deployed without re-running
  // `next build` (Docker images, etc.). Both checks are skipped in
  // development where DEV_MODE is legitimate and APP_URL is optional.
  if (process.env.NODE_ENV !== 'development') {
    if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
      throw new Error(
        '[instrumentation] NEXT_PUBLIC_DEV_MODE=true detected outside local development. ' +
        'This disables all authentication. Halting server startup.',
      )
    }
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      throw new Error(
        '[instrumentation] NEXT_PUBLIC_APP_URL is not set in a non-development environment. ' +
        'CSRF origin validation is disabled across all mutation routes. Halting server startup.',
      )
    }
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
