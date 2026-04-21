import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * POST /api/shelter/foster-invites/[id]/cancel
 *
 * Shelter-side cancellation. Transitions a pending invite to
 * `cancelled`. The RLS policy "shelter_foster_invites: shelter manage
 * own" already gates this to the owning shelter; we additionally check
 * the row was pending so repeated cancel calls produce a deterministic
 * 409 rather than silently re-writing a terminal state.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('[foster-invites/cancel] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = rateLimit('shelter-foster-invites:cancel', user.id, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.success) return rateLimitResponse(rl)

  // Fetch with RLS active. If the caller doesn't own the invite's shelter,
  // maybeSingle() returns null and we surface 404 without leaking existence.
  const { data: invite, error: fetchErr } = await supabase
    .from('shelter_foster_invites')
    .select('id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (fetchErr) {
    console.error('[foster-invites/cancel] fetch failed:', fetchErr.message)
    return NextResponse.json({ error: 'Failed to load invite' }, { status: 500 })
  }
  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  const inviteRow = invite as { id: string; status: string }

  if (inviteRow.status !== 'pending') {
    return NextResponse.json(
      { error: `Invite is no longer pending (status: ${inviteRow.status})` },
      { status: 409 },
    )
  }

  const { error: updateErr } = await supabase
    .from('shelter_foster_invites')
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .eq('id', inviteRow.id)
    .eq('status', 'pending')

  if (updateErr) {
    console.error('[foster-invites/cancel] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to cancel invite' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
