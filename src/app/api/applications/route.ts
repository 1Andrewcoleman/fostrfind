import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { applicationCreateSchema } from '@/lib/schemas'
import { createNotification } from '@/lib/notifications'
import { getAppUrl, sendEmail } from '@/lib/email'
import { ApplicationSubmittedEmail } from '@/emails/application-submitted'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

interface ApplicationDogRow {
  id: string
  shelter_id: string
  status: string
  name: string | null
  shelter: { user_id: string; email: string | null; name: string | null } | null
}

function displayName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim()
}

/**
 * POST /api/applications — submit a structured foster application.
 *
 * The previous implementation ran a direct `applications.insert` from
 * the client (`DogDetailFull`), which made it impossible to fire a
 * service-role notification on submit and skipped server-side
 * validation. This route consolidates auth, rate limiting, validation,
 * dog/shelter integrity, duplicate prevention, and insertion in one
 * place — Step 48 (Notification Center) bolts the shelter notification
 * onto the success path here.
 *
 * Status contract:
 *   - 201: created (application row returned)
 *   - 400: malformed JSON or shelter_id ≠ dog.shelter_id
 *   - 401: unauthenticated
 *   - 404: foster profile missing or dog not found
 *   - 409: dog not available, duplicate application, or unique-violation
 *   - 422: schema validation failure (per-field errors in `details`)
 *   - 429: rate limit exceeded
 *   - 503: auth service unavailable
 */
export async function POST(request: Request): Promise<NextResponse> {
  const guardErr = validateMutationRequest(request)
  if (guardErr) return guardErr

  // 10 submissions/min per foster — generous enough for re-tries on
  // validation errors, tight enough to blunt scripted spam.
  const auth = await requireApiUser('applications/create', {
    key: 'applications:create',
    limit: 10,
    windowMs: 60_000,
  })
  if (auth.response) return auth.response
  const { supabase, user } = auth

  // Resolve foster_parents row before parsing the body so users without
  // a profile get a clear 404 instead of a generic validation error.
  const { data: foster, error: fosterError } = await supabase
    .from('foster_parents')
    .select('id, first_name, last_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (fosterError) {
    console.error('[applications/create] foster lookup failed:', fosterError.message)
    return NextResponse.json({ error: 'Failed to load foster profile' }, { status: 500 })
  }
  if (!foster) {
    return NextResponse.json({ error: 'Foster profile not found' }, { status: 404 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = applicationCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }
  const data = parsed.data

  // Verify the dog exists, belongs to the claimed shelter, and is
  // currently available. RLS would refuse the INSERT for a
  // non-available dog, but a shaped JSON response here is more
  // actionable for the client than a generic 500/permission error.
  const { data: dog, error: dogError } = await supabase
    .from('dogs')
    .select('id, shelter_id, status, name, shelter:shelters!inner(user_id, email, name)')
    .eq('id', data.dog_id)
    .maybeSingle<ApplicationDogRow>()

  if (dogError) {
    console.error('[applications/create] dog lookup failed:', dogError.message)
    return NextResponse.json({ error: 'Failed to load dog' }, { status: 500 })
  }
  if (!dog) {
    return NextResponse.json({ error: 'Dog not found' }, { status: 404 })
  }
  if (dog.shelter_id !== data.shelter_id) {
    return NextResponse.json({ error: 'Dog does not belong to that shelter' }, { status: 400 })
  }
  if (dog.status !== 'available') {
    return NextResponse.json(
      { error: 'This dog is no longer available for applications' },
      { status: 409 },
    )
  }

  // Defense-in-depth duplicate check. The DB unique constraint
  // (`applications_dog_foster_unique`) is the real guard, but querying
  // first lets us distinguish "already actively applied" (409) from a
  // re-apply after withdrawal (UPDATE the existing row) before hitting
  // Postgres.
  const { data: existing, error: existingError } = await supabase
    .from('applications')
    .select('id, status')
    .eq('dog_id', data.dog_id)
    .eq('foster_id', foster.id)
    .maybeSingle()

  if (existingError) {
    console.error('[applications/create] duplicate check failed:', existingError.message)
    return NextResponse.json({ error: 'Failed to check existing applications' }, { status: 500 })
  }
  if (existing && existing.status !== 'withdrawn') {
    return NextResponse.json(
      { error: 'You have already applied for this dog' },
      { status: 409 },
    )
  }

  const cleanedNote = data.note ? sanitizeMultiline(data.note) : ''

  const insertPayload = {
    dog_id: data.dog_id,
    shelter_id: data.shelter_id,
    foster_id: foster.id,
    status: 'submitted',
    available_from: data.available_from,
    available_until: data.available_until && data.available_until !== ''
      ? data.available_until
      : null,
    why_this_dog: sanitizeMultiline(data.why_this_dog),
    emergency_contact_name: sanitizeText(data.emergency_contact_name),
    emergency_contact_phone: sanitizeText(data.emergency_contact_phone),
    responsibilities_acknowledged: true,
    note: cleanedNote === '' ? null : cleanedNote,
  }

  // Re-apply path: a prior application was withdrawn. UPDATE the same
  // row so we (a) never collide with the dog/foster unique constraint
  // and (b) preserve the original `created_at` for audit. The shelter
  // sees the row return to `submitted` in their queue.
  const isReapply = !!existing && existing.status === 'withdrawn'

  const mutation = isReapply
    ? supabase
        .from('applications')
        .update(insertPayload)
        .eq('id', existing.id)
        .select()
        .single()
    : supabase
        .from('applications')
        .insert(insertPayload)
        .select()
        .single()

  const { data: application, error: mutationError } = await mutation

  if (mutationError || !application) {
    // Map Postgres unique-violation to 409 — covers a rare race where
    // a parallel request inserted between the duplicate-check and this
    // insert. `code` is included on Supabase PostgrestError instances.
    const code = (mutationError as { code?: string } | null)?.code
    if (code === '23505') {
      return NextResponse.json(
        { error: 'You have already applied for this dog' },
        { status: 409 },
      )
    }
    console.error('[applications/create] mutation failed:', mutationError?.message)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }

  const shelterUserId = dog.shelter?.user_id
  if (shelterUserId) {
    const fosterName = displayName(foster.first_name, foster.last_name) || 'A foster'
    const dogName = dog.name || 'this dog'
    void createNotification({
      userId: shelterUserId,
      type: 'application_submitted',
      title: `New application from ${fosterName} for ${dogName}`,
      link: `/shelter/applications/${application.id}`,
      metadata: { applicationId: application.id, dogId: data.dog_id, fosterId: foster.id },
    })

    // Email alongside the in-app notification. Both are fire-and-forget
    // (`void`) — sendEmail() swallows its own errors so a Resend outage
    // cannot fail the application submit, mirroring the accept route.
    // Per-foster abuse is already gated by the route's rate limit (10/min)
    // and the unique-application guard above.
    const shelterEmail = dog.shelter?.email
    const shelterName = dog.shelter?.name
    if (shelterEmail && shelterName) {
      void sendEmail({
        to: shelterEmail,
        subject: `New foster application from ${fosterName} for ${dogName}`,
        react: ApplicationSubmittedEmail({
          shelterName,
          dogName,
          fosterName,
          applicationUrl: `${getAppUrl()}/shelter/applications/${application.id}`,
        }),
      })
    }
  }

  // Return only the fields the client actually needs — avoids leaking internal
  // columns (shelter_note, emergency contact, etc.) in the create response.
  return privateJson(
    {
      id: application.id,
      status: application.status,
      dog_id: application.dog_id,
      shelter_id: application.shelter_id,
      foster_id: application.foster_id,
      created_at: application.created_at,
    },
    { status: isReapply ? 200 : 201 },
  )
}
