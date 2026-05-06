import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

// Mock the raw @supabase/supabase-js admin client instantiated inside the route.
const mockRpc = vi.fn()
const mockDeleteUser = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
    auth: { admin: { deleteUser: mockDeleteUser } },
  })),
}))

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from '@/app/api/account/delete/route'

const USER_ID = 'user-1'

/** Build a valid POST request with proper headers. */
function callRoute(body: unknown = { confirm: 'DELETE' }, options: { origin?: string } = {}) {
  const headers: HeadersInit = { 'content-type': 'application/json' }
  if (options.origin) {
    headers['origin'] = options.origin
  }
  return POST(
    new Request('http://localhost/api/account/delete', {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
  vi.unstubAllEnvs()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  delete process.env.NEXT_PUBLIC_APP_URL

  vi.mocked(rateLimit).mockReturnValue({
    success: true,
    remaining: 2,
    resetAt: Date.now() + 60_000,
    retryAfter: 0,
  })
  mockRpc.mockResolvedValue({ error: null })
  mockDeleteUser.mockResolvedValue({ error: null })
})

describe('POST /api/account/delete — validateMutationRequest guard (ZDF-001)', () => {
  it('returns 403 when Origin mismatches NEXT_PUBLIC_APP_URL', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
    // Provide an authenticated client so we can confirm the guard fires before auth.
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute({ confirm: 'DELETE' }, { origin: 'https://evil.example.com' })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/forbidden origin/i)
    // The delete path must never have been reached.
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('passes through when Origin matches NEXT_PUBLIC_APP_URL', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      rpcResult: { error: null },
    })
    // Add signOut so the happy path does not throw.
    ;(client.auth as Record<string, unknown>).signOut = vi.fn().mockResolvedValue({})
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute({ confirm: 'DELETE' }, { origin: 'https://app.example.com' })
    expect(res.status).toBe(200)
  })

  it('passes through when no Origin header (same-origin SSR / curl pattern)', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      rpcResult: { error: null },
    })
    ;(client.auth as Record<string, unknown>).signOut = vi.fn().mockResolvedValue({})
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute({ confirm: 'DELETE' })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/account/delete — auth and body guards', () => {
  it('returns 400 when body is missing confirm field', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute({})
    expect(res.status).toBe(400)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 400 when confirm value is not the literal DELETE', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute({ confirm: 'delete' })
    expect(res.status).toBe(400)
  })

  it('returns 500 when env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute()
    expect(res.status).toBe(500)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 503 when auth service errors', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null, { message: 'service down' }) })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute()
    expect(res.status).toBe(503)
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute()
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    vi.mocked(rateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfter: 30,
    })
    const res = await callRoute()
    expect(res.status).toBe(429)
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

describe('POST /api/account/delete — deletion steps', () => {
  it('returns 500 when prepare_account_deletion RPC fails', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    mockRpc.mockResolvedValue({ error: { message: 'rpc boom' } })
    const res = await callRoute()
    expect(res.status).toBe(500)
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('returns 500 when auth.admin.deleteUser fails', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    ;(client.auth as Record<string, unknown>).signOut = vi.fn().mockResolvedValue({})
    vi.mocked(createClient).mockResolvedValue(client)
    mockRpc.mockResolvedValue({ error: null })
    mockDeleteUser.mockResolvedValue({ error: { message: 'delete user boom' } })
    const res = await callRoute()
    expect(res.status).toBe(500)
  })

  it('returns 200 on happy path and calls both RPC and deleteUser', async () => {
    const { client, rpcSpy } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      rpcResult: { error: null },
    })
    ;(client.auth as Record<string, unknown>).signOut = vi.fn().mockResolvedValue({})
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(200)
    // The route uses the admin client's rpc, not the cookie-client's rpc.
    expect(mockRpc).toHaveBeenCalledWith('prepare_account_deletion', { p_user_id: USER_ID })
    expect(mockDeleteUser).toHaveBeenCalledWith(USER_ID)
    // rpcSpy is the cookie-client rpc; should not be called for deletion.
    expect(rpcSpy).not.toHaveBeenCalled()
  })
})
