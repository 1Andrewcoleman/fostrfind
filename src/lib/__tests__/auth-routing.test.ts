import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { getPostAuthDestination } from '@/lib/auth-routing'

type QueryResult = { data: unknown; error: unknown }

/**
 * Minimal stand-in for a Supabase query builder. `getPostAuthDestination`
 * chains `.from(...).select(...).eq(...).single()` and awaits the final
 * call, so we only need to model that final terminal resolving to
 * `{ data, error }`. We distinguish tables by the `.from()` arg so the
 * shelter vs foster query can resolve independently.
 */
function buildMockClient(results: {
  shelters: QueryResult
  foster_parents: QueryResult
}): SupabaseClient {
  const mock = {
    from(table: 'shelters' | 'foster_parents') {
      const result = results[table]
      return {
        select: () => ({
          eq: () => ({
            single: async () => result,
          }),
        }),
      }
    },
  }
  return mock as unknown as SupabaseClient
}

describe('getPostAuthDestination', () => {
  it('routes to /shelter/dashboard when a shelter row exists', async () => {
    const client = buildMockClient({
      shelters: { data: { id: 'shelter-1' }, error: null },
      foster_parents: { data: null, error: null },
    })
    await expect(getPostAuthDestination(client, 'user-1')).resolves.toBe(
      '/shelter/dashboard',
    )
  })

  it('routes to /foster/dashboard when only a foster_parents row exists', async () => {
    const client = buildMockClient({
      shelters: { data: null, error: null },
      foster_parents: { data: { id: 'foster-1' }, error: null },
    })
    await expect(getPostAuthDestination(client, 'user-1')).resolves.toBe(
      '/foster/dashboard',
    )
  })

  it('routes to /onboarding when neither profile exists', async () => {
    const client = buildMockClient({
      shelters: { data: null, error: null },
      foster_parents: { data: null, error: null },
    })
    await expect(getPostAuthDestination(client, 'user-1')).resolves.toBe(
      '/onboarding',
    )
  })

  it('routes to /onboarding when both queries error (null-safe fallback)', async () => {
    const client = buildMockClient({
      shelters: { data: null, error: { message: 'boom' } },
      foster_parents: { data: null, error: { message: 'boom' } },
    })
    await expect(getPostAuthDestination(client, 'user-1')).resolves.toBe(
      '/onboarding',
    )
  })

  it('prefers shelter when (implausibly) both exist', async () => {
    const client = buildMockClient({
      shelters: { data: { id: 'shelter-1' }, error: null },
      foster_parents: { data: { id: 'foster-1' }, error: null },
    })
    await expect(getPostAuthDestination(client, 'user-1')).resolves.toBe(
      '/shelter/dashboard',
    )
  })
})
