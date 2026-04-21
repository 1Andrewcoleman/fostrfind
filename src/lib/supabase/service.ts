import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { DEV_MODE } from '@/lib/constants'

/**
 * Supabase client bound to the **service role key**. Bypasses RLS. Use this
 * ONLY for the handful of server-side writes that must be authorised by
 * application logic rather than by the caller's JWT:
 *
 *   1. Upsert into `shelter_fosters` when an application is accepted
 *      (`src/app/api/applications/[id]/accept/route.ts`).
 *   2. Insert into `shelter_fosters` when a foster accepts a
 *      `shelter_foster_invites` row
 *      (`src/app/api/shelter/foster-invites/[id]/accept/route.ts`).
 *   3. Email-match claim on `shelter_foster_invites` during foster
 *      onboarding (claim pending invites whose email matches the newly
 *      created `foster_parents.email`).
 *
 * Anything else should keep using the cookie-authenticated `createClient()`
 * from `@/lib/supabase/server` so row-level security stays in charge.
 *
 * Behaviour:
 *   - In production with real env, returns a service-role-bound client.
 *   - In production with missing env, throws — callers catch so the main
 *     flow (accept / onboarding / invite-accept) continues degraded.
 *   - In `DEV_MODE` (no real Supabase URL configured), throws so callers
 *     can skip the write entirely. Consistent with every other backend
 *     operation short-circuiting in DEV_MODE.
 *
 * Tests should mock this module; see `__mocks__` in the consuming routes.
 */
export function createServiceClient(): SupabaseClient {
  if (DEV_MODE) {
    throw new Error('[service-client] Not available in DEV_MODE (no real Supabase configured)')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      '[service-client] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    )
  }

  return createAdminClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
