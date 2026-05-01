import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createNotification } from '@/lib/notifications'

/**
 * DELETE /api/foster/shelter-roster/[shelterId]
 *
 * The FOSTER-side "remove me from this shelter's roster" action. RLS
 * on shelter_fosters already restricts DELETE to rows where foster_id
 * belongs to the caller, so the route layer is thin — it exists for:
 *
 *   - A stable client-facing URL (clients shouldn't touch the table
 *     directly).
 *   - Rate limiting.
 *   - Consistent 404/200 shape regardless of whether the row existed;
 *     RLS alone would return 0 rows affected for both "not mine" and
 *     "doesn't exist" and leak nothing useful to the caller.
 *
 * This does NOT touch active applications. Removing yourself from the
 * roster is a forward-looking signal ("don't contact me for new
 * placements") — any in-flight application keeps its own status.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { shelterId: string } },
): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('[shelter-roster/delete] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = rateLimit('shelter-roster:delete', user.id, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.success) return rateLimitResponse(rl)

  // Resolve the caller's foster_parents row. RLS also gates the DELETE
  // below, but we need the foster_id to make the WHERE clause selective
  // enough that the DELETE fails fast rather than scanning the whole
  // table when the row doesn't exist.
  const { data: fosterRow } = await supabase
    .from('foster_parents')
    .select('id, first_name, last_name')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!fosterRow) {
    return NextResponse.json({ error: 'Caller is not a foster' }, { status: 403 })
  }
  const foster = fosterRow as { id: string; first_name: string | null; last_name: string | null }
  const fosterId = foster.id

  // Precheck: does a row exist for this (shelter, foster) pair? The
  // extra round-trip is worth it so we can return a deterministic 404
  // on "already removed" — otherwise the client can't tell idempotent
  // re-click from silent failure.
  const { data: existing } = await supabase
    .from('shelter_fosters')
    .select('shelter_id')
    .eq('shelter_id', params.shelterId)
    .eq('foster_id', fosterId)
    .maybeSingle()
  if (!existing) {
    return NextResponse.json(
      { error: 'You are not on this shelter’s roster' },
      { status: 404 },
    )
  }

  const { data: shelterRow, error: shelterErr } = await supabase
    .from('shelters')
    .select('user_id')
    .eq('id', params.shelterId)
    .maybeSingle()

  if (shelterErr) {
    console.error('[shelter-roster/delete] shelter fetch failed:', shelterErr.message)
  }

  const { error: deleteErr } = await supabase
    .from('shelter_fosters')
    .delete()
    .eq('shelter_id', params.shelterId)
    .eq('foster_id', fosterId)

  if (deleteErr) {
    console.error('[shelter-roster/delete] delete failed:', deleteErr.message)
    return NextResponse.json({ error: 'Failed to leave roster' }, { status: 500 })
  }

  const shelter = shelterRow as { user_id: string } | null
  if (shelter?.user_id) {
    const fosterName =
      [foster.first_name, foster.last_name].filter(Boolean).join(' ').trim() || 'A foster'
    void createNotification({
      userId: shelter.user_id,
      type: 'roster_left',
      title: `${fosterName} left your foster roster`,
      link: '/shelter/fosters',
      metadata: { shelterId: params.shelterId, fosterId },
    })
  }

  return NextResponse.json({ success: true })
}
