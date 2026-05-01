import { DEV_MODE } from '@/lib/constants'

/**
 * Environment variable validation, run once at module scope during boot.
 *
 * Contract:
 *   - In **DEV_MODE** (NEXT_PUBLIC_SUPABASE_URL missing or not http-prefixed),
 *     the app is intentionally browsable without any real backend. We warn
 *     about missing vars so the developer sees something, but we never throw
 *     — that would break the zero-config dev UX.
 *   - Outside DEV_MODE, the two NEXT_PUBLIC_SUPABASE_* vars MUST be present.
 *     A missing anon key with a real URL is a deployment misconfiguration
 *     that would cause every auth call to silently fail; we'd rather fail
 *     loud at boot.
 *   - In **production** (NODE_ENV === 'production'), additional server-only
 *     vars become required: SUPABASE_SERVICE_ROLE_KEY (account delete) and
 *     RESEND_API_KEY (notification emails). RESEND_FROM and
 *     NEXT_PUBLIC_APP_URL have safe code-level fallbacks
 *     (`src/lib/email.ts` uses `onboarding@resend.dev` sandbox + localhost),
 *     so we warn rather than throw when they're missing — surfacing a bad
 *     config without blocking `next build` in a dev environment where the
 *     address and URL haven't been decided yet.
 *
 * Security: never log values, only key names. Throwing with a var name
 * is fine; throwing with a value would risk leaking secrets into logs.
 */

/** Always required once a real Supabase URL is configured. */
const BACKEND_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

/**
 * Hard-required in production. Missing any of these will throw during
 * boot / build — the app can't degrade gracefully without them.
 */
const PROD_HARD_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
] as const

/**
 * Soft-required in production. Missing any of these logs a loud warning
 * but does not throw, because the affected features fall back to a
 * known-safe degraded mode:
 *   - `RESEND_FROM` falls back to Resend's sandbox sender (`src/lib/email.ts`).
 *   - `NEXT_PUBLIC_APP_URL` falls back to localhost (email deep links break).
 *   - `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_AUTH_TOKEN` (Phase 7 Step 47):
 *     missing DSN means no error events ship to Sentry; missing auth
 *     token means source maps don't upload (events still arrive, just
 *     with minified stack traces). Both are pilot-blockers, not
 *     build-blockers, so we warn rather than throw.
 *
 * Fix them before public launch.
 */
const PROD_SOFT_VARS = [
  'RESEND_FROM',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
] as const

function missing(keys: readonly string[]): string[] {
  return keys.filter((key) => {
    const value = process.env[key]
    return value === undefined || value === '' || value === 'your_resend_api_key_here'
  })
}

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production'

  if (DEV_MODE) {
    const missingBackend = missing(BACKEND_VARS)
    if (missingBackend.length > 0) {
      console.warn(
        `[env] DEV_MODE active — backend env vars missing (${missingBackend.join(', ')}). The app will run with placeholder data; sign-in and data writes are disabled.`,
      )
    }
    return
  }

  const missingBackend = missing(BACKEND_VARS)
  if (missingBackend.length > 0) {
    const message = `[env] Missing required Supabase env vars: ${missingBackend.join(', ')}. Set them in .env.local (dev) or the hosting provider's env (prod).`
    if (isProd) throw new Error(message)
    console.warn(message)
  }

  if (isProd) {
    const missingHard = missing(PROD_HARD_VARS)
    if (missingHard.length > 0) {
      throw new Error(
        `[env] Missing required production env vars: ${missingHard.join(', ')}. These are required when NODE_ENV=production.`,
      )
    }
    const missingSoft = missing(PROD_SOFT_VARS)
    if (missingSoft.length > 0) {
      console.warn(
        `[env] Missing production env vars with safe fallbacks: ${missingSoft.join(', ')}. Email deep-links and sender address will use defaults until these are set.`,
      )
    }
  } else {
    const missingAll = missing([...PROD_HARD_VARS, ...PROD_SOFT_VARS])
    if (missingAll.length > 0) {
      console.warn(
        `[env] Missing optional env vars (dev): ${missingAll.join(', ')}. Account deletion and email sends will be degraded until these are set.`,
      )
    }
  }
}
