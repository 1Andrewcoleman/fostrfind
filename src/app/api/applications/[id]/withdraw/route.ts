import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * Foster withdrawal of their own application.
 *
 * Only allowed while the application is still `submitted` or `reviewing`
 * (i.e. has not progressed to accepted/declined/completed). Because the
 * application has not affected dog state yet, we DELETE the row rather
 * than introducing a new `withdrawn` status.
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
    .select('*, foster:foster_parents!inner(user_id)')
    .eq('id', params.id)
    .single()

  if (fetchError || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (application.foster.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Guard — only pending-review applications can be withdrawn
  if (!['submitted', 'reviewing'].includes(application.status)) {
    return NextResponse.json(
      { error: `Cannot withdraw an application with status "${application.status}"` },
      { status: 409 },
    )
  }

  // 4. Delete the application row
  const { error: deleteError } = await supabase
    .from('applications')
    .delete()
    .eq('id', params.id)

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to withdraw application' }, { status: 500 })
  }

  return NextResponse.json({ success: true, applicationId: params.id })
}
