import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { dogCreateSchema } from '@/lib/schemas'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

/**
 * POST /api/dogs — create a new dog listing for the caller's shelter.
 *
 * Previously, `DogForm` wrote directly to Supabase from the browser. While
 * RLS limited the blast radius to the caller's own shelter rows, an
 * attacker editing the page in DevTools could trivially bypass the
 * client-side `sanitizeText` / `sanitizeMultiline` calls and persist
 * tag-shaped substrings into the database. This route consolidates auth,
 * rate limiting, validation, sanitisation, and the insert in one place so
 * sanitisation is un-bypassable. Photo uploads remain handled by the
 * existing `/api/upload/photo` route; this route only stores the final
 * URLs in the `photos` column.
 *
 * Status contract:
 *   - 201: created (dog row returned)
 *   - 400: malformed JSON body
 *   - 401: unauthenticated
 *   - 403: caller does not own a shelter
 *   - 422: schema validation failure (per-field errors in `details`)
 *   - 429: rate limit exceeded
 *   - 500: insert failure
 *   - 503: auth service unavailable
 */
export async function POST(request: Request): Promise<NextResponse> {
  const guardErr = validateMutationRequest(request)
  if (guardErr) return guardErr

  // 30 creates/min/user comfortably covers a shelter onboarding a batch of
  // dogs while blunting scripted spam. Matches the foster-invite limit so
  // operators don't have to keep two different mental models.
  const auth = await requireApiUser('dogs/create', {
    key: 'dogs:create',
    limit: 30,
    windowMs: 60_000,
  })
  if (auth.response) return auth.response
  const { supabase, user } = auth

  // Resolve the caller's shelter BEFORE parsing the body so users without a
  // shelter row get a clear 403 instead of a generic validation error.
  const { data: shelterRow, error: shelterErr } = await supabase
    .from('shelters')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (shelterErr) {
    console.error('[dogs/create] shelter lookup failed:', shelterErr.message)
    return NextResponse.json({ error: 'Unable to resolve shelter' }, { status: 500 })
  }
  if (!shelterRow) {
    return NextResponse.json({ error: 'Caller is not a shelter' }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = dogCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }
  const data = parsed.data

  // Sanitize at the boundary. `sanitizeText` strips tag-shaped substrings and
  // collapses whitespace runs — appropriate for single-line fields. The
  // description column preserves paragraphs so we use `sanitizeMultiline`.
  // The stored value MUST be sanitized so any future renderer (admin views,
  // exports, email templates) cannot surface raw input from the input layer.
  const cleanedName = sanitizeText(data.name)
  const cleanedBreed = data.breed ? sanitizeText(data.breed) || null : null
  const cleanedTemperament = data.temperament ? sanitizeText(data.temperament) || null : null
  const cleanedMedical = data.medical_status ? sanitizeText(data.medical_status) || null : null
  const cleanedSpecial = data.special_needs ? sanitizeText(data.special_needs) || null : null
  const cleanedDescription = data.description
    ? sanitizeMultiline(data.description) || null
    : null

  // sanitizeText can produce '' if the input was entirely tag-shaped. The
  // `name` column is NOT NULL, so reject that case here rather than relying
  // on a 23502 from Postgres which would surface as a generic 500.
  if (cleanedName.length === 0) {
    return NextResponse.json(
      { error: 'Validation failed', details: { name: ['Name is required'] } },
      { status: 422 },
    )
  }

  const insertPayload = {
    shelter_id: shelterRow.id,
    name: cleanedName,
    breed: cleanedBreed,
    age: data.age ?? null,
    size: data.size ?? null,
    gender: data.gender ?? null,
    temperament: cleanedTemperament,
    medical_status: cleanedMedical,
    special_needs: cleanedSpecial,
    description: cleanedDescription,
    photos: data.photos,
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('dogs')
    .insert(insertPayload)
    .select()
    .single()

  if (insertErr || !inserted) {
    console.error('[dogs/create] insert failed:', insertErr?.message)
    return NextResponse.json({ error: 'Failed to create dog' }, { status: 500 })
  }

  return privateJson(inserted, { status: 201 })
}
