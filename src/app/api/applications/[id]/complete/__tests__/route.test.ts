import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
  getAppUrl: () => 'http://localhost:3000',
}))

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'
import { POST } from '@/app/api/applications/[id]/complete/route'

const SHELTER_USER_ID = 'user-shelter-1'
const APP_ID = 'app-123'

function happyApp(overrides: Record<string, unknown> = {}) {
  return {
    status: 'accepted',
    dog_id: 'dog-1',
    dog: { name: 'Buddy' },
    foster: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
    shelter: { user_id: SHELTER_USER_ID, name: 'Happy Tails', email: 'shelter@example.com' },
    ...overrides,
  }
}

function callRoute(): Promise<Response> {
  return POST(new Request('http://localhost/api/applications/app-123/complete', { method: 'POST' }), {
    params: { id: APP_ID },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(rateLimit).mockReturnValue({
    success: true,
    remaining: 9,
    resetAt: Date.now() + 60_000,
    retryAfter: 0,
  })
})

describe('POST /api/applications/[id]/complete', () => {
  it('returns 503 on auth service error', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null, { message: 'down' }) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(503)
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: SHELTER_USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    vi.mocked(rateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfter: 45,
    })
    expect((await callRoute()).status).toBe(429)
  })

  it('returns 404 when application is not found', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: null, error: { message: 'nope' } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(404)
  })

  it('returns 403 when a different shelter tries to complete', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: 'other' }),
      tableResults: { applications: [{ data: happyApp() }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(403)
  })

  it('returns 409 when the application is not in accepted state', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: happyApp({ status: 'submitted' }) }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(409)
  })

  it('returns 500 when the atomic RPC fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: happyApp() }] },
      rpcResult: { error: { message: 'rpc boom' } },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(500)
  })

  it('returns 200 on happy path and fires both foster + shelter emails', async () => {
    const { client, rpcSpy } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: happyApp() }] },
      rpcResult: { error: null },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.promptRating).toBe(true)
    expect(rpcSpy).toHaveBeenCalledWith('complete_application', { app_id: APP_ID })
    expect(sendEmail).toHaveBeenCalledTimes(2)
    const recipients = vi.mocked(sendEmail).mock.calls.map((c) => (c[0] as { to: string }).to)
    expect(recipients).toContain('jane@example.com')
    expect(recipients).toContain('shelter@example.com')
  })

  it('skips both emails when both addresses are missing', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        applications: [
          {
            data: happyApp({
              foster: { first_name: 'Jane', last_name: 'Doe', email: null },
              shelter: { user_id: SHELTER_USER_ID, name: 'Happy Tails', email: null },
            }),
          },
        ],
      },
      rpcResult: { error: null },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(200)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
