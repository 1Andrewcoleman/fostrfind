import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { fosterDisplayName, resolveFosterInviteResponse } from '@/lib/shelter-roster'
import { createNotification } from '@/lib/notifications'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

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

  const resolved = await resolveFosterInviteResponse(
    supabase,
    user.id,
    params.id,
    'foster-invites/accept',
  )
  if (resolved.response) return resolved.response
  const { foster, invite: inviteRow } = resolved
  const fosterId = foster.id

  const { data: shelterRow, error: shelterErr } = await supabase
    .from('shelters')
    .select('user_id, name')
    .eq('id', inviteRow.shelter_id)
    .maybeSingle()

  if (shelterErr) {
    console.error('[foster-invites/accept] shelter fetch failed:', shelterErr.message)
  }

  // Update invite — foster-side RLS permits this path.
  // .select('id') + .maybeSingle() lets us detect the concurrent-acceptance
  // race: if another tab/request already accepted, the .eq('status','pending')
  // filter matches 0 rows and maybeSingle returns null data with no error.
  const now = new Date().toISOString()
  const { data: updatedRow, error: updateErr } = await supabase
    .from('shelter_foster_invites')
    .update({ status: 'accepted', responded_at: now, foster_id: fosterId })
    .eq('id', inviteRow.id)
    .eq('status', 'pending') // guard against concurrent acceptance
    .select('id')
    .maybeSingle()

  if (updateErr) {
    console.error('[foster-invites/accept] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
  }
  if (!updatedRow) {
    // Concurrent acceptance won — invite is no longer pending. Return 409
    // so the client knows the action was already completed by another request.
    return NextResponse.json(
      { error: 'Invite was already responded to (possible duplicate request)' },
      { status: 409 },
    )
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

  const shelter = shelterRow as { user_id: string; name: string | null } | null
  if (shelter?.user_id) {
    const fosterName = fosterDisplayName(foster)
    void createNotification({
      userId: shelter.user_id,
      type: 'invite_accepted',
      title: `${fosterName} accepted your roster invitation`,
      link: '/shelter/fosters',
      metadata: { inviteId: inviteRow.id, fosterId, shelterId: inviteRow.shelter_id },
    })
  }

  return privateJson({ success: true })
}
