import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAppUrl, sendEmail } from '@/lib/email'
import { ApplicationAcceptedEmail } from '@/emails/application-accepted'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

/** Minimal shape of the joined application fetch used below. Typed
 *  narrowly so the email-payload field access stays lint-clean. */
interface AcceptedApplicationRow {
  status: string
  dog_id: string
  foster_id: string
  shelter_id: string
  dog: { name: string } | null
  foster: { first_name: string | null; last_name: string | null; email: string | null } | null
  shelter: { user_id: string; name: string | null } | null
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = await createClient()

  // 1. Authenticate the caller
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('[applications/accept] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit: 20 accept/min per shelter user.
  const rl = rateLimit('applications:accept', user.id, { limit: 20, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  // 2. Fetch application with shelter ownership + data needed for the
  //    foster notification email, all in one round-trip.
  const { data: application, error: fetchError } = await supabase
    .from('applications')
    .select(
      'status, dog_id, foster_id, shelter_id, dog:dogs(name), foster:foster_parents(first_name, last_name, email), shelter:shelters!inner(user_id, name)',
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

  // 4. Atomically flip application -> accepted AND dog -> pending.
  //    The RPC wraps both UPDATEs in one Postgres function body so they
  //    either both commit or both roll back. See migration
  //    20240110000000_atomic_transitions.sql. The function is
  //    SECURITY DEFINER, so auth + ownership + idempotency above are
  //    still the authorization boundary.
  const { error: rpcError } = await supabase.rpc('accept_application', {
    app_id: params.id,
  })

  if (rpcError) {
    return NextResponse.json({ error: 'Failed to accept application' }, { status: 500 })
  }

  // 5. Auto-add the foster to the shelter's roster (Phase 6.2). Idempotent:
  //    the composite PK + ignoreDuplicates makes re-acceptance a no-op.
  //    Wrapped so an RLS / env / network failure logs and DOES NOT fail
  //    the acceptance — the user-visible action (application accepted)
  //    has already succeeded via the RPC above, and the roster row is a
  //    secondary side effect.
  try {
    const svc = createServiceClient()
    const { error: rosterError } = await svc
      .from('shelter_fosters')
      .upsert(
        {
          shelter_id: application.shelter_id,
          foster_id: application.foster_id,
          source: 'application_accepted',
        },
        { onConflict: 'shelter_id,foster_id', ignoreDuplicates: true },
      )
    if (rosterError) {
      console.error('[applications/accept] roster upsert failed, continuing:', rosterError.message)
    }
  } catch (e) {
    console.error(
      '[applications/accept] roster upsert threw, continuing:',
      e instanceof Error ? e.message : String(e),
    )
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
