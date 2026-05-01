import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createNotification } from '@/lib/notifications'

interface ReviewApplicationRow {
  status: string
  dog: { name: string | null } | null
  foster: { user_id: string } | null
  shelter: { user_id: string } | null
}

export async function POST(
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
    console.error('[applications/review] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = rateLimit('applications:review', user.id, { limit: 30, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

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
    return NextResponse.json({ success: true, applicationId: params.id })
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
      link: `/foster/applications/${params.id}`,
      metadata: { applicationId: params.id },
    })
  }

  return NextResponse.json({ success: true, applicationId: params.id })
}
