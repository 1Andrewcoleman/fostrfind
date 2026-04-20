import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl, sendEmail } from '@/lib/email'
import { PlacementCompletedEmail } from '@/emails/placement-completed'

interface CompletedApplicationRow {
  status: string
  dog_id: string
  dog: { name: string } | null
  foster: { first_name: string | null; last_name: string | null; email: string | null } | null
  shelter: { user_id: string; name: string | null; email: string | null } | null
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
    console.error('[applications/complete] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Fetch application + ownership + both parties' contact info in one hop
  const { data: application, error: fetchError } = await supabase
    .from('applications')
    .select(
      'status, dog_id, dog:dogs(name), foster:foster_parents(first_name, last_name, email), shelter:shelters!inner(user_id, name, email)',
    )
    .eq('id', params.id)
    .single<CompletedApplicationRow>()

  if (fetchError || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (application.shelter?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Idempotency guard — only accepted apps can be completed
  if (application.status !== 'accepted') {
    return NextResponse.json(
      { error: `Cannot complete an application with status "${application.status}"` },
      { status: 409 },
    )
  }

  // 4. Atomically flip application -> completed AND dog -> placed.
  //    The RPC wraps both UPDATEs in one Postgres function body so they
  //    either both commit or both roll back. See migration
  //    20240110000000_atomic_transitions.sql.
  const { error: rpcError } = await supabase.rpc('complete_application', {
    app_id: params.id,
  })

  if (rpcError) {
    return NextResponse.json({ error: 'Failed to complete application' }, { status: 500 })
  }

  // 6. Fire-and-forget: notify BOTH parties. Copy is identical; the
  //    template flips second-person phrasing based on `recipientRole`
  //    and points each recipient at their own "rate the other party"
  //    page.
  const fosterName =
    `${application.foster?.first_name ?? ''} ${application.foster?.last_name ?? ''}`.trim() ||
    'Foster'
  const shelterName = application.shelter?.name ?? 'Shelter'
  const dogName = application.dog?.name
  const appUrl = getAppUrl()

  if (dogName) {
    if (application.foster?.email) {
      void sendEmail({
        to: application.foster.email,
        subject: `${dogName}'s foster placement is complete`,
        react: PlacementCompletedEmail({
          recipientName: fosterName,
          recipientRole: 'foster',
          dogName,
          fosterName,
          shelterName,
          // Foster rates the shelter via a Step 20 flow that doesn't
          // exist yet (roadmap). Pointing at the thread as the best
          // available destination; the email template labels this as
          // "leave a rating for the shelter" but clicking it just
          // deep-links into the completed thread for now.
          rateUrl: `${appUrl}/foster/history`,
        }),
      })
    }
    if (application.shelter?.email) {
      void sendEmail({
        to: application.shelter.email,
        subject: `${dogName}'s foster placement is complete`,
        react: PlacementCompletedEmail({
          recipientName: shelterName,
          recipientRole: 'shelter',
          dogName,
          fosterName,
          shelterName,
          // Shelter rating flow DOES exist — the Rate Foster button
          // on /shelter/applications/[id] (Step 4 work).
          rateUrl: `${appUrl}/shelter/applications/${params.id}`,
        }),
      })
    }
  }

  return NextResponse.json({ success: true, applicationId: params.id, promptRating: true })
}
