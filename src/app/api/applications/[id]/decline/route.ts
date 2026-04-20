import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl, sendEmail } from '@/lib/email'
import { ApplicationDeclinedEmail } from '@/emails/application-declined'

interface DeclinedApplicationRow {
  status: string
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
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('[applications/decline] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Fetch application and verify shelter ownership (+ data for the foster notification)
  const { data: application, error: fetchError } = await supabase
    .from('applications')
    .select(
      'status, dog:dogs(name), foster:foster_parents(first_name, last_name, email), shelter:shelters!inner(user_id, name)',
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

  return NextResponse.json({ success: true, applicationId: params.id })
}
