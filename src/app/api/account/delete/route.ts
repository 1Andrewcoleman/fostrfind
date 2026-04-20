import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

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
 *   3. For every shelter or foster row owned by the user:
 *      a. Cancels any active applications (submitted / reviewing / accepted
 *         get flipped to `declined`). `completed` history is preserved.
 *      b. Anonymises identifying columns in place so remaining joined rows
 *         (ratings, messages, completed applications) still render.
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

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Shelter side cleanup
  const { data: shelterRows } = await admin
    .from('shelters')
    .select('id')
    .eq('user_id', user.id)

  if (shelterRows && shelterRows.length > 0) {
    const shelterIds = shelterRows.map((r) => r.id)

    await admin
      .from('applications')
      .update({ status: 'declined' })
      .in('shelter_id', shelterIds)
      .in('status', ['submitted', 'reviewing', 'accepted'])

    await admin
      .from('shelters')
      .update({
        name: 'Deleted Shelter',
        email: 'deleted@fostrfix.invalid',
        phone: null,
        location: 'Unknown',
        bio: null,
        website: null,
        instagram: null,
        ein: null,
        logo_url: null,
      })
      .in('id', shelterIds)
  }

  // Foster side cleanup
  const { data: fosterRows } = await admin
    .from('foster_parents')
    .select('id')
    .eq('user_id', user.id)

  if (fosterRows && fosterRows.length > 0) {
    const fosterIds = fosterRows.map((r) => r.id)

    await admin
      .from('applications')
      .update({ status: 'declined' })
      .in('foster_id', fosterIds)
      .in('status', ['submitted', 'reviewing', 'accepted'])

    await admin
      .from('foster_parents')
      .update({
        first_name: 'Deleted',
        last_name: 'User',
        email: 'deleted@fostrfix.invalid',
        phone: null,
        bio: null,
        avatar_url: null,
        other_pets_info: null,
        children_info: null,
      })
      .in('id', fosterIds)
  }

  // Finally, remove the auth user. Schema cascades handle the rest.
  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id)
  if (deleteErr) {
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
