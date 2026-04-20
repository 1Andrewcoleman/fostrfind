import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from '@/app/api/ratings/route'

const SHELTER_USER_ID = 'user-shelter-1'
const APP_ID = 'c88e2d80-4b23-4f5e-9b1f-5a1e7b4d5b2a'

function happyApp(overrides: Record<string, unknown> = {}) {
  return {
    id: APP_ID,
    status: 'completed',
    foster_id: 'foster-1',
    dog_id: 'dog-1',
    shelter_id: 'shelter-1',
    shelter: { user_id: SHELTER_USER_ID },
    ...overrides,
  }
}

function callRoute(bodyOverride?: unknown): Promise<Response> {
  const body = bodyOverride ?? { applicationId: APP_ID, score: 5, comment: 'Great fit' }
  return POST(
    new Request('http://localhost/api/ratings', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  )
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

describe('POST /api/ratings', () => {
  it('returns 400 on invalid body (missing score)', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildMockClient({ auth: buildAuth({ id: SHELTER_USER_ID }) }).client,
    )
    const res = await callRoute({ applicationId: APP_ID })
    expect(res.status).toBe(400)
  })

  it('returns 400 on non-UUID applicationId', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildMockClient({ auth: buildAuth({ id: SHELTER_USER_ID }) }).client,
    )
    const res = await callRoute({ applicationId: 'not-a-uuid', score: 5 })
    expect(res.status).toBe(400)
  })

  it('returns 400 on score out of range', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildMockClient({ auth: buildAuth({ id: SHELTER_USER_ID }) }).client,
    )
    const res = await callRoute({ applicationId: APP_ID, score: 10 })
    expect(res.status).toBe(400)
  })

  it('returns 503 on auth error', async () => {
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
      retryAfter: 20,
    })
    expect((await callRoute()).status).toBe(429)
  })

  it('returns 404 when the application does not exist', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: null, error: { message: 'nope' } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(404)
  })

  it('returns 403 when the caller does not own the shelter', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: 'other' }),
      tableResults: { applications: [{ data: happyApp() }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(403)
  })

  it('returns 409 when the application is not completed', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { applications: [{ data: happyApp({ status: 'accepted' }) }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(409)
  })

  it('returns 409 when a rating already exists (idempotency)', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        applications: [{ data: happyApp() }],
        ratings: [{ maybeSingle: { data: { id: 'existing-rating' }, error: null } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(409)
  })

  it('returns 500 when the insert fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        applications: [{ data: happyApp() }],
        ratings: [
          { maybeSingle: { data: null, error: null } },
          { data: null, error: { message: 'insert boom' } },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(500)
  })

  it('returns 200 on the happy path', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        applications: [{ data: happyApp() }],
        ratings: [
          { maybeSingle: { data: null, error: null } },
          { data: null, error: null },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute()
    expect(res.status).toBe(200)
  })
})
