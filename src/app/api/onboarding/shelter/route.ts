import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { shelterOnboardingServerSchema } from '@/lib/schemas'
import { slugify } from '@/lib/helpers'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

/**
 * POST /api/onboarding/shelter — create the caller's shelter profile.
 *
 * Replaces the client-side `supabase.from('shelters').insert(...)` that
 * the previous onboarding page issued from the browser. Moving the
 * insert behind a route enables:
 *
 *   - Server-side Zod validation (defense-in-depth on top of RLS)
 *   - Single-point sanitization of free-text fields (name, location,
 *     EIN, phone, website, instagram, bio) so stored values are clean
 *     for plaintext contexts (admin views, emails, exports)
 *   - Authoritative ownership: `user_id` is taken from the auth context,
 *     never from the request body
 *   - Server-generated slug — keeps the algorithm identical to the
 *     previous client implementation (`slugify(name) + '-' + random4`).
 *
 * Status contract:
 *   - 201: created (sanitized shelter row returned)
 *   - 400: malformed JSON or account email unavailable
 *   - 401: unauthenticated
 *   - 403: email not yet confirmed (user.email_confirmed_at is null)
 *   - 409: caller already has a shelters row (single-shelter invariant)
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
    console.error('[onboarding/shelter] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Email must be present and confirmed. We store user.email (not the
  // request body) as shelters.email so a user cannot impersonate another.
  if (!user.email) {
    return NextResponse.json({ error: 'Account email is unavailable' }, { status: 400 })
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: 'Please verify your email before completing onboarding' },
      { status: 403 },
    )
  }

  // 5 onboardings/min/user. Users complete onboarding once; this is tight
  // enough to blunt scripted enumeration / spam without rejecting a user
  // who hits a transient 5xx and retries.
  const rl = rateLimit('onboarding:shelter', user.id, { limit: 5, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = shelterOnboardingServerSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }
  const data = parsed.data

  // Single-shelter invariant: a user owns at most one shelters row.
  // We surface this as 409 (conflict) before the insert so the caller
  // gets actionable feedback rather than a generic constraint error
  // from RLS / the DB. RLS still enforces the rule at the storage layer.
  const { data: existingShelter, error: existingErr } = await supabase
    .from('shelters')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingErr) {
    console.error('[onboarding/shelter] existing-row check failed:', existingErr.message)
    return NextResponse.json({ error: 'Failed to check existing profile' }, { status: 500 })
  }
  if (existingShelter) {
    return NextResponse.json(
      { error: 'You have already completed shelter onboarding' },
      { status: 409 },
    )
  }

  // Cross-role guard: a user cannot be both a shelter and a foster.
  const { data: existingFoster, error: fosterRoleErr } = await supabase
    .from('foster_parents')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (fosterRoleErr) {
    console.error('[onboarding/shelter] foster-role check failed:', fosterRoleErr.message)
    return NextResponse.json({ error: 'Failed to check existing profile' }, { status: 500 })
  }
  if (existingFoster) {
    return NextResponse.json(
      {
        error:
          'This account already has a foster profile. A single account cannot be both a shelter and a foster.',
      },
      { status: 409 },
    )
  }

  // Sanitize once at the boundary. Email is taken from the verified auth
  // context (user.email), not the request body. Bio uses sanitizeMultiline
  // to preserve paragraph breaks; everything else collapses whitespace via
  // sanitizeText.
  const cleanedName = sanitizeText(data.name)
  const cleanedLocation = sanitizeText(data.location)
  const cleanedPhone = data.phone ? sanitizeText(data.phone) || null : null
  const cleanedEin = data.ein ? sanitizeText(data.ein) || null : null
  const cleanedBio = data.bio ? sanitizeMultiline(data.bio) || null : null
  const cleanedWebsite = data.website ? sanitizeText(data.website) || null : null
  const cleanedInstagram = data.instagram ? sanitizeText(data.instagram) || null : null

  // Slug = slugified name + 4 random chars. Matches the algorithm the
  // previous client-side onboarding used so any docs or links built
  // against the old format still describe the new one. `slugify('')`
  // returns '', so we fall back to a stable prefix if the user's
  // shelter name slugifies to nothing (e.g. all-emoji input).
  const baseSlug = slugify(cleanedName) || 'shelter'
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`

  const { data: inserted, error: insertErr } = await supabase
    .from('shelters')
    .insert({
      user_id: user.id,
      name: cleanedName,
      slug,
      email: user.email,
      phone: cleanedPhone,
      location: cleanedLocation,
      ein: cleanedEin,
      bio: cleanedBio,
      website: cleanedWebsite,
      instagram: cleanedInstagram,
    })
    .select('id, user_id, name, slug, email, location')
    .single()

  if (insertErr || !inserted) {
    // 23505 = Postgres unique_violation. Could happen if (a) the
    // existing-row check raced with a parallel onboarding submission,
    // or (b) the slug random suffix collided with an existing slug.
    // Surface either as 409 so the client can prompt to retry.
    if ((insertErr as { code?: string } | null)?.code === '23505') {
      return NextResponse.json(
        { error: 'A shelter with this identifier already exists. Please try again.' },
        { status: 409 },
      )
    }
    console.error('[onboarding/shelter] insert failed:', insertErr?.message)
    return NextResponse.json({ error: 'Failed to create shelter profile' }, { status: 500 })
  }

  return privateJson(
    {
      id: inserted.id,
      slug: inserted.slug,
      name: inserted.name,
    },
    { status: 201 },
  )
}
