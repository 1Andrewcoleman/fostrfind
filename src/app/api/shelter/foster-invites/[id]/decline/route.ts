import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { fosterDisplayName, resolveFosterInviteResponse } from '@/lib/shelter-roster'
import { createNotification } from '@/lib/notifications'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

/**
 * POST /api/shelter/foster-invites/[id]/decline
 *
 * Foster-side decline. Transitions invite from `pending` to `declined`.
 * Does NOT create any shelter_fosters row. Mirrors /accept but without
 * the service-role membership insert.
 */
export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await paramsPromise
  const guardErr = validateMutationRequest(request)
  if (guardErr) return guardErr

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

  const resolved = await resolveFosterInviteResponse(
    supabase,
    user.id,
    params.id,
    'foster-invites/decline',
  )
  if (resolved.response) return resolved.response
  const { foster, invite: inviteRow } = resolved
  const fosterId = foster.id

  const { data: shelterRow, error: shelterErr } = await supabase
    .from('shelters')
    .select('user_id')
    .eq('id', inviteRow.shelter_id)
    .maybeSingle()

  if (shelterErr) {
    console.error('[foster-invites/decline] shelter fetch failed:', shelterErr.message)
  }

  const { data: updatedRow, error: updateErr } = await supabase
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
    .select('id')
    .maybeSingle()

  if (updateErr) {
    console.error('[foster-invites/decline] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to decline invite' }, { status: 500 })
  }
  if (!updatedRow) {
    return NextResponse.json(
      { error: 'Invite was already responded to (possible duplicate request)' },
      { status: 409 },
    )
  }

  const shelter = shelterRow as { user_id: string } | null
  if (shelter?.user_id) {
    const fosterName = fosterDisplayName(foster)
    void createNotification({
      userId: shelter.user_id,
      type: 'invite_declined',
      title: `${fosterName} declined your roster invitation`,
      link: '/shelter/fosters',
      metadata: { inviteId: inviteRow.id, fosterId, shelterId: inviteRow.shelter_id },
    })
  }

  return privateJson({ success: true })
}
