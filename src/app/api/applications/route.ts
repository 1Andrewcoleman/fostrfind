import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { applicationCreateSchema } from '@/lib/schemas'

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
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('[applications/create] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 10 submissions/min per foster — generous enough for re-tries on
  // validation errors, tight enough to blunt scripted spam.
  const rl = rateLimit('applications:create', user.id, { limit: 10, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  // Resolve foster_parents row before parsing the body so users without
  // a profile get a clear 404 instead of a generic validation error.
  const { data: foster, error: fosterError } = await supabase
    .from('foster_parents')
    .select('id')
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
    .select('id, shelter_id, status')
    .eq('id', data.dog_id)
    .maybeSingle()

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
  // first lets us return a clean 409 before hitting Postgres.
  const { data: existing, error: existingError } = await supabase
    .from('applications')
    .select('id')
    .eq('dog_id', data.dog_id)
    .eq('foster_id', foster.id)
    .maybeSingle()

  if (existingError) {
    console.error('[applications/create] duplicate check failed:', existingError.message)
    return NextResponse.json({ error: 'Failed to check existing applications' }, { status: 500 })
  }
  if (existing) {
    return NextResponse.json(
      { error: 'You have already applied for this dog' },
      { status: 409 },
    )
  }

  const cleanedNote = data.note ? sanitizeMultiline(data.note) : ''

  const { data: application, error: insertError } = await supabase
    .from('applications')
    .insert({
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
    })
    .select()
    .single()

  if (insertError || !application) {
    // Map Postgres unique-violation to 409 — covers a rare race where
    // a parallel request inserted between the duplicate-check and this
    // insert. `code` is included on Supabase PostgrestError instances.
    const code = (insertError as { code?: string } | null)?.code
    if (code === '23505') {
      return NextResponse.json(
        { error: 'You have already applied for this dog' },
        { status: 409 },
      )
    }
    console.error('[applications/create] insert failed:', insertError?.message)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }

  // Step 48 will fire a service-role notification + email here.

  return NextResponse.json(application, { status: 201 })
}
