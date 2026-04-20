import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * DELETE /api/dogs/[id]
 *
 * Permanently removes a dog listing and all cascaded data (applications,
 * messages). The `ON DELETE CASCADE` constraints in the schema handle the
 * cascade automatically.
 *
 * Guards (in order):
 * 1. Authentication — caller must be logged in
 * 2. Dog exists — returns 404 if not found
 * 3. Shelter ownership — caller must own the shelter that listed the dog
 * 4. No active applications — dogs with submitted/reviewing/accepted
 *    applications cannot be deleted to protect in-progress workflows
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = await createClient()

  // 1. Authenticate the caller
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) {
    console.error('[dogs/delete] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Fetch the dog and verify shelter ownership in one query
  const { data: dog, error: fetchError } = await supabase
    .from('dogs')
    .select('id, name, shelter_id, shelter:shelters!inner(user_id)')
    .eq('id', params.id)
    .single()

  if (fetchError || !dog) {
    return NextResponse.json({ error: 'Dog not found' }, { status: 404 })
  }

  const shelter = dog.shelter as unknown as { user_id: string }
  if (shelter.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Prevent deletion if active applications exist
  const { count: activeCount } = await supabase
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('dog_id', params.id)
    .in('status', ['submitted', 'reviewing', 'accepted'])

  if ((activeCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          'This dog has active applications. Decline or complete them before deleting the listing.',
      },
      { status: 409 },
    )
  }

  // 4. Delete the dog — cascades to applications and messages
  const { error: deleteError } = await supabase.from('dogs').delete().eq('id', params.id)

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete dog' }, { status: 500 })
  }

  return NextResponse.json({ success: true, dogId: params.id })
}
