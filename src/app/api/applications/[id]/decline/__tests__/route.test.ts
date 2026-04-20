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
import { POST } from '@/app/api/applications/[id]/decline/route'

const SHELTER_USER_ID = 'user-shelter-1'
const APP_ID = 'app-123'

function happyApp(overrides: Record<string, unknown> = {}) {
  return {
    status: 'submitted',
    dog: { name: 'Buddy' },
    foster: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
    shelter: { user_id: SHELTER_USER_ID, name: 'Happy Tails' },
    ...overrides,
  }
}

function callRoute(): Promise<Response> {
  return POST(new Request('http://localhost/api/applications/app-123/decline', { method: 'POST' }), {
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
})

describe('POST /api/applications/[id]/decline', () => {
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
      retryAfter: 30,
    })
    const res = await callRoute()
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
  })

  it('returns 404 when application is not found', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: null, error: { message: 'nope' } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(404)
  })

  it('returns 403 when a different shelter calls decline', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: 'someone-else' }),
      tableResults: { applications: [{ data: happyApp() }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(403)
  })

  it('returns 409 when status is not submitted or reviewing', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: happyApp({ status: 'accepted' }) }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(409)
  })

  it('returns 500 when the update fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        applications: [
          { data: happyApp() },
          { data: null, error: { message: 'update boom' } },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(500)
  })

  it('returns 200 on the happy path and emails the foster', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        applications: [
          { data: happyApp() },
          { data: null, error: null },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute()
    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({
      to: 'jane@example.com',
    })
  })

  it('does not email when foster email is missing', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        applications: [
          {
            data: happyApp({
              foster: { first_name: 'Jane', last_name: 'Doe', email: null },
            }),
          },
          { data: null, error: null },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute()
    expect(res.status).toBe(200)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
