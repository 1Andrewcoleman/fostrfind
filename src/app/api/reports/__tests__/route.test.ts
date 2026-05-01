import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from '@/app/api/reports/route'

const FOSTER_USER_ID = 'user-foster-1'
const SHELTER_USER_ID = 'user-shelter-1'
const APP_ID = 'c88e2d80-4b23-4f5e-9b1f-5a1e7b4d5b2a'
const FOSTER_ID = 'foster-1'
const SHELTER_ID = 'shelter-1'

function happyApp() {
  return {
    id: APP_ID,
    foster_id: FOSTER_ID,
    shelter_id: SHELTER_ID,
    foster: { user_id: FOSTER_USER_ID },
    shelter: { user_id: SHELTER_USER_ID },
  }
}

function callRoute(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost/api/reports', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  )
}

const validBody = {
  applicationId: APP_ID,
  category: 'safety' as const,
  body: 'I am concerned about how the dog was handled at pickup.',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(rateLimit).mockReturnValue({
    success: true,
    remaining: 4,
    resetAt: Date.now() + 60_000,
    retryAfter: 0,
  })
})

describe('POST /api/reports', () => {
  it('returns 503 when auth service errors', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null, { message: 'down' }) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute(validBody)).status).toBe(503)
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute(validBody)).status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: FOSTER_USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    vi.mocked(rateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfter: 30,
    })
    expect((await callRoute(validBody)).status).toBe(429)
  })

  it('returns 400 on invalid body (bad UUID)', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: FOSTER_USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect(
      (await callRoute({ ...validBody, applicationId: 'not-a-uuid' })).status,
    ).toBe(400)
  })

  it('returns 400 on invalid category', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: FOSTER_USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect(
      (await callRoute({ ...validBody, category: 'spam' })).status,
    ).toBe(400)
  })

  it('returns 400 on empty body', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: FOSTER_USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute({ ...validBody, body: '   ' })).status).toBe(400)
  })

  it('returns 404 when the application does not exist', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: { applications: [{ data: null, error: { message: 'nope' } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute(validBody)).status).toBe(404)
  })

  it('returns 403 when caller is neither foster nor shelter on the application', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: 'other-user' }),
      tableResults: { applications: [{ data: happyApp() }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute(validBody)).status).toBe(403)
  })

  it('returns 409 when a pending report already exists', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        applications: [{ data: happyApp() }],
        reports: [{ maybeSingle: { data: { id: 'existing' }, error: null } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute(validBody)).status).toBe(409)
  })

  it('returns 500 when the dedup lookup fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        applications: [{ data: happyApp() }],
        reports: [
          { maybeSingle: { data: null, error: { message: 'boom' } } },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute(validBody)).status).toBe(500)
  })

  it('returns 500 when the insert fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        applications: [{ data: happyApp() }],
        reports: [
          { maybeSingle: { data: null, error: null } },
          { single: { data: null, error: { message: 'insert boom' } } },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute(validBody)).status).toBe(500)
  })

  it('returns 200 when foster reports the shelter (happy path)', async () => {
    const { client, fromSpy } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        applications: [{ data: happyApp() }],
        reports: [
          { maybeSingle: { data: null, error: null } },
          {
            single: {
              data: { id: 'report-1', created_at: '2026-04-29T00:00:00Z' },
              error: null,
            },
          },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute(validBody)
    expect(res.status).toBe(200)
    expect(fromSpy).toHaveBeenCalledWith('reports')
  })

  it('returns 200 when shelter reports the foster (happy path)', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        applications: [{ data: happyApp() }],
        reports: [
          { maybeSingle: { data: null, error: null } },
          {
            single: {
              data: { id: 'report-2', created_at: '2026-04-29T00:00:00Z' },
              error: null,
            },
          },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute(validBody)
    expect(res.status).toBe(200)
  })
})
