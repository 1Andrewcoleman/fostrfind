import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Determine where to send a user after authentication based on
 * whether they have a shelter or foster_parents row.
 */
export async function getPostAuthDestination(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const [{ data: shelter }, { data: foster }] = await Promise.all([
    supabase.from('shelters').select('id').eq('user_id', userId).single(),
    supabase.from('foster_parents').select('id').eq('user_id', userId).single(),
  ])

  if (shelter) return '/shelter/dashboard'
  if (foster) return '/foster/dashboard'
  return '/onboarding'
}
