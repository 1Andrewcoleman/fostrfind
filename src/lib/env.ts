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
 *     vars become required: SUPABASE_SERVICE_ROLE_KEY (account delete),
 *     RESEND_API_KEY + RESEND_FROM (notification emails), and
 *     NEXT_PUBLIC_APP_URL (used as the base for email deep-links in
 *     src/lib/email.ts::getAppUrl).
 *
 * Security: never log values, only key names. Throwing with a var name
 * is fine; throwing with a value would risk leaking secrets into logs.
 */

/** Always required once a real Supabase URL is configured. */
const BACKEND_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

/** Required only when NODE_ENV === 'production'. */
const PROD_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM',
  'NEXT_PUBLIC_APP_URL',
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
    const missingProd = missing(PROD_VARS)
    if (missingProd.length > 0) {
      throw new Error(
        `[env] Missing required production env vars: ${missingProd.join(', ')}. These are required when NODE_ENV=production.`,
      )
    }
  } else {
    const missingProd = missing(PROD_VARS)
    if (missingProd.length > 0) {
      console.warn(
        `[env] Missing optional env vars (dev): ${missingProd.join(', ')}. Account deletion and email sends will be degraded until these are set.`,
      )
    }
  }
}
