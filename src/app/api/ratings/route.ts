import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  applicationId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
})

/**
 * POST /api/ratings
 *
 * Submits a shelter rating for a completed foster placement.
 *
 * Guards (in order):
 * 1. Authentication — caller must be logged in
 * 2. Application exists and is completed — only completed placements can be rated
 * 3. Shelter ownership — caller must own the shelter on the application
 * 4. Idempotency — one rating per application; returns 409 if one already exists
 */
export async function POST(request: Request): Promise<NextResponse> {
  // 1. Parse and validate request body
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = await createClient()

  // 2. Authenticate the caller
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 3. Fetch the application and verify it is completed + shelter ownership
  const { data: application, error: fetchError } = await supabase
    .from('applications')
    .select('id, status, foster_id, dog_id, shelter_id, shelter:shelters!inner(user_id)')
    .eq('id', body.applicationId)
    .single()

  if (fetchError || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const shelter = application.shelter as unknown as { user_id: string }
  if (shelter.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (application.status !== 'completed') {
    return NextResponse.json(
      { error: 'Only completed placements can be rated' },
      { status: 409 },
    )
  }

  // 4. Idempotency — reject if a rating already exists for this application
  const { data: existing } = await supabase
    .from('ratings')
    .select('id')
    .eq('application_id', body.applicationId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A rating for this placement already exists' },
      { status: 409 },
    )
  }

  // 5. Insert the rating
  const { error: insertError } = await supabase.from('ratings').insert({
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
