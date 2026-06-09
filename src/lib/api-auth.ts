import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse, type RateLimitOptions } from '@/lib/rate-limit'

/** The user-scoped server client, typed via `createClient` so a future
 *  `Database` generic on it propagates to every route automatically. */
export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Per-route rate limit applied as part of the auth preamble. `key` is the
 * route's bucket name (e.g. 'applications:accept'); the identifier is
 * always the authenticated user id.
 */
export interface ApiRateLimit extends RateLimitOptions {
  key: string
}

export type ApiAuthResult =
  | { response: NextResponse; supabase?: never; user?: never }
  | { response?: never; supabase: ServerSupabaseClient; user: User }

/**
 * Shared auth preamble for authenticated API route handlers. Runs the exact
 * guard sequence every mutation route previously inlined:
 *
 *   1. `createClient()` + `getUser()` — 503 `Authentication service
 *      unavailable` if the auth service errors (logged as
 *      `[<logTag>] getUser failed: <message>`), 401 `Unauthorized` if there
 *      is no session.
 *   2. Optional per-user rate limit — 429 via `rateLimitResponse()` when
 *      `limit` is provided and exhausted.
 *
 * Returns `{ response }` when a guard fails, otherwise `{ supabase, user }`.
 *
 *   const auth = await requireApiUser('applications/accept', {
 *     key: 'applications:accept', limit: 20, windowMs: 60_000,
 *   })
 *   if (auth.response) return auth.response
 *   const { supabase, user } = auth
 *
 * Routes that need additional guards between authentication and rate
 * limiting (e.g. onboarding's email-verification checks, which must return
 * 400/403 before any 429) call this without `limit` and apply
 * `rateLimit()` themselves at the right point in their sequence.
 *
 * `logTag` and `limit.key` look redundant but are NOT derivable from each
 * other — both are load-bearing legacy identifiers carried over from the
 * inlined preambles (e.g. tag `feedback` pairs with key `feedback:post`,
 * tag `foster-invites/create` with key `shelter-foster-invites:create`).
 * Changing a tag breaks log grep-ability; changing a key silently resets
 * that route's production rate-limit bucket.
 */
export async function requireApiUser(
  logTag: string,
  limit?: ApiRateLimit,
): Promise<ApiAuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error(`[${logTag}] getUser failed:`, authError.message)
    return {
      response: NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503 },
      ),
    }
  }
  if (!user) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (limit) {
    const rl = rateLimit(limit.key, user.id, {
      limit: limit.limit,
      windowMs: limit.windowMs,
    })
    if (!rl.success) return { response: rateLimitResponse(rl) }
  }

  return { supabase, user }
}
