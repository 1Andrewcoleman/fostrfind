import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from '@/app/api/onboarding/shelter/route'

const USER_ID = 'user-shelter-onboarder-1'
const USER_EMAIL = 'info@happypaws.org'
const USER_EMAIL_CONFIRMED = '2026-01-01T00:00:00Z'

function happyBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Happy Paws Rescue',
    email: 'info@happypaws.org',
    phone: '(555) 000-0000',
    location: 'Austin, TX',
    ein: '12-3456789',
    bio: 'We rescue dogs in central Texas.',
    website: 'https://happypaws.org',
    instagram: '@happypaws',
    ...overrides,
  }
}

function callRoute(body: unknown = happyBody()): Promise<Response> {
  return POST(
    new Request('http://localhost/api/onboarding/shelter', {
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

describe('POST /api/onboarding/shelter', () => {
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
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID, email: USER_EMAIL, email_confirmed_at: USER_EMAIL_CONFIRMED }) })
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
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID, email: USER_EMAIL, email_confirmed_at: USER_EMAIL_CONFIRMED }) })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await POST(
      new Request('http://localhost/api/onboarding/shelter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 422 when required fields are missing or invalid', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID, email: USER_EMAIL, email_confirmed_at: USER_EMAIL_CONFIRMED }) })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute(
      happyBody({ name: '', location: '' }),
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
    expect(body.details.name).toBeDefined()
    expect(body.details.location).toBeDefined()
    // email is not part of the server onboarding schema — it comes from
    // the auth context (user.email), so there is no email validation error
  })

  it('returns 409 when the user already has a shelter row', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID, email: USER_EMAIL, email_confirmed_at: USER_EMAIL_CONFIRMED }),
      tableResults: {
        shelters: [{ data: { id: 'existing-shelter-id' } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'You have already completed shelter onboarding',
    })
  })

  it('returns 500 when the existing-row check fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID, email: USER_EMAIL, email_confirmed_at: USER_EMAIL_CONFIRMED }),
      tableResults: {
        shelters: [
          {
            maybeSingle: {
              data: null,
              error: { message: 'connection refused' },
            },
          },
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

  it('returns 500 when the insert fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID, email: USER_EMAIL, email_confirmed_at: USER_EMAIL_CONFIRMED }),
      tableResults: {
        shelters: [
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

  it('returns 409 on Postgres unique-violation race', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID, email: USER_EMAIL, email_confirmed_at: USER_EMAIL_CONFIRMED }),
      tableResults: {
        shelters: [
          { maybeSingle: { data: null, error: null } },
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

  it('returns 201 on the happy path and inserts a sanitized payload with the authenticated user_id', async () => {
    // Capture the insert payload so we can assert it carries the
    // authenticated user_id (NEVER from the request body) and that the
    // sanitized values are what hits the DB.
    let capturedInsertPayload: Record<string, unknown> | null = null

    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID, email: USER_EMAIL, email_confirmed_at: USER_EMAIL_CONFIRMED }),
      tableResults: {
        shelters: [
          { maybeSingle: { data: null, error: null } },
          {
            single: {
              data: {
                id: 'new-shelter-id',
                slug: 'happy-paws-rescue-abcd',
                name: 'Happy Paws Rescue',
              },
              error: null,
            },
          },
        ],
      },
    })
    // Intercept `.insert` on the shelters table to capture the payload.
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'shelters') {
        const originalInsert = chain.insert.bind(chain)
        chain.insert = ((payload: Record<string, unknown>) => {
          // Two `.from('shelters')` calls happen in this route: the
          // existing-row check (.select) and the insert. Only the
          // second touches `.insert`, so this captures only the real
          // insert payload.
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
    expect(body).toMatchObject({ id: 'new-shelter-id', name: 'Happy Paws Rescue' })

    expect(capturedInsertPayload).not.toBeNull()
    const payload = capturedInsertPayload as unknown as Record<string, unknown>
    expect(payload.user_id).toBe(USER_ID)
    expect(payload.name).toBe('Happy Paws Rescue')
    expect(payload.location).toBe('Austin, TX')
    // email is pinned to user.email (from auth), not the request body
    expect(payload.email).toBe(USER_EMAIL)
    expect(payload.ein).toBe('12-3456789')
    // Slug format: slugified name + 4 random chars from base36
    expect(payload.slug).toMatch(/^happy-paws-rescue-[a-z0-9]{1,4}$/)
  })

  it('returns 403 when the user email is not yet confirmed', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID, email: USER_EMAIL }),
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(403)
    expect((await res.json()).error).toContain('verify your email')
  })

  it('pins insert email to user.email regardless of the email in the request body', async () => {
    let capturedInsertPayload: Record<string, unknown> | null = null

    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID, email: 'auth@shelter.example', email_confirmed_at: USER_EMAIL_CONFIRMED }),
      tableResults: {
        shelters: [
          { maybeSingle: { data: null, error: null } },
          {
            single: {
              data: { id: 'new-shelter-id', slug: 'happy-paws-rescue-abcd', name: 'Happy Paws Rescue' },
              error: null,
            },
          },
        ],
      },
    })
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'shelters') {
        const originalInsert = chain.insert.bind(chain)
        chain.insert = ((payload: Record<string, unknown>) => {
          capturedInsertPayload = payload
          return originalInsert(payload)
        }) as typeof chain.insert
      }
      return chain
    }) as typeof client.from

    vi.mocked(createClient).mockResolvedValue(client)

    // Body supplies a different email — the server must ignore it.
    const res = await callRoute(happyBody({ email: 'hacker@attacker.com' }))
    expect(res.status).toBe(201)
    expect(capturedInsertPayload).not.toBeNull()
    expect((capturedInsertPayload as unknown as Record<string, unknown>).email).toBe('auth@shelter.example')
  })

  it('strips HTML tags from the bio before insert', async () => {
    let capturedInsertPayload: Record<string, unknown> | null = null

    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID, email: USER_EMAIL, email_confirmed_at: USER_EMAIL_CONFIRMED }),
      tableResults: {
        shelters: [
          { maybeSingle: { data: null, error: null } },
          {
            single: {
              data: {
                id: 'new-shelter-id',
                slug: 'happy-paws-rescue-abcd',
                name: 'Happy Paws Rescue',
              },
              error: null,
            },
          },
        ],
      },
    })
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'shelters') {
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
        bio: 'We <script>alert(1)</script> rescue <b>dogs</b>.',
      }),
    )
    expect(res.status).toBe(201)

    expect(capturedInsertPayload).not.toBeNull()
    const payload = capturedInsertPayload as unknown as Record<string, unknown>
    // `sanitizeMultiline` strips tag-shaped substrings; content remains.
    expect(payload.bio).toBe('We alert(1) rescue dogs.')
  })
})
