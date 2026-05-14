import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { fosterOnboardingServerSchema } from '@/lib/schemas'
import { normalizeInviteEmail } from '@/lib/shelter-roster'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

/**
 * POST /api/onboarding/foster — create the caller's foster profile.
 *
 * Replaces the client-side `supabase.from('foster_parents').insert(...)`
 * the previous onboarding page issued from the browser. The route also
 * absorbs the post-insert invite-claim step: any pending
 * `shelter_foster_invites` rows whose `email` matches the new foster's
 * email get their `foster_id` populated so the foster sees them in
 * `/foster/invites` immediately. This UPDATE runs under the caller's
 * JWT and is gated by RLS — the route does not use the service-role
 * client.
 *
 * Status contract:
 *   - 201: created (sanitized foster row returned)
 *   - 400: malformed JSON or account email unavailable
 *   - 401: unauthenticated
 *   - 403: email not yet confirmed (user.email_confirmed_at is null)
 *   - 409: caller already has a foster_parents row
 *   - 422: schema validation failure (per-field errors in `details`)
 *   - 429: rate limit exceeded
 *   - 500: insert failure
 *   - 503: auth service unavailable
 */
export async function POST(request: Request): Promise<NextResponse> {
  const guardErr = validateMutationRequest(request)
  if (guardErr) return guardErr

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('[onboarding/foster] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Email must be present and confirmed. We store user.email (not the
  // request body) as foster_parents.email so a user cannot claim invites
  // intended for an address they don't own.
  if (!user.email) {
    return NextResponse.json({ error: 'Account email is unavailable' }, { status: 400 })
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: 'Please verify your email before completing onboarding' },
      { status: 403 },
    )
  }

  // 5 onboardings/min/user. Same justification as the shelter route —
  // users complete onboarding once; tight bound blunts scripted abuse.
  const rl = rateLimit('onboarding:foster', user.id, { limit: 5, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = fosterOnboardingServerSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }
  const data = parsed.data

  // Single-foster-row invariant. RLS enforces the user_id ownership but
  // doesn't enforce "one foster_parents row per user"; surface this as a
  // friendly 409 so a user who somehow lands on /onboarding twice gets a
  // clear message instead of a duplicate-row insert error.
  const { data: existingFoster, error: existingErr } = await supabase
    .from('foster_parents')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingErr) {
    console.error('[onboarding/foster] existing-row check failed:', existingErr.message)
    return NextResponse.json({ error: 'Failed to check existing profile' }, { status: 500 })
  }
  if (existingFoster) {
    return NextResponse.json(
      { error: 'You have already completed foster onboarding' },
      { status: 409 },
    )
  }

  // Cross-role guard: a user cannot be both a foster and a shelter.
  const { data: existingShelter, error: shelterRoleErr } = await supabase
    .from('shelters')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (shelterRoleErr) {
    console.error('[onboarding/foster] shelter-role check failed:', shelterRoleErr.message)
    return NextResponse.json({ error: 'Failed to check existing profile' }, { status: 500 })
  }
  if (existingShelter) {
    return NextResponse.json(
      {
        error:
          'This account already has a shelter profile. A single account cannot be both a foster and a shelter.',
      },
      { status: 409 },
    )
  }

  // Sanitize once at the boundary. `sanitizeText` for everything except
  // bio / other_pets_info / children_info which preserve line breaks via
  // `sanitizeMultiline`. Email is taken from the verified auth context
  // (user.email), never from the request body.
  const cleanedFirstName = sanitizeText(data.first_name)
  const cleanedLastName = sanitizeText(data.last_name)
  const cleanedLocation = sanitizeText(data.location)
  const cleanedPhone = data.phone ? sanitizeText(data.phone) || null : null
  const cleanedOtherPetsInfo = data.other_pets_info
    ? sanitizeMultiline(data.other_pets_info) || null
    : null
  const cleanedChildrenInfo = data.children_info
    ? sanitizeMultiline(data.children_info) || null
    : null
  const cleanedBio = data.bio ? sanitizeMultiline(data.bio) || null : null

  const { data: inserted, error: insertErr } = await supabase
    .from('foster_parents')
    .insert({
      user_id: user.id,
      first_name: cleanedFirstName,
      last_name: cleanedLastName,
      email: user.email,
      phone: cleanedPhone,
      location: cleanedLocation,
      housing_type: data.housing_type ?? null,
      has_yard: data.has_yard,
      has_other_pets: data.has_other_pets,
      other_pets_info: cleanedOtherPetsInfo,
      has_children: data.has_children,
      children_info: cleanedChildrenInfo,
      experience: data.experience ?? null,
      bio: cleanedBio,
    })
    .select('id, user_id, first_name, last_name, email')
    .single()

  if (insertErr || !inserted) {
    if ((insertErr as { code?: string } | null)?.code === '23505') {
      return NextResponse.json(
        { error: 'A foster profile already exists for this account.' },
        { status: 409 },
      )
    }
    console.error('[onboarding/foster] insert failed:', insertErr?.message)
    return NextResponse.json({ error: 'Failed to create foster profile' }, { status: 500 })
  }

  // Claim any pending shelter-foster invites waiting on this email.
  // RLS on shelter_foster_invites allows UPDATE when lower(email)
  // matches the caller's foster_parents.email, so the call runs safely
  // under the new foster's JWT. The claim is fire-and-forget — a
  // failure must NOT block the foster from reaching their dashboard;
  // the invites remain readable by email in /foster/invites and can be
  // accepted there instead.
  const normalizedEmail = normalizeInviteEmail(user.email)
  if (normalizedEmail) {
    const { error: claimErr } = await supabase
      .from('shelter_foster_invites')
      .update({ foster_id: inserted.id })
      .is('foster_id', null)
      .ilike('email', normalizedEmail)
      .eq('status', 'pending')
    if (claimErr) {
      console.warn(
        '[onboarding/foster] invite email-claim failed (non-fatal):',
        claimErr.message,
      )
    }
  }

  return privateJson(
    {
      id: inserted.id,
      first_name: inserted.first_name,
      last_name: inserted.last_name,
    },
    { status: 201 },
  )
}
