import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createNotification } from '@/lib/notifications'

interface WithdrawApplicationRow {
  status: string
  dog: { name: string | null } | null
  foster: {
    user_id: string
    first_name: string | null
    last_name: string | null
  } | null
  shelter: { user_id: string } | null
}

function displayName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim()
}

/**
 * Foster withdrawal of their own application.
 *
 * Only allowed while the application is still `submitted` or `reviewing`
 * (i.e. has not progressed to accepted/declined/completed). Withdrawal
 * is a STATUS transition, not a row delete, so the shelter retains a
 * record of who applied and when — see `withdrawn` in
 * `APPLICATION_STATUSES`. A foster can re-apply for the same dog later;
 * the re-apply path in `POST /api/applications` updates the existing
 * withdrawn row back to `submitted` to play nicely with the
 * `applications_dog_foster_unique` constraint.
 */
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
    console.error('[applications/withdraw] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = rateLimit('applications:withdraw', user.id, { limit: 20, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  // 2. Fetch application and verify FOSTER ownership (not shelter — this is the foster's action)
  const { data: application, error: fetchError } = await supabase
    .from('applications')
    .select(
      'status, dog:dogs(name), foster:foster_parents!inner(user_id, first_name, last_name), shelter:shelters!inner(user_id)',
    )
    .eq('id', params.id)
    .single<WithdrawApplicationRow>()

  if (fetchError || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (application.foster?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Guard — only pending-review applications can be withdrawn
  if (!['submitted', 'reviewing'].includes(application.status)) {
    return NextResponse.json(
      { error: `Cannot withdraw an application with status "${application.status}"` },
      { status: 409 },
    )
  }

  // 4. Flip status to withdrawn. Keeping the row preserves shelter-side
  //    history and audit trail; the foster can re-apply via
  //    POST /api/applications, which will UPDATE this same row back to
  //    `submitted` rather than INSERT a colliding duplicate.
  const { error: updateError } = await supabase
    .from('applications')
    .update({ status: 'withdrawn' })
    .eq('id', params.id)

  if (updateError) {
    console.error('[applications/withdraw] update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to withdraw application' }, { status: 500 })
  }

  if (application.shelter?.user_id) {
    const fosterName =
      displayName(application.foster?.first_name, application.foster?.last_name) || 'A foster'
    const dogName = application.dog?.name || 'this dog'
    void createNotification({
      userId: application.shelter.user_id,
      type: 'application_withdrawn',
      title: `${fosterName} withdrew their application for ${dogName}`,
      link: `/shelter/applications/${params.id}`,
      metadata: { applicationId: params.id },
    })
  }

  return NextResponse.json({ success: true, applicationId: params.id })
}
