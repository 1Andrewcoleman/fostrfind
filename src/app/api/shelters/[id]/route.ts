import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { shelterSettingsPatchSchema } from '@/lib/schemas'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

/**
 * PATCH /api/shelters/[id] — update a shelter row.
 *
 * The previous implementation ran a direct `shelters.update` from the
 * client (`ShelterSettingsForm`), which made the Zod validation and
 * `sanitizeText` / `sanitizeMultiline` boundary bypassable from DevTools.
 * RLS limits the blast radius to the caller's own row, but defense-in-depth
 * for free-text fields means sanitization must run server-side.
 *
 * Status contract:
 *   - 200: updated (sanitized row returned)
 *   - 400: malformed JSON
 *   - 401: unauthenticated
 *   - 403: caller does not own this shelter row
 *   - 404: shelter not found
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
    console.error('[shelters/update] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 20 updates/min/user — same envelope as the foster profile update.
  const rl = await rateLimit('shelters:update', user.id, { limit: 20, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  // Defense-in-depth ownership check alongside the existing RLS policy.
  // Resolving the row first means a wrong-owner request gets a clean 403
  // instead of an RLS-induced silent no-op.
  const { data: existing, error: fetchError } = await supabase
    .from('shelters')
    .select('id, user_id')
    .eq('id', params.id)
    .maybeSingle()

  if (fetchError) {
    console.error('[shelters/update] fetch failed:', fetchError.message)
    return NextResponse.json({ error: 'Failed to load shelter' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'Shelter not found' }, { status: 404 })
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

  const parsed = shelterSettingsPatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }
  const data = parsed.data

  // logo_url comes in alongside the schema fields but is not part of the
  // Zod shape — `AvatarLogoField.flush()` returns the canonical URL the
  // client just uploaded. We accept it as a separate property and treat
  // non-string values as null.
  const incomingLogoUrl =
    raw && typeof raw === 'object' && 'logo_url' in raw
      ? (raw as { logo_url?: unknown }).logo_url
      : undefined
  const logoUrl =
    typeof incomingLogoUrl === 'string' && incomingLogoUrl.length > 0
      ? incomingLogoUrl
      : null

  // Sanitize at the boundary — single cleaned constants reused on the
  // update payload so we can never accidentally persist a raw value.
  const cleanedName = sanitizeText(data.name)
  const cleanedLocation = sanitizeText(data.location)
  const cleanedPhone = data.phone ? sanitizeText(data.phone) || null : null
  const cleanedWebsite = data.website ? sanitizeText(data.website) || null : null
  const cleanedInstagram = data.instagram ? sanitizeText(data.instagram) || null : null
  const cleanedBio = data.bio ? sanitizeMultiline(data.bio) || null : null

  const updatePayload = {
    name: cleanedName,
    slug: data.slug,
    phone: cleanedPhone,
    location: cleanedLocation,
    bio: cleanedBio,
    website: cleanedWebsite,
    instagram: cleanedInstagram,
    logo_url: logoUrl,
  }

  const { data: updated, error: updateError } = await supabase
    .from('shelters')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (updateError || !updated) {
    console.error('[shelters/update] update failed:', updateError?.message)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }

  return privateJson(updated)
}
