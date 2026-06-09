import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiUser } from '@/lib/api-auth'
import { sanitizeText } from '@/lib/sanitize'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

const bodySchema = z.object({
  applicationId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
})

interface RatingRouteConfig {
  /** Table the rating row is inserted into. */
  table: 'ratings' | 'shelter_ratings'
  /** Which side of the application must own the rating: the shelter rates
   *  fosters into `ratings`; the foster rates shelters into `shelter_ratings`. */
  rater: 'shelter' | 'foster'
  rateLimitKey: string
  logTag: string
}

/**
 * Shared POST handler for the two rating endpoints (`/api/ratings` and
 * `/api/shelter-ratings`) — both sides of the two-way trust loop run the
 * exact same guard chain and insert shape; only the table and which party
 * must own the application differ.
 *
 * Guards (in order):
 * 1. Authentication — caller must be logged in
 * 2. Body shape — Zod validated
 * 3. Application exists and is `completed`
 * 4. Ownership — caller's user id must match the rater side of the application
 * 5. Idempotency — one rating per application; 409 if present (including the
 *    unique-violation race between duplicate-check and insert)
 */
export function createRatingHandler(
  config: RatingRouteConfig,
): (request: Request) => Promise<NextResponse> {
  const ownerJoin =
    config.rater === 'shelter'
      ? 'shelter:shelters!inner(user_id)'
      : 'foster:foster_parents!inner(user_id)'

  return async function POST(request: Request): Promise<NextResponse> {
    const guardErr = validateMutationRequest(request)
    if (guardErr) return guardErr

    // Authenticate before parsing the body so unauthenticated requests don't
    // incur JSON parsing cost. Rate limit: 20 ratings/min per user.
    const auth = await requireApiUser(config.logTag, {
      key: config.rateLimitKey,
      limit: 20,
      windowMs: 60_000,
    })
    if (auth.response) return auth.response
    const { supabase, user } = auth

    let body: z.infer<typeof bodySchema>
    try {
      body = bodySchema.parse(await request.json())
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Fetch the application and verify it is completed + rater ownership.
    const { data: application, error: fetchError } = await supabase
      .from('applications')
      .select(`id, status, foster_id, dog_id, shelter_id, ${ownerJoin}`)
      .eq('id', body.applicationId)
      .single()

    if (fetchError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const owner = (application as unknown as Record<string, { user_id: string }>)[
      config.rater
    ]
    if (owner.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (application.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed placements can be rated' },
        { status: 409 },
      )
    }

    // Idempotency — reject if a rating already exists for this application.
    const { data: existing } = await supabase
      .from(config.table)
      .select('id')
      .eq('application_id', body.applicationId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'A rating for this placement already exists' },
        { status: 409 },
      )
    }

    // Insert the rating. Comments are free-text, so strip any HTML-ish
    // tags before persisting — keeps exports / emails / future plaintext
    // views safe. Empty sanitized strings collapse to null.
    const cleanComment = body.comment ? sanitizeText(body.comment) : ''
    const { error: insertError } = await supabase.from(config.table).insert({
      application_id: body.applicationId,
      shelter_id: application.shelter_id,
      foster_id: application.foster_id,
      dog_id: application.dog_id,
      score: body.score,
      comment: cleanComment || null,
    })

    if (insertError) {
      // Map Postgres unique_violation to 409 — covers race between
      // duplicate-check and insert (two concurrent requests for the same
      // placement).
      if ((insertError as { code?: string }).code === '23505') {
        return NextResponse.json(
          { error: 'A rating for this placement already exists' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: 'Failed to save rating' }, { status: 500 })
    }

    return privateJson({ success: true })
  }
}
