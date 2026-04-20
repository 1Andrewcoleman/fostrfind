import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'

/**
 * Test helpers for API route tests. All five covered API routes follow
 * the same shape:
 *   createClient() -> auth.getUser() -> [rateLimit] -> from().select()/.insert()/.update()/.delete()
 *   -> maybe .rpc() -> NextResponse.json(...)
 *
 * These helpers avoid re-implementing the chain in every test file while
 * still letting tests wire up whatever response sequence they need.
 */

type AuthResult = {
  data: { user: { id: string } | null }
  error: { message: string } | null
}

export function buildAuth(user: { id: string } | null, error: { message: string } | null = null): AuthResult {
  return { data: { user }, error }
}

/**
 * Chainable result for select-style queries. Set `single` / `maybeSingle`
 * / `count` on the factory; ignored keys default sensibly. Chain methods
 * (`select`, `eq`, `in`, `order`) return the same builder for simplicity.
 */
export interface QueryShape {
  data?: unknown
  error?: unknown
  count?: number | null
  /** If set, overrides the terminal `.single()` result. */
  single?: { data: unknown; error: unknown }
  /** If set, overrides the terminal `.maybeSingle()` result. */
  maybeSingle?: { data: unknown; error: unknown }
}

function makeChain(shape: QueryShape) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  // Chainable filter methods return the same chain
  for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
    chain[method] = () => chain
  }
  chain.single = () =>
    Promise.resolve(shape.single ?? { data: shape.data ?? null, error: shape.error ?? null })
  chain.maybeSingle = () =>
    Promise.resolve(
      shape.maybeSingle ?? { data: shape.data ?? null, error: shape.error ?? null },
    )
  // A bare-awaited query returns the shape directly (e.g.
  // `await .update({}).eq()` or `await .select(...).eq().in()`).
  // We make the chain itself a thenable so `await` unwraps to the
  // configured shape. Signature matches PromiseLike<unknown>.
  chain.then = ((
    onFulfilled?: ((value: unknown) => unknown) | null,
  ) => {
    const value = {
      data: shape.data ?? null,
      error: shape.error ?? null,
      count: shape.count ?? null,
    }
    return Promise.resolve(onFulfilled ? onFulfilled(value) : value)
  }) as typeof chain.then
  return chain
}

/**
 * Build a mock Supabase client wired for the five API routes' usage
 * patterns. `tableResults` maps a table name to a list of query shapes;
 * each call to `.from(<table>)` pops the next shape from the list (so
 * a single test can configure, e.g., first fetch-application, then
 * insert-rating separately).
 */
export interface MockClientConfig {
  auth: AuthResult
  tableResults?: Record<string, QueryShape[]>
  /** Return value for `supabase.rpc(...)`. */
  rpcResult?: { data?: unknown; error: unknown }
  /** Mutation ops use `.insert/.update/.delete` — those also return
   *  chains. Many routes do e.g. `.update({...}).eq('id', x)` which is
   *  a chain awaiting a result. We fold those into tableResults too:
   *  each from(table) call pops one shape regardless of op. */
}

export function buildMockClient(config: MockClientConfig): {
  client: SupabaseClient
  fromSpy: ReturnType<typeof vi.fn>
  rpcSpy: ReturnType<typeof vi.fn>
} {
  const tableResults: Record<string, QueryShape[]> = {}
  for (const [k, v] of Object.entries(config.tableResults ?? {})) {
    tableResults[k] = [...v]
  }

  const fromSpy = vi.fn((table: string) => {
    const queue = tableResults[table]
    const shape = queue && queue.length > 0 ? queue.shift()! : { data: null, error: null }
    const chain = makeChain(shape)
    // Mutation entry points return the same chain so `.insert(x)` then
    // `.eq('id', y)` both funnel through the same shape.
    for (const method of ['insert', 'update', 'delete', 'upsert']) {
      ;(chain as Record<string, unknown>)[method] = (..._args: unknown[]) => chain
    }
    return chain
  })

  const rpcSpy = vi.fn(async () => config.rpcResult ?? { data: null, error: null })

  const client = {
    auth: {
      getUser: async () => config.auth,
    },
    from: fromSpy,
    rpc: rpcSpy,
  }

  return {
    client: client as unknown as SupabaseClient,
    fromSpy,
    rpcSpy,
  }
}
