import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

// Body is minimal — the typed "DELETE" confirmation is really a UX guard,
// but we still validate it server-side as defense in depth so the route
// can't be triggered by a stray fetch that forgot the confirmation step.
const bodySchema = z.object({
  confirm: z.literal('DELETE'),
})

/**
 * POST /api/account/delete
 *
 * Deletes the caller's account:
 *   1. Authenticates the caller via their session cookie.
 *   2. Validates the typed-DELETE confirmation.
 *   3. Calls `prepare_account_deletion(user_id)` via the service-role client.
 *      This RPC atomically: declines active applications, anonymises shelter
 *      and foster_parents rows. Any failure raises a SQL exception and the
 *      entire cleanup rolls back — auth deletion is only attempted when this
 *      succeeds.
 *   4. Calls `auth.admin.deleteUser(user.id)` with the service role key to
 *      wipe the auth.users row. Schema-level `on delete cascade` on
 *      `shelters.user_id` and `foster_parents.user_id` then removes the
 *      profile rows, which cascades to dogs/applications/messages via
 *      their own FKs.
 *
 * The client is expected to clear the local session cookies and hard-navigate
 * to `/` on 200.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      { error: 'Type DELETE to confirm.' },
      { status: 400 },
    )
  }
  // z.literal already guards this but eslint-unused-vars otherwise trips;
  // the schema parse above is the real check.
  void body

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey || !supabaseUrl.startsWith('http')) {
    return NextResponse.json(
      {
        error:
          'Account deletion is not configured. Please contact support.',
      },
      { status: 500 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) {
    console.error('[account/delete] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Very tight limit — account deletion is a one-shot terminal action;
  // repeated attempts are always abuse, not legitimate user behaviour.
  const rl = rateLimit('account:delete', user.id, { limit: 3, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Step 1: Atomically clean up all PII and decline active applications.
  // The `prepare_account_deletion` RPC wraps everything in a Postgres
  // transaction — if any UPDATE fails, the whole cleanup rolls back and we
  // surface a 500. Auth deletion is only attempted after this succeeds.
  const { error: cleanupErr } = await admin.rpc('prepare_account_deletion', {
    p_user_id: user.id,
  })
  if (cleanupErr) {
    console.error('[account/delete] cleanup RPC failed:', cleanupErr.message)
    return NextResponse.json(
      { error: 'Failed to prepare account deletion. Please contact support.' },
      { status: 500 },
    )
  }

  // Step 2: Remove the auth user. Schema cascades handle the rest.
  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id)
  if (deleteErr) {
    // The cleanup already committed, but auth deletion failed. Support will
    // need to manually remove the auth user. Log with user.id for traceability.
    console.error('[account/delete] auth.admin.deleteUser failed for user:', user.id, deleteErr.message)
    return NextResponse.json(
      { error: 'Failed to delete account. Please contact support.' },
      { status: 500 },
    )
  }

  // Sign out the session-bound server client so response cookies get cleared
  // alongside the client-side `window.location.href = '/'`.
  await supabase.auth.signOut()

  return NextResponse.json({ success: true })
}
