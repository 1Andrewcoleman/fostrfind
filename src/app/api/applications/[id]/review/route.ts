import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { createNotification } from '@/lib/notifications'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

interface ReviewApplicationRow {
  status: string
  dog: { name: string | null } | null
  foster: { user_id: string } | null
  shelter: { user_id: string } | null
}

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await paramsPromise
  const guardErr = validateMutationRequest(request)
  if (guardErr) return guardErr

  // 1. Authenticate the caller (rate limit: 30 reviews/min per user)
  const auth = await requireApiUser('applications/review', {
    key: 'applications:review',
    limit: 30,
    windowMs: 60_000,
  })
  if (auth.response) return auth.response
  const { supabase, user } = auth

  // 2. Fetch application and verify shelter ownership
  const { data: application, error: fetchError } = await supabase
    .from('applications')
    .select(
      'status, dog:dogs(name), foster:foster_parents(user_id), shelter:shelters!inner(user_id)',
    )
    .eq('id', params.id)
    .single<ReviewApplicationRow>()

  if (fetchError || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (application.shelter?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Idempotency — if already reviewing, return success without re-writing
  if (application.status === 'reviewing') {
    return privateJson({ success: true, applicationId: params.id })
  }

  // 4. Guard — only submitted applications can transition to reviewing
  if (application.status !== 'submitted') {
    return NextResponse.json(
      { error: `Cannot mark a "${application.status}" application as reviewing` },
      { status: 409 },
    )
  }

  // 5. Update application status to reviewing (no dog status change)
  const { error: updateError } = await supabase
    .from('applications')
    .update({ status: 'reviewing' })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
  }

  if (application.foster?.user_id) {
    const dogName = application.dog?.name || 'your dog'
    void createNotification({
      userId: application.foster.user_id,
      type: 'application_reviewing',
      title: `Your application for ${dogName} is under review`,
      link: `/foster/applications`,
      metadata: { applicationId: params.id },
    })
  }

  return privateJson({ success: true, applicationId: params.id })
}
