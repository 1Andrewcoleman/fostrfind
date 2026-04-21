import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { normalizeInviteEmail } from '@/lib/shelter-roster'

/**
 * POST /api/shelter/foster-invites/[id]/decline
 *
 * Foster-side decline. Transitions invite from `pending` to `declined`.
 * Does NOT create any shelter_fosters row. Mirrors /accept but without
 * the service-role membership insert.
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
    console.error('[foster-invites/decline] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = rateLimit('shelter-foster-invites:decline', user.id, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.success) return rateLimitResponse(rl)

  const { data: fosterRow } = await supabase
    .from('foster_parents')
    .select('id, email')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!fosterRow) {
    return NextResponse.json({ error: 'Caller is not a foster' }, { status: 403 })
  }
  const fosterId = (fosterRow as { id: string; email: string }).id
  const fosterEmail = normalizeInviteEmail(
    (fosterRow as { id: string; email: string }).email,
  )

  const { data: invite, error: fetchErr } = await supabase
    .from('shelter_foster_invites')
    .select('id, shelter_id, email, foster_id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (fetchErr) {
    console.error('[foster-invites/decline] fetch failed:', fetchErr.message)
    return NextResponse.json({ error: 'Failed to load invite' }, { status: 500 })
  }
  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  const inviteRow = invite as {
    id: string
    shelter_id: string
    email: string
    foster_id: string | null
    status: string
  }

  if (inviteRow.status !== 'pending') {
    return NextResponse.json(
      { error: `Invite is no longer pending (status: ${inviteRow.status})` },
      { status: 409 },
    )
  }

  const matchesByFosterId = inviteRow.foster_id === fosterId
  const matchesByEmail =
    normalizeInviteEmail(inviteRow.email) === fosterEmail && fosterEmail.length > 0
  if (!matchesByFosterId && !matchesByEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: updateErr } = await supabase
    .from('shelter_foster_invites')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
      // Record who declined so the shelter can see their email was the
      // one that responded — useful if multiple fosters share an email
      // edge case (rare, but cheap to record).
      foster_id: fosterId,
    })
    .eq('id', inviteRow.id)
    .eq('status', 'pending')

  if (updateErr) {
    console.error('[foster-invites/decline] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to decline invite' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
