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

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
