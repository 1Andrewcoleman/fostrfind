import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = await createClient()

  // 1. Authenticate the caller
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Fetch application and verify shelter ownership
  const { data: application, error: fetchError } = await supabase
    .from('applications')
    .select('*, shelter:shelters!inner(user_id)')
    .eq('id', params.id)
    .single()

  if (fetchError || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (application.shelter.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Idempotency guard — only accepted apps can be completed
  if (application.status !== 'accepted') {
    return NextResponse.json(
      { error: `Cannot complete an application with status "${application.status}"` },
      { status: 409 },
    )
  }

  // 4. Update application status to completed
  const { error: updateError } = await supabase
    .from('applications')
    .update({ status: 'completed' })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
  }

  // 5. Set the dog's status to placed
  const { error: dogError } = await supabase
    .from('dogs')
    .update({ status: 'placed' })
    .eq('id', application.dog_id)

  if (dogError) {
    return NextResponse.json({ error: 'Application completed but failed to update dog status' }, { status: 500 })
  }

  return NextResponse.json({ success: true, applicationId: params.id, promptRating: true })
}
