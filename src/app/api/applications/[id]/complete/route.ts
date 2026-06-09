import { NextResponse } from 'next/server'
import { getAppUrl, sendEmail } from '@/lib/email'
import { PlacementCompletedEmail } from '@/emails/placement-completed'
import { requireApiUser } from '@/lib/api-auth'
import { createNotification } from '@/lib/notifications'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

interface CompletedApplicationRow {
  status: string
  dog_id: string
  dog: { name: string } | null
  foster: {
    user_id: string
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
  shelter: { user_id: string; name: string | null; email: string | null } | null
}

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await paramsPromise
  const guardErr = validateMutationRequest(request)
  if (guardErr) return guardErr

  // 1. Authenticate the caller (rate limit: 10 completes/min per user)
  const auth = await requireApiUser('applications/complete', {
    key: 'applications:complete',
    limit: 10,
    windowMs: 60_000,
  })
  if (auth.response) return auth.response
  const { supabase, user } = auth

  // 2. Fetch application + ownership + both parties' contact info in one hop
  const { data: application, error: fetchError } = await supabase
    .from('applications')
    .select(
      'status, dog_id, dog:dogs(name), foster:foster_parents(user_id, first_name, last_name, email), shelter:shelters!inner(user_id, name, email)',
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

  if (application.foster?.user_id) {
    void createNotification({
      userId: application.foster.user_id,
      type: 'application_completed',
      title: `Your foster placement for ${dogName || 'this dog'} is complete`,
      link: '/foster/history',
      metadata: { applicationId: params.id, dogId: application.dog_id },
    })
  }
  if (application.shelter?.user_id) {
    void createNotification({
      userId: application.shelter.user_id,
      type: 'application_completed',
      title: `${fosterName}'s foster placement for ${dogName || 'this dog'} is complete`,
      link: `/shelter/applications/${params.id}`,
      metadata: { applicationId: params.id, dogId: application.dog_id },
    })
  }

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

  return privateJson({ success: true, applicationId: params.id, promptRating: true })
}
