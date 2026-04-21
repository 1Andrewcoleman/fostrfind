import type { SupabaseClient } from '@supabase/supabase-js'
import type { ShelterFosterInvite } from '@/types/database'

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

/** True when the invite is still awaiting a foster response. */
export function isInvitePending(
  row: Pick<ShelterFosterInvite, 'status'>,
): boolean {
  return row.status === 'pending'
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
