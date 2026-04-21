import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

// Mock hoisting: vi.mock() calls get lifted above the imports below.
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return {
    ...actual,
    rateLimit: vi.fn(),
  }
})
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
  getAppUrl: () => 'http://localhost:3000',
}))

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'
import { POST } from '@/app/api/applications/[id]/accept/route'

const SHELTER_USER_ID = 'user-shelter-1'
const OTHER_USER_ID = 'user-other'
const APP_ID = 'app-123'
const SHELTER_ID = 'shelter-1'
const FOSTER_ID = 'foster-1'

function happyApp(overrides: Record<string, unknown> = {}) {
  return {
    status: 'submitted',
    dog_id: 'dog-1',
    foster_id: FOSTER_ID,
    shelter_id: SHELTER_ID,
    dog: { name: 'Buddy' },
    foster: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
    shelter: { user_id: SHELTER_USER_ID, name: 'Happy Tails' },
    ...overrides,
  }
}

/**
 * Minimal mock for the service client — records upsert calls into the
 * roster table so tests can assert arguments. `shouldFail` and
 * `shouldThrow` let individual tests exercise the failure branches.
 */
function buildMockServiceClient(opts: { shouldFail?: boolean; shouldThrow?: boolean } = {}) {
  const upsertSpy = vi.fn(() =>
    Promise.resolve({
      data: null,
      error: opts.shouldFail ? { message: 'permission denied' } : null,
    }),
  )
  const fromSpy = vi.fn(() => ({ upsert: upsertSpy }))
  const svc = { from: fromSpy }
  vi.mocked(createServiceClient).mockImplementation(() => {
    if (opts.shouldThrow) throw new Error('service client unavailable')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return svc as any
  })
  return { upsertSpy, fromSpy }
}

function callRoute(): Promise<Response> {
  return POST(new Request('http://localhost/api/applications/app-123/accept', { method: 'POST' }), {
    params: { id: APP_ID },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(rateLimit).mockReturnValue({
    success: true,
    remaining: 19,
    resetAt: Date.now() + 60_000,
    retryAfter: 0,
  })
  // Sensible default: service client succeeds. Individual tests override.
  buildMockServiceClient()
})

describe('POST /api/applications/[id]/accept', () => {
  it('returns 503 when auth service errors', async () => {
    const { client } = buildMockClient({
      auth: buildAuth(null, { message: 'Supabase down' }),
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('Authentication service unavailable')
  })

  it('returns 401 when no user is authenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limit is exhausted', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: SHELTER_USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    vi.mocked(rateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfter: 30,
    })

    const res = await callRoute()
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
  })

  it('returns 404 when the application is not found', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: null, error: { message: 'not found' } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(404)
  })

  it('returns 403 when a different shelter tries to accept', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: OTHER_USER_ID }),
      tableResults: { applications: [{ data: happyApp() }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(403)
  })

  it('returns 409 when the application is already accepted', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: happyApp({ status: 'accepted' }) }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(409)
  })

  it('returns 500 when the atomic transition RPC fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: happyApp() }] },
      rpcResult: { error: { message: 'rpc boom' } },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(500)
  })

  it('returns 200 on the happy path and fires the accept email', async () => {
    const { client, rpcSpy } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: happyApp() }] },
      rpcResult: { error: null },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(200)
    expect(rpcSpy).toHaveBeenCalledWith('accept_application', { app_id: APP_ID })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({
      to: 'jane@example.com',
      subject: expect.stringContaining('Buddy'),
    })
  })

  it('upserts the foster into the shelter roster on accept', async () => {
    const { upsertSpy, fromSpy } = buildMockServiceClient()
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: happyApp() }] },
      rpcResult: { error: null },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(200)
    expect(fromSpy).toHaveBeenCalledWith('shelter_fosters')
    expect(upsertSpy).toHaveBeenCalledWith(
      { shelter_id: SHELTER_ID, foster_id: FOSTER_ID, source: 'application_accepted' },
      { onConflict: 'shelter_id,foster_id', ignoreDuplicates: true },
    )
  })

  it('still returns 200 if the roster upsert errors (idempotent + soft-failure)', async () => {
    buildMockServiceClient({ shouldFail: true })
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: happyApp() }] },
      rpcResult: { error: null },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await callRoute()
      expect(res.status).toBe(200)
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('roster upsert failed'),
        expect.any(String),
      )
    } finally {
      errSpy.mockRestore()
    }
  })

  it('still returns 200 if the service client throws (DEV_MODE / missing env)', async () => {
    buildMockServiceClient({ shouldThrow: true })
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: happyApp() }] },
      rpcResult: { error: null },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await callRoute()
      expect(res.status).toBe(200)
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('roster upsert threw'),
        expect.any(String),
      )
    } finally {
      errSpy.mockRestore()
    }
  })

  it('does NOT send email when foster email is missing', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        applications: [
          {
            data: happyApp({
              foster: { first_name: 'Jane', last_name: 'Doe', email: null },
            }),
          },
        ],
      },
      rpcResult: { error: null },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(200)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
