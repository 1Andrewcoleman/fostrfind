import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/dogs/[id]/status
 * Body: { status: 'available' }
 *
 * Manual status override for shelters. Currently supports exactly one
 * transition: pending → available. Used when an accepted placement falls
 * through and the shelter needs to re-list the dog.
 *
 * When a dog is re-listed, any `accepted` application for it is declined
 * so the lifecycle stays consistent (the placement that locked the dog
 * is no longer accepted).
 *
 * Guards (in order):
 * 1. Authentication
 * 2. Dog exists
 * 3. Shelter ownership
 * 4. Body validation — only { status: 'available' } is accepted
 * 5. Transition validation — only pending → available
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = await createClient()

  // 1. Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Fetch dog + verify shelter ownership
  const { data: dog, error: fetchError } = await supabase
    .from('dogs')
    .select('id, status, shelter:shelters!inner(user_id)')
    .eq('id', params.id)
    .single()

  if (fetchError || !dog) {
    return NextResponse.json({ error: 'Dog not found' }, { status: 404 })
  }

  const shelter = dog.shelter as unknown as { user_id: string }
  if (shelter.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Parse + validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const requestedStatus =
    body && typeof body === 'object' && 'status' in body
      ? (body as { status: unknown }).status
      : undefined

  if (requestedStatus !== 'available') {
    return NextResponse.json(
      { error: 'Only transitioning to "available" is supported' },
      { status: 400 },
    )
  }

  // 4. Idempotency — already available
  if (dog.status === 'available') {
    return NextResponse.json({ success: true, dogId: params.id })
  }

  // 5. Transition guard — only pending → available
  if (dog.status !== 'pending') {
    return NextResponse.json(
      { error: `Cannot re-list a "${dog.status}" dog` },
      { status: 409 },
    )
  }

  // 6. Atomically decline any accepted application for this dog AND set
  //    the dog back to available. The RPC wraps both UPDATEs in one
  //    Postgres function body so the placement-falls-through lifecycle
  //    stays consistent even if the second UPDATE would have failed
  //    under the old sequential model. See migration
  //    20240110000000_atomic_transitions.sql.
  const { error: rpcError } = await supabase.rpc('relist_dog', {
    dog_id: params.id,
  })

  if (rpcError) {
    return NextResponse.json({ error: 'Failed to re-list dog' }, { status: 500 })
  }

  return NextResponse.json({ success: true, dogId: params.id })
}
