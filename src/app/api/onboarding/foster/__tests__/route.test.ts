import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from '@/app/api/onboarding/foster/route'

const USER_ID = 'user-foster-onboarder-1'

function happyBody(overrides: Record<string, unknown> = {}) {
  return {
    first_name: 'Pat',
    last_name: 'Doe',
    email: 'pat@example.com',
    phone: '(555) 111-2222',
    location: 'Austin, TX',
    housing_type: 'house',
    has_yard: true,
    has_other_pets: false,
    other_pets_info: '',
    has_children: false,
    children_info: '',
    experience: 'some',
    bio: 'Long-time dog person.',
    ...overrides,
  }
}

function callRoute(body: unknown = happyBody()): Promise<Response> {
  return POST(
    new Request('http://localhost/api/onboarding/foster', {
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
    remaining: 4,
    resetAt: Date.now() + 60_000,
    retryAfter: 0,
  })
})

describe('POST /api/onboarding/foster', () => {
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
    expect(res.headers.get('Retry-After')).toBe('30')
  })

  it('returns 400 when the body is not valid JSON', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await POST(
      new Request('http://localhost/api/onboarding/foster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 422 when required fields are missing or invalid', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute(
      happyBody({
        first_name: '',
        last_name: '',
        email: 'not-an-email',
        location: '',
      }),
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
    expect(body.details.first_name).toBeDefined()
    expect(body.details.last_name).toBeDefined()
    expect(body.details.email).toBeDefined()
    expect(body.details.location).toBeDefined()
  })

  it('returns 409 when the user already has a foster_parents row', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: 'existing-foster-id' } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'You have already completed foster onboarding',
    })
  })

  it('returns 500 when the insert fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        foster_parents: [
          // existing-row check passes
          { maybeSingle: { data: null, error: null } },
          // insert returns an error
          { single: { data: null, error: { message: 'insert boom' } } },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await callRoute()
      expect(res.status).toBe(500)
    } finally {
      errSpy.mockRestore()
    }
  })

  it('returns 201 on the happy path and inserts a sanitized payload with the authenticated user_id', async () => {
    // Capture the insert payload so we can assert it carries the
    // authenticated user_id (NEVER from the request body) and that the
    // sanitized values are what hits the DB.
    let capturedInsertPayload: Record<string, unknown> | null = null

    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        foster_parents: [
          // existing-row check passes
          { maybeSingle: { data: null, error: null } },
          // insert returns the new row
          {
            single: {
              data: {
                id: 'new-foster-id',
                first_name: 'Pat',
                last_name: 'Doe',
                email: 'pat@example.com',
              },
              error: null,
            },
          },
        ],
        // invite-claim UPDATE on `shelter_foster_invites` — bare awaited
        // chain, no error.
        shelter_foster_invites: [{ data: null, error: null }],
      },
    })
    // Intercept `.insert` on foster_parents to capture the payload.
    // The shelter_foster_invites .update() runs after; we don't need
    // to capture it but we don't want to break the chain either.
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'foster_parents') {
        const originalInsert = chain.insert.bind(chain)
        chain.insert = ((payload: Record<string, unknown>) => {
          capturedInsertPayload = payload
          return originalInsert(payload)
        }) as typeof chain.insert
      }
      return chain
    }) as typeof client.from

    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({
      id: 'new-foster-id',
      first_name: 'Pat',
      last_name: 'Doe',
    })

    expect(capturedInsertPayload).not.toBeNull()
    const payload = capturedInsertPayload as unknown as Record<string, unknown>
    expect(payload.user_id).toBe(USER_ID)
    expect(payload.first_name).toBe('Pat')
    expect(payload.last_name).toBe('Doe')
    expect(payload.email).toBe('pat@example.com')
    expect(payload.location).toBe('Austin, TX')
    expect(payload.housing_type).toBe('house')
    expect(payload.experience).toBe('some')
    expect(payload.has_yard).toBe(true)
    expect(payload.has_other_pets).toBe(false)
    expect(payload.has_children).toBe(false)
  })

  it('strips HTML tags from the bio before insert', async () => {
    let capturedInsertPayload: Record<string, unknown> | null = null

    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        foster_parents: [
          { maybeSingle: { data: null, error: null } },
          {
            single: {
              data: {
                id: 'new-foster-id',
                first_name: 'Pat',
                last_name: 'Doe',
                email: 'pat@example.com',
              },
              error: null,
            },
          },
        ],
        shelter_foster_invites: [{ data: null, error: null }],
      },
    })
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'foster_parents') {
        const originalInsert = chain.insert.bind(chain)
        chain.insert = ((payload: Record<string, unknown>) => {
          capturedInsertPayload = payload
          return originalInsert(payload)
        }) as typeof chain.insert
      }
      return chain
    }) as typeof client.from

    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute(
      happyBody({
        bio: 'Long-time <script>alert(1)</script> dog <b>person</b>.',
      }),
    )
    expect(res.status).toBe(201)

    expect(capturedInsertPayload).not.toBeNull()
    const payload = capturedInsertPayload as unknown as Record<string, unknown>
    // `sanitizeMultiline` strips tag-shaped substrings; content remains.
    expect(payload.bio).toBe('Long-time alert(1) dog person.')
  })
})
