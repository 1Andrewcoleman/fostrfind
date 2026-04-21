import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeMultiline } from '@/lib/sanitize'

/**
 * POST /api/shelter/foster-notes
 *
 * Creates a private, shelter-staff-only note on a (shelter, foster)
 * relationship. RLS already restricts inserts to the shelter owner's
 * own rows; the route additionally requires the (shelter, foster)
 * pair to be on the caller's roster so shelters can't drop notes on
 * fosters who aren't actually their fosters.
 */
const bodySchema = z.object({
  fosterId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
})

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) {
    console.error('[foster-notes/create] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = rateLimit('foster-notes:create', user.id, {
    limit: 60,
    windowMs: 60_000,
  })
  if (!rl.success) return rateLimitResponse(rl)

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      { error: 'Note must be between 1 and 4000 characters.' },
      { status: 400 },
    )
  }

  const { data: shelterRow } = await supabase
    .from('shelters')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!shelterRow) {
    return NextResponse.json({ error: 'Caller is not a shelter' }, { status: 403 })
  }
  const shelterId = (shelterRow as { id: string }).id

  // Require the foster to actually be on the caller's roster.
  const { data: rosterRow } = await supabase
    .from('shelter_fosters')
    .select('shelter_id')
    .eq('shelter_id', shelterId)
    .eq('foster_id', body.fosterId)
    .maybeSingle()
  if (!rosterRow) {
    return NextResponse.json(
      { error: 'Foster is not on your roster.' },
      { status: 403 },
    )
  }

  const sanitizedBody = sanitizeMultiline(body.body)
  if (!sanitizedBody) {
    return NextResponse.json({ error: 'Note cannot be empty.' }, { status: 400 })
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('shelter_foster_notes')
    .insert({
      shelter_id: shelterId,
      foster_id: body.fosterId,
      author_user: user.id,
      body: sanitizedBody,
    })
    .select('id, created_at, body, author_user')
    .single()

  if (insertErr) {
    console.error('[foster-notes/create] insert failed:', insertErr.message)
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
  }

  return NextResponse.json({ success: true, note: inserted })
}
