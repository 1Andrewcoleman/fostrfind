import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { DELETE } from '@/app/api/dogs/[id]/route'

const SHELTER_USER_ID = 'user-shelter-1'
const DOG_ID = 'dog-123'

function happyDog(overrides: Record<string, unknown> = {}) {
  return {
    id: DOG_ID,
    name: 'Buddy',
    shelter_id: 'shelter-1',
    shelter: { user_id: SHELTER_USER_ID },
    ...overrides,
  }
}

function callRoute(): Promise<Response> {
  return DELETE(new Request('http://localhost/api/dogs/dog-123', { method: 'DELETE' }), {
    params: { id: DOG_ID },
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

describe('DELETE /api/dogs/[id]', () => {
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
      retryAfter: 30,
    })
    expect((await callRoute()).status).toBe(429)
  })

  it('returns 404 when the dog is not found', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { dogs: [{ data: null, error: { message: 'nope' } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(404)
  })

  it('returns 403 when the caller does not own the shelter', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: 'other' }),
      tableResults: { dogs: [{ data: happyDog() }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(403)
  })

  it('returns 409 when the dog has active applications', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        dogs: [{ data: happyDog() }],
        applications: [{ count: 2, error: null }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute()
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/active applications/i)
  })

  it('returns 500 when the delete itself fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        dogs: [
          { data: happyDog() },
          { data: null, error: { message: 'delete boom' } },
        ],
        applications: [{ count: 0, error: null }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(500)
  })

  it('returns 200 on the happy path (no blocking applications)', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        dogs: [
          { data: happyDog() },
          { data: null, error: null },
        ],
        applications: [{ count: 0, error: null }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.dogId).toBe(DOG_ID)
  })

  it('treats null count the same as zero', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        dogs: [
          { data: happyDog() },
          { data: null, error: null },
        ],
        applications: [{ count: null, error: null }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(200)
  })
})
