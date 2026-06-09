import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { dogUpdateSchema } from '@/lib/schemas'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

/**
 * DELETE /api/dogs/[id]
 *
 * Permanently removes a dog listing and all cascaded data (applications,
 * messages). The `ON DELETE CASCADE` constraints in the schema handle the
 * cascade automatically.
 *
 * Guards (in order):
 * 1. Authentication — caller must be logged in
 * 2. Dog exists — returns 404 if not found
 * 3. Shelter ownership — caller must own the shelter that listed the dog
 * 4. No active applications — dogs with submitted/reviewing/accepted
 *    applications cannot be deleted to protect in-progress workflows
 */
export async function DELETE(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await paramsPromise
  const guardErr = validateMutationRequest(request)
  if (guardErr) return guardErr

  // 1. Authenticate the caller (rate limit: 10 deletes/min per user)
  const auth = await requireApiUser('dogs/delete', {
    key: 'dogs:delete',
    limit: 10,
    windowMs: 60_000,
  })
  if (auth.response) return auth.response
  const { supabase, user } = auth

  // 2. Fetch the dog and verify shelter ownership in one query
  const { data: dog, error: fetchError } = await supabase
    .from('dogs')
    .select('id, name, shelter_id, shelter:shelters!inner(user_id)')
    .eq('id', params.id)
    .single()

  if (fetchError || !dog) {
    return NextResponse.json({ error: 'Dog not found' }, { status: 404 })
  }

  const shelter = dog.shelter as unknown as { user_id: string }
  if (shelter.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Prevent deletion if active applications exist
  const { count: activeCount } = await supabase
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('dog_id', params.id)
    .in('status', ['submitted', 'reviewing', 'accepted'])

  if ((activeCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          'This dog has active applications. Decline or complete them before deleting the listing.',
      },
      { status: 409 },
    )
  }

  // 4. Delete the dog — cascades to applications and messages
  const { error: deleteError } = await supabase.from('dogs').delete().eq('id', params.id)

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete dog' }, { status: 500 })
  }

  return privateJson({ success: true, dogId: params.id })
}

/**
 * PATCH /api/dogs/[id]
 *
 * Update a dog listing's editable fields. The body is parsed with
 * `dogUpdateSchema` (a partial of `dogCreateSchema`), so the client may
 * submit only the fields it actually changed. Sanitisation runs at the
 * boundary for every text field that IS present in the payload — fields
 * the client did not send are not touched.
 *
 * Photo uploads still go through `/api/upload/photo`; the client passes
 * the final `photos: string[]` here and this route stores it verbatim.
 *
 * Status / mutation fields (`status`, `shelter_id`, `created_at`, …) are
 * NOT settable through this route. `status` transitions live on
 * `/api/dogs/[id]/status`. Re-assigning a dog to a different shelter is
 * never permitted.
 *
 * Guards (in order):
 * 1. Auth — 401 if no user, 503 if auth service errored
 * 2. Rate limit — 429 if exhausted
 * 3. Dog exists — 404 otherwise
 * 4. Shelter ownership — 403 if the caller does not own the dog's shelter
 *    (defense-in-depth on top of RLS)
 * 5. Body validation — 400 for malformed JSON, 422 for schema errors
 */
export async function PATCH(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await paramsPromise
  const guardErr = validateMutationRequest(request)
  if (guardErr) return guardErr

  // Limit matches `dogs:create` so a shelter operator updating their listings
  // sees the same envelope they'd see when adding new ones.
  const auth = await requireApiUser('dogs/update', {
    key: 'dogs:update',
    limit: 30,
    windowMs: 60_000,
  })
  if (auth.response) return auth.response
  const { supabase, user } = auth

  // Verify ownership BEFORE parsing the body so a 404/403 surfaces ahead of
  // a noisy 422 for a dog the caller can't see anyway.
  const { data: dog, error: fetchError } = await supabase
    .from('dogs')
    .select('id, shelter_id, shelter:shelters!inner(user_id)')
    .eq('id', params.id)
    .maybeSingle()

  if (fetchError) {
    console.error('[dogs/update] fetch failed:', fetchError.message)
    return NextResponse.json({ error: 'Failed to load dog' }, { status: 500 })
  }
  if (!dog) {
    return NextResponse.json({ error: 'Dog not found' }, { status: 404 })
  }

  const shelter = dog.shelter as unknown as { user_id: string }
  if (shelter.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = dogUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }
  const data = parsed.data

  // Build the update payload only with keys the caller actually sent. Each
  // text field is sanitised at the boundary; cleared fields collapse to
  // `null` so the column reflects intentional removal.
  const updatePayload: Record<string, unknown> = {}

  if ('name' in data && data.name !== undefined) {
    const cleaned = sanitizeText(data.name)
    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: { name: ['Name is required'] } },
        { status: 422 },
      )
    }
    updatePayload.name = cleaned
  }
  if ('breed' in data) {
    updatePayload.breed = data.breed ? sanitizeText(data.breed) || null : null
  }
  if ('age' in data) {
    updatePayload.age = data.age ?? null
  }
  if ('size' in data) {
    updatePayload.size = data.size ?? null
  }
  if ('gender' in data) {
    updatePayload.gender = data.gender ?? null
  }
  if ('temperament' in data) {
    updatePayload.temperament = data.temperament
      ? sanitizeText(data.temperament) || null
      : null
  }
  if ('medical_status' in data) {
    updatePayload.medical_status = data.medical_status
      ? sanitizeText(data.medical_status) || null
      : null
  }
  if ('special_needs' in data) {
    updatePayload.special_needs = data.special_needs
      ? sanitizeText(data.special_needs) || null
      : null
  }
  if ('description' in data) {
    updatePayload.description = data.description
      ? sanitizeMultiline(data.description) || null
      : null
  }
  if ('photos' in data && data.photos !== undefined) {
    updatePayload.photos = data.photos
  }

  // A PATCH with no recognised keys is a no-op; return the existing row
  // shape rather than a 422 so idempotent retries don't surprise the UI.
  if (Object.keys(updatePayload).length === 0) {
    const { data: existing, error: existingErr } = await supabase
      .from('dogs')
      .select()
      .eq('id', params.id)
      .single()
    if (existingErr || !existing) {
      console.error('[dogs/update] reload failed:', existingErr?.message)
      return NextResponse.json({ error: 'Failed to load dog' }, { status: 500 })
    }
    return privateJson(existing)
  }

  const { data: updated, error: updateErr } = await supabase
    .from('dogs')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (updateErr || !updated) {
    console.error('[dogs/update] update failed:', updateErr?.message)
    return NextResponse.json({ error: 'Failed to update dog' }, { status: 500 })
  }

  return privateJson(updated)
}
