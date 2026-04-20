import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  applicationId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
})

/**
 * POST /api/shelter-ratings
 *
 * Foster → shelter rating for a completed placement.
 *
 * Guards (in order):
 * 1. Authentication — caller must be logged in
 * 2. Body shape — Zod validated
 * 3. Application exists and is `completed`
 * 4. Foster ownership — caller's foster_parents row must match the
 *    application's foster_id
 * 5. Idempotency — one shelter_rating per application; 409 if present
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) {
    console.error('[shelter-ratings/post] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: application, error: fetchError } = await supabase
    .from('applications')
    .select(
      'id, status, foster_id, dog_id, shelter_id, foster:foster_parents!inner(user_id)',
    )
    .eq('id', body.applicationId)
    .single()

  if (fetchError || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const foster = application.foster as unknown as { user_id: string }
  if (foster.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (application.status !== 'completed') {
    return NextResponse.json(
      { error: 'Only completed placements can be rated' },
      { status: 409 },
    )
  }

  const { data: existing } = await supabase
    .from('shelter_ratings')
    .select('id')
    .eq('application_id', body.applicationId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A rating for this placement already exists' },
      { status: 409 },
    )
  }

  const { error: insertError } = await supabase.from('shelter_ratings').insert({
    application_id: body.applicationId,
    shelter_id: application.shelter_id,
    foster_id: application.foster_id,
    dog_id: application.dog_id,
    score: body.score,
    comment: body.comment ?? null,
  })

  if (insertError) {
    return NextResponse.json({ error: 'Failed to save rating' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
