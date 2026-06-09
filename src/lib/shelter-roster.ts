import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Canonicalise an email for invite lookups. Matches the Postgres side,
 * which uses `lower(email)` in the partial unique index and the match
 * policies (see `supabase/migrations/20240113000000_shelter_foster_roster.sql`).
 *
 * - trim whitespace
 * - lowercase
 * - return '' for non-strings so callers can treat "nothing to match" and
 *   "empty input" identically without null-checking.
 */
export function normalizeInviteEmail(email: unknown): string {
  if (typeof email !== 'string') return ''
  return email.trim().toLowerCase()
}

export interface FosterCaller {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
}

export interface PendingInvite {
  id: string
  shelter_id: string
  email: string
  foster_id: string | null
  status: string
}

/**
 * Shared guard for the foster-side invite responses (accept / decline).
 * Resolves the caller's foster row, loads the invite, and verifies it is
 * still pending and addressed to this foster (by foster_id OR by
 * case-insensitive email match — the second path handles pre-signup
 * invites whose email-claim hasn't run yet).
 *
 * RLS already filters invite visibility the same way; the explicit
 * re-check keeps the authorization logic reviewable in one place without
 * trusting RLS alone.
 *
 * Returns `{ response }` with the appropriate error NextResponse when any
 * check fails, otherwise `{ foster, invite }`.
 */
export async function resolveFosterInviteResponse(
  supabase: SupabaseClient,
  userId: string,
  inviteId: string,
  logTag: string,
): Promise<
  | { response: NextResponse; foster?: never; invite?: never }
  | { response?: never; foster: FosterCaller; invite: PendingInvite }
> {
  const { data: fosterRow } = await supabase
    .from('foster_parents')
    .select('id, email, first_name, last_name')
    .eq('user_id', userId)
    .maybeSingle()
  if (!fosterRow) {
    return {
      response: NextResponse.json({ error: 'Caller is not a foster' }, { status: 403 }),
    }
  }
  const foster = fosterRow as FosterCaller

  // Fetch the invite with RLS already applied; if the caller can't see it,
  // maybeSingle returns null and we surface a 404 without leaking existence.
  const { data: invite, error: fetchErr } = await supabase
    .from('shelter_foster_invites')
    .select('id, shelter_id, email, foster_id, status')
    .eq('id', inviteId)
    .maybeSingle()

  if (fetchErr) {
    console.error(`[${logTag}] fetch failed:`, fetchErr.message)
    return {
      response: NextResponse.json({ error: 'Failed to load invite' }, { status: 500 }),
    }
  }
  if (!invite) {
    return {
      response: NextResponse.json({ error: 'Invite not found' }, { status: 404 }),
    }
  }
  const inviteRow = invite as PendingInvite

  // Idempotency + correctness guard. Only pending invites can transition.
  if (inviteRow.status !== 'pending') {
    return {
      response: NextResponse.json(
        { error: `Invite is no longer pending (status: ${inviteRow.status})` },
        { status: 409 },
      ),
    }
  }

  const fosterEmail = normalizeInviteEmail(foster.email)
  const matchesByFosterId = inviteRow.foster_id === foster.id
  const matchesByEmail =
    normalizeInviteEmail(inviteRow.email) === fosterEmail && fosterEmail.length > 0
  if (!matchesByFosterId && !matchesByEmail) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { foster, invite: inviteRow }
}

/** "First Last" display name with a safe fallback for empty profiles. */
export function fosterDisplayName(foster: Pick<FosterCaller, 'first_name' | 'last_name'>): string {
  return (
    [foster.first_name, foster.last_name].filter(Boolean).join(' ').trim() || 'A foster'
  )
}

/**
 * Counts how many `applications` currently have the given foster in the
 * `accepted` state across the entire platform. Used by the shelter-side
 * roster to show "Currently fostering N animal(s)" — a number, never
 * which shelters.
 *
 * Returns 0 on any error (including RLS denial) so UI never blocks on this
 * count. Logs to console for observability.
 */
export async function activeFosteringCount(
  supabase: SupabaseClient,
  fosterId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('foster_id', fosterId)
    .eq('status', 'accepted')

  if (error) {
    console.error(
      '[shelter-roster] activeFosteringCount failed:',
      error.message,
    )
    return 0
  }
  return count ?? 0
}
