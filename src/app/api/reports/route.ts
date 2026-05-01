import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeMultiline } from '@/lib/sanitize'
import { REPORT_CATEGORIES } from '@/lib/constants'

/**
 * POST /api/reports
 *
 * File a mutual report (Phase 6.4) on an application. Either party on the
 * application — the foster or the shelter owner — can flag the other.
 *
 * Guards (in order):
 *
 *   1. Authenticated.
 *   2. Rate limited per user (modest cap; reporting is meant to be rare).
 *   3. Body validates against the Zod schema.
 *   4. Application exists.
 *   5. Caller is the foster or the shelter owner on that application;
 *      otherwise 403. The subject is derived server-side from this lookup
 *      so the client never picks who the report targets.
 *   6. Idempotency: at most one PENDING report per (application, reporter).
 *      Re-filing while a previous report is still pending returns 409 to
 *      avoid duplicate triage work; once a report is resolved/dismissed
 *      the same reporter can file again.
 *
 * The triage admin queue itself is deferred — see Phase 6.4 in
 * docs/roadmap.md and the Deferred Follow-ups Log entry. Until that
 * lands, status updates flow through service role only and reporters
 * see their own rows via the RLS SELECT policy.
 */
const bodySchema = z.object({
  applicationId: z.string().uuid(),
  category: z.enum(REPORT_CATEGORIES),
  body: z.string().trim().min(1).max(4000),
})

interface ApplicationOwnershipRow {
  id: string
  foster_id: string
  shelter_id: string
  foster: { user_id: string } | null
  shelter: { user_id: string } | null
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('[reports/post] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 5/min is intentionally low — reporting is rare. Captures honest mistypes
  // and blocks scripted spam without ever annoying a real user.
  const rl = rateLimit('reports:post', user.id, { limit: 5, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Fetch the application + both parties' owning user ids in one round-trip.
  // !inner so a missing foster/shelter row surfaces as fetchError rather than
  // silently nulled — RLS on the join tables stays the security boundary.
  const { data, error: fetchError } = await supabase
    .from('applications')
    .select(
      'id, foster_id, shelter_id, foster:foster_parents!inner(user_id), shelter:shelters!inner(user_id)',
    )
    .eq('id', parsed.applicationId)
    .single<ApplicationOwnershipRow>()

  if (fetchError || !data) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const fosterUserId = data.foster?.user_id
  const shelterUserId = data.shelter?.user_id

  let subjectFosterId: string | null = null
  let subjectShelterId: string | null = null
  if (fosterUserId === user.id) {
    subjectShelterId = data.shelter_id
  } else if (shelterUserId === user.id) {
    subjectFosterId = data.foster_id
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Idempotency on PENDING reports only — once triage closes a report
  // (resolved/dismissed) the same reporter can file again on the same pair
  // if a NEW issue arises.
  const { data: existing, error: existingError } = await supabase
    .from('reports')
    .select('id')
    .eq('application_id', parsed.applicationId)
    .eq('reporter_user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingError) {
    console.error('[reports/post] dedup lookup failed:', existingError.message)
    return NextResponse.json({ error: 'Failed to file report' }, { status: 500 })
  }
  if (existing) {
    return NextResponse.json(
      { error: 'You already have a pending report on this application.' },
      { status: 409 },
    )
  }

  const cleanBody = sanitizeMultiline(parsed.body)
  if (!cleanBody) {
    return NextResponse.json({ error: 'Report body cannot be empty.' }, { status: 400 })
  }

  const { data: inserted, error: insertError } = await supabase
    .from('reports')
    .insert({
      application_id: parsed.applicationId,
      reporter_user_id: user.id,
      subject_foster_id: subjectFosterId,
      subject_shelter_id: subjectShelterId,
      category: parsed.category,
      body: cleanBody,
    })
    .select('id, created_at')
    .single()

  if (insertError || !inserted) {
    console.error('[reports/post] insert failed:', insertError?.message ?? 'no row')
    return NextResponse.json({ error: 'Failed to file report' }, { status: 500 })
  }

  return NextResponse.json({ success: true, reportId: inserted.id })
}
