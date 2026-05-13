import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { fosterProfilePatchSchema } from '@/lib/schemas'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

/**
 * PATCH /api/foster-parents/[id] — update a foster profile.
 *
 * The previous implementation ran a direct `foster_parents.update` from
 * the client (`FosterProfileForm`), which made the Zod validation and
 * `sanitizeText` / `sanitizeMultiline` boundary bypassable from DevTools.
 * RLS limits the blast radius to the caller's own row, but defense-in-depth
 * for free-text fields means sanitization must run server-side.
 *
 * Status contract:
 *   - 200: updated (sanitized row returned)
 *   - 400: malformed JSON
 *   - 401: unauthenticated
 *   - 403: caller does not own this foster_parents row
 *   - 404: row not found
 *   - 422: schema validation failure (per-field errors in `details`)
 *   - 429: rate limit exceeded
 *   - 503: auth service unavailable
 */
export async function PATCH(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await paramsPromise
  const guardErr = validateMutationRequest(request)
  if (guardErr) return guardErr

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('[foster-parents/update] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 20 updates/min/user — generous for a form the user typically saves
  // a handful of times per session, tight enough to blunt scripted abuse.
  const rl = rateLimit('foster-parents:update', user.id, { limit: 20, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  // Defense-in-depth ownership check alongside the existing RLS policy.
  // We resolve the row by id first so a wrong-owner request gets a clean
  // 403 instead of an RLS-induced 404 / silent no-op.
  const { data: existing, error: fetchError } = await supabase
    .from('foster_parents')
    .select('id, user_id')
    .eq('id', params.id)
    .maybeSingle()

  if (fetchError) {
    console.error('[foster-parents/update] fetch failed:', fetchError.message)
    return NextResponse.json({ error: 'Failed to load foster profile' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'Foster profile not found' }, { status: 404 })
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = fosterProfilePatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }
  const data = parsed.data

  // avatar_url comes in alongside the schema fields but is not part of the
  // Zod shape — `AvatarLogoField.flush()` returns the canonical URL the
  // client just uploaded. We accept it as a separate property and treat
  // non-string values as null.
  const incomingAvatarUrl =
    raw && typeof raw === 'object' && 'avatar_url' in raw
      ? (raw as { avatar_url?: unknown }).avatar_url
      : undefined
  const avatarUrl =
    typeof incomingAvatarUrl === 'string' && incomingAvatarUrl.length > 0
      ? incomingAvatarUrl
      : null

  // Sanitize at the boundary — single cleaned constants reused on the
  // update payload so we can never accidentally persist a raw value.
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

  const updatePayload = {
    first_name: cleanedFirstName,
    last_name: cleanedLastName,
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
    avatar_url: avatarUrl,
    pref_size: data.pref_size,
    pref_age: data.pref_age,
    pref_medical: data.pref_medical,
    max_distance: data.max_distance,
  }

  const { data: updated, error: updateError } = await supabase
    .from('foster_parents')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (updateError || !updated) {
    console.error('[foster-parents/update] update failed:', updateError?.message)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }

  return privateJson(updated)
}
