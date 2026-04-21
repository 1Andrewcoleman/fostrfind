import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { normalizeInviteEmail } from '@/lib/shelter-roster'

/**
 * POST /api/shelter/foster-invites/[id]/accept
 *
 * The FOSTER side of the invite flow. Transitions the invite from
 * `pending` to `accepted` and inserts the corresponding shelter_fosters
 * membership row.
 *
 * Authorization:
 *   - Caller must be authenticated.
 *   - Caller must have a foster_parents row.
 *   - The invite's foster_id must match the caller's foster id, OR the
 *     invite's email must match the caller's foster_parents.email
 *     (case-insensitive). The second path handles pre-signup invites
 *     whose email-claim hasn't run yet.
 *
 * The shelter_fosters INSERT uses the service client because the table
 * has no INSERT policy (by design — membership creation is mediated at
 * the API layer). The invite UPDATE runs under the caller's JWT because
 * the foster-side RLS policy on shelter_foster_invites already permits
 * it.
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
    console.error('[foster-invites/accept] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = rateLimit('shelter-foster-invites:accept', user.id, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.success) return rateLimitResponse(rl)

  // Resolve the caller's foster row.
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

  // Fetch the invite with RLS already applied; if the caller can't see it
  // (doesn't match by foster_id OR email), maybeSingle returns null and we
  // surface a 404 without leaking existence.
  const { data: invite, error: fetchErr } = await supabase
    .from('shelter_foster_invites')
    .select('id, shelter_id, email, foster_id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (fetchErr) {
    console.error('[foster-invites/accept] fetch failed:', fetchErr.message)
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

  // Idempotency + correctness guard. Only pending invites can transition.
  if (inviteRow.status !== 'pending') {
    return NextResponse.json(
      { error: `Invite is no longer pending (status: ${inviteRow.status})` },
      { status: 409 },
    )
  }

  // Belt-and-braces: RLS already filters by foster_id OR email match, but
  // we re-check here so the logic is reviewable in one place without
  // trusting RLS alone.
  const matchesByFosterId = inviteRow.foster_id === fosterId
  const matchesByEmail =
    normalizeInviteEmail(inviteRow.email) === fosterEmail && fosterEmail.length > 0
  if (!matchesByFosterId && !matchesByEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Update invite — foster-side RLS permits this path.
  const now = new Date().toISOString()
  const { error: updateErr } = await supabase
    .from('shelter_foster_invites')
    .update({ status: 'accepted', responded_at: now, foster_id: fosterId })
    .eq('id', inviteRow.id)
    .eq('status', 'pending') // guard against concurrent acceptance

  if (updateErr) {
    console.error('[foster-invites/accept] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
  }

  // Insert roster row via service client. Idempotent — if the foster was
  // already on the roster (e.g. via a prior application acceptance), the
  // upsert is a no-op. A failure here is recoverable: the invite is
  // already accepted, and the auto-add hook will fire the next time this
  // foster is accepted on any application. Log and continue.
  try {
    const svc = createServiceClient()
    const { error: rosterErr } = await svc
      .from('shelter_fosters')
      .upsert(
        {
          shelter_id: inviteRow.shelter_id,
          foster_id: fosterId,
          source: 'invite_accepted',
        },
        { onConflict: 'shelter_id,foster_id', ignoreDuplicates: true },
      )
    if (rosterErr) {
      console.error(
        '[foster-invites/accept] roster upsert failed, continuing:',
        rosterErr.message,
      )
    }
  } catch (e) {
    console.error(
      '[foster-invites/accept] roster upsert threw, continuing:',
      e instanceof Error ? e.message : String(e),
    )
  }

  return NextResponse.json({ success: true })
}
