import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from '@/app/api/applications/route'

const FOSTER_USER_ID = 'user-foster-1'
const FOSTER_ID = '11111111-1111-4111-8111-111111111111'
const DOG_ID = '22222222-2222-4222-8222-222222222222'
const SHELTER_ID = '33333333-3333-4333-8333-333333333333'

// Submission body uses a date five days out so the "not before today"
// refinement always passes regardless of when the suite runs.
function futureDate(daysAhead: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

function happyBody(overrides: Record<string, unknown> = {}) {
  return {
    dog_id: DOG_ID,
    shelter_id: SHELTER_ID,
    available_from: futureDate(5),
    available_until: futureDate(60),
    why_this_dog: 'I love this pup and have plenty of room and time for them.',
    emergency_contact_name: 'Pat Doe',
    emergency_contact_phone: '+1-555-555-1212',
    responsibilities_acknowledged: true,
    note: 'Looking forward to meeting them.',
    ...overrides,
  }
}

function callRoute(body: unknown = happyBody()): Promise<Response> {
  return POST(
    new Request('http://localhost/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
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

describe('POST /api/applications', () => {
  it('returns 503 when auth service errors', async () => {
    const { client } = buildMockClient({
      auth: buildAuth(null, { message: 'Supabase down' }),
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'Authentication service unavailable' })
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)

    expect((await callRoute()).status).toBe(401)
  })

  it('returns 429 when rate limit is exhausted', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: FOSTER_USER_ID }) })
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

  it('returns 404 when the foster profile is missing', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: { foster_parents: [{ data: null }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Foster profile not found' })
  })

  it('returns 400 when the body is not valid JSON', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: { foster_parents: [{ data: { id: FOSTER_ID } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await POST(
      new Request('http://localhost/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 422 when required fields are missing or invalid', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: { foster_parents: [{ data: { id: FOSTER_ID } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute(
      happyBody({
        why_this_dog: 'short',
        responsibilities_acknowledged: false,
      }),
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
    expect(body.details.why_this_dog).toBeDefined()
    expect(body.details.responsibilities_acknowledged).toBeDefined()
  })

  it('returns 404 when the dog does not exist', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID } }],
        dogs: [{ data: null }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Dog not found' })
  })

  it('returns 400 when shelter_id does not match the dog', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID } }],
        dogs: [
          {
            data: { id: DOG_ID, shelter_id: 'other-shelter', status: 'available' },
          },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(400)
  })

  it('returns 409 when the dog is no longer available', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID } }],
        dogs: [
          {
            data: { id: DOG_ID, shelter_id: SHELTER_ID, status: 'pending' },
          },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(409)
  })

  it('returns 409 when a duplicate application already exists', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID } }],
        dogs: [
          {
            data: { id: DOG_ID, shelter_id: SHELTER_ID, status: 'available' },
          },
        ],
        applications: [{ data: { id: 'existing-app-id' } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'You have already applied for this dog' })
  })

  it('returns 409 on Postgres unique-violation race', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID } }],
        dogs: [
          {
            data: { id: DOG_ID, shelter_id: SHELTER_ID, status: 'available' },
          },
        ],
        applications: [
          { data: null }, // duplicate check passes
          {
            single: {
              data: null,
              error: { code: '23505', message: 'duplicate key' },
            },
          },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await callRoute()
      expect(res.status).toBe(409)
    } finally {
      errSpy.mockRestore()
    }
  })

  it('returns 201 with the inserted row on the happy path', async () => {
    const inserted = {
      id: 'new-app-id',
      dog_id: DOG_ID,
      foster_id: FOSTER_ID,
      shelter_id: SHELTER_ID,
      status: 'submitted',
    }
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID } }],
        dogs: [
          {
            data: { id: DOG_ID, shelter_id: SHELTER_ID, status: 'available' },
          },
        ],
        applications: [
          { data: null }, // duplicate check passes
          { single: { data: inserted, error: null } },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ id: 'new-app-id', status: 'submitted' })
  })
})
