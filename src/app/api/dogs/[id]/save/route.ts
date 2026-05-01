import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * Phase 6.5 — Saved dogs ("favorites").
 *
 *   POST   /api/dogs/[id]/save   → save the dog for the current foster
 *   DELETE /api/dogs/[id]/save   → unsave (remove from saved list)
 *
 * Idempotent on both sides:
 *
 *   - POST returns 200 even if the row already exists. Re-saving is a
 *     no-op (`ignoreDuplicates: true` on the upsert). The UI flips to
 *     "saved" optimistically, so a duplicate POST during a rapid double-
 *     click should not error.
 *   - DELETE returns 200 even if no row exists, so unsaving twice is also
 *     a no-op. RLS already restricts deletes to the caller's own rows.
 *
 * Save state is per-foster; only authenticated fosters can hit this.
 * Shelters see aggregate counts via the RPC `get_save_counts_for_my_dogs`,
 * never individual rows.
 *
 * Dog visibility: we deliberately allow saving a dog in any status
 * (including `pending` / `placed`) because a foster may want to keep an
 * eye on a dog whose status changed mid-browse. The browse query filters
 * to `available`; the saves list will surface non-available dogs as such.
 */

async function authedFosterId(): Promise<
  | { kind: 'ok'; supabase: Awaited<ReturnType<typeof createClient>>; userId: string; fosterId: string }
  | { kind: 'error'; response: NextResponse }
> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('[dogs/save] getUser failed:', authError.message)
    return {
      kind: 'error',
      response: NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 }),
    }
  }
  if (!user) {
    return {
      kind: 'error',
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: fosterRow } = await supabase
    .from('foster_parents')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!fosterRow) {
    return {
      kind: 'error',
      response: NextResponse.json({ error: 'Foster profile required' }, { status: 403 }),
    }
  }

  return {
    kind: 'ok',
    supabase,
    userId: user.id,
    fosterId: (fosterRow as { id: string }).id,
  }
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = await authedFosterId()
  if (auth.kind === 'error') return auth.response

  // Generous cap: heart-clicking is a fast UI; 60/min stays out of normal
  // foster behavior while still blocking scripted spam.
  const rl = rateLimit('dogs:save', auth.userId, { limit: 60, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  const { error: existsError } = await auth.supabase
    .from('dogs')
    .select('id', { head: true, count: 'exact' })
    .eq('id', params.id)
  if (existsError) {
    console.error('[dogs/save] dog lookup failed:', existsError.message)
    return NextResponse.json({ error: 'Dog not found' }, { status: 404 })
  }

  const { error: upsertError } = await auth.supabase
    .from('dog_saves')
    .upsert(
      { foster_id: auth.fosterId, dog_id: params.id },
      { onConflict: 'foster_id,dog_id', ignoreDuplicates: true },
    )

  if (upsertError) {
    console.error('[dogs/save] upsert failed:', upsertError.message)
    return NextResponse.json({ error: 'Failed to save dog' }, { status: 500 })
  }

  return NextResponse.json({ success: true, dogId: params.id, saved: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = await authedFosterId()
  if (auth.kind === 'error') return auth.response

  const rl = rateLimit('dogs:unsave', auth.userId, { limit: 60, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  const { error: deleteError } = await auth.supabase
    .from('dog_saves')
    .delete()
    .eq('foster_id', auth.fosterId)
    .eq('dog_id', params.id)

  if (deleteError) {
    console.error('[dogs/save] delete failed:', deleteError.message)
    return NextResponse.json({ error: 'Failed to remove save' }, { status: 500 })
  }

  return NextResponse.json({ success: true, dogId: params.id, saved: false })
}
