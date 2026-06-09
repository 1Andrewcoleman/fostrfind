import { NextResponse } from 'next/server'
import { getAppUrl, sendEmail } from '@/lib/email'
import { ApplicationDeclinedEmail } from '@/emails/application-declined'
import { requireApiUser } from '@/lib/api-auth'
import { createNotification } from '@/lib/notifications'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

interface DeclinedApplicationRow {
  status: string
  dog: { name: string } | null
  foster: {
    user_id: string
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
  shelter: { user_id: string; name: string | null } | null
}

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await paramsPromise
  const guardErr = validateMutationRequest(request)
  if (guardErr) return guardErr

  // 1. Authenticate the caller (rate limit: 20 declines/min per user)
  const auth = await requireApiUser('applications/decline', {
    key: 'applications:decline',
    limit: 20,
    windowMs: 60_000,
  })
  if (auth.response) return auth.response
  const { supabase, user } = auth

  // 2. Fetch application and verify shelter ownership (+ data for the foster notification)
  const { data: application, error: fetchError } = await supabase
    .from('applications')
    .select(
      'status, dog:dogs(name), foster:foster_parents(user_id, first_name, last_name, email), shelter:shelters!inner(user_id, name)',
    )
    .eq('id', params.id)
    .single<DeclinedApplicationRow>()

  if (fetchError || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (application.shelter?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Idempotency guard — only submitted or reviewing apps can be declined
  if (!['submitted', 'reviewing'].includes(application.status)) {
    return NextResponse.json(
      { error: `Cannot decline an application with status "${application.status}"` },
      { status: 409 },
    )
  }

  // 4. Update application status to declined (dog stays available)
  const { error: updateError } = await supabase
    .from('applications')
    .update({ status: 'declined' })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
  }

  // 5. Fire-and-forget foster notification (email outage can't fail the decision).
  const fosterEmail = application.foster?.email
  const dogName = application.dog?.name
  const shelterName = application.shelter?.name
  if (application.foster?.user_id) {
    void createNotification({
      userId: application.foster.user_id,
      type: 'application_declined',
      title: `Your application for ${dogName || 'this dog'} was not accepted`,
      link: `/foster/applications`,
      metadata: { applicationId: params.id },
    })
  }

  if (fosterEmail && dogName && shelterName) {
    const fosterName = `${application.foster?.first_name ?? ''} ${application.foster?.last_name ?? ''}`.trim()
    void sendEmail({
      to: fosterEmail,
      subject: `An update on your application for ${dogName}`,
      react: ApplicationDeclinedEmail({
        fosterName: fosterName || 'there',
        dogName,
        shelterName,
        browseUrl: `${getAppUrl()}/foster/browse`,
      }),
    })
  }

  return privateJson({ success: true, applicationId: params.id })
}
