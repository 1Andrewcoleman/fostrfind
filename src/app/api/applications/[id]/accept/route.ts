import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl, sendEmail } from '@/lib/email'
import { ApplicationAcceptedEmail } from '@/emails/application-accepted'

/** Minimal shape of the joined application fetch used below. Typed
 *  narrowly so the email-payload field access stays lint-clean. */
interface AcceptedApplicationRow {
  status: string
  dog_id: string
  dog: { name: string } | null
  foster: { first_name: string | null; last_name: string | null; email: string | null } | null
  shelter: { user_id: string; name: string | null } | null
}

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

  // 2. Fetch application with shelter ownership + data needed for the
  //    foster notification email, all in one round-trip.
  const { data: application, error: fetchError } = await supabase
    .from('applications')
    .select(
      'status, dog_id, dog:dogs(name), foster:foster_parents(first_name, last_name, email), shelter:shelters!inner(user_id, name)',
    )
    .eq('id', params.id)
    .single<AcceptedApplicationRow>()

  if (fetchError || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (application.shelter?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Idempotency guard — only submitted or reviewing apps can be accepted
  if (!['submitted', 'reviewing'].includes(application.status)) {
    return NextResponse.json(
      { error: `Cannot accept an application with status "${application.status}"` },
      { status: 409 },
    )
  }

  // 4. Update application status to accepted
  const { error: updateError } = await supabase
    .from('applications')
    .update({ status: 'accepted' })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
  }

  // 5. Set the dog's status to pending
  const { error: dogError } = await supabase
    .from('dogs')
    .update({ status: 'pending' })
    .eq('id', application.dog_id)

  if (dogError) {
    return NextResponse.json({ error: 'Application accepted but failed to update dog status' }, { status: 500 })
  }

  // 6. Fire-and-forget: notify the foster that they were accepted.
  //    An email outage must not fail the user's action, hence `void`
  //    + no await. sendEmail() already swallows send errors.
  const fosterEmail = application.foster?.email
  const dogName = application.dog?.name
  const shelterName = application.shelter?.name
  if (fosterEmail && dogName && shelterName) {
    const fosterName = `${application.foster?.first_name ?? ''} ${application.foster?.last_name ?? ''}`.trim()
    void sendEmail({
      to: fosterEmail,
      subject: `Great news — your application for ${dogName} was accepted`,
      react: ApplicationAcceptedEmail({
        fosterName: fosterName || 'there',
        dogName,
        shelterName,
        threadUrl: `${getAppUrl()}/foster/messages/${params.id}`,
      }),
    })
  }

  return NextResponse.json({ success: true, applicationId: params.id })
}
