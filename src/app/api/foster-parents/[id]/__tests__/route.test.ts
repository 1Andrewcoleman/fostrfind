import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { PATCH } from '@/app/api/foster-parents/[id]/route'

const USER_ID = 'user-foster-1'
const OTHER_USER_ID = 'user-foster-2'
const FOSTER_ID = '11111111-1111-4111-8111-111111111111'

// Happy-path body matches the fosterProfileSchema shape exactly. Tests
// override individual fields by spreading `overrides`.
function happyBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    first_name: 'Pat',
    last_name: 'Doe',
    email: 'pat@example.com',
    phone: '555-1212',
    location: 'Austin, TX',
    housing_type: 'house',
    has_yard: true,
    has_other_pets: false,
    other_pets_info: '',
    has_children: false,
    children_info: '',
    experience: 'some',
    bio: 'I love dogs.',
    pref_size: ['medium'],
    pref_age: ['adult'],
    pref_medical: false,
    max_distance: 25,
    avatar_url: 'https://example.com/avatar.png',
    ...overrides,
  }
}

function callRoute(
  body: unknown = happyBody(),
  id: string = FOSTER_ID,
): Promise<Response> {
  return PATCH(
    new Request(`http://localhost/api/foster-parents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(rateLimit).mockResolvedValue({
    success: true,
    remaining: 19,
    resetAt: Date.now() + 60_000,
    retryAfter: 0,
  })
})

describe('PATCH /api/foster-parents/[id]', () => {
  it('returns 503 when auth service errors', async () => {
    const { client } = buildMockClient({
      auth: buildAuth(null, { message: 'Supabase down' }),
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(503)
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)

    expect((await callRoute()).status).toBe(401)
  })

  it('returns 429 when rate limit is exhausted', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    vi.mocked(rateLimit).mockResolvedValue({
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
      auth: buildAuth({ id: USER_ID }),
      tableResults: { foster_parents: [{ data: null }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(404)
  })

  it('returns 403 when the caller does not own the foster row', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID, user_id: OTHER_USER_ID } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(403)
  })

  it('returns 400 when the body is not valid JSON', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID, user_id: USER_ID } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await PATCH(
      new Request(`http://localhost/api/foster-parents/${FOSTER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      }),
      { params: Promise.resolve({ id: FOSTER_ID }) },
    )
    expect(res.status).toBe(400)
  })

  it('returns 422 when required fields are missing or invalid', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID, user_id: USER_ID } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute(
      happyBody({
        first_name: '',
        location: '',
      }),
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
    expect(body.details.first_name).toBeDefined()
    expect(body.details.location).toBeDefined()
    // email is not part of the PATCH schema; email changes go through
    // Supabase Auth updateUser — so there is no email validation error here
  })

  it('returns 200 with the updated row on the happy path and sanitizes fields', async () => {
    const updated = {
      id: FOSTER_ID,
      user_id: USER_ID,
      first_name: 'Pat',
      last_name: 'Doe',
      bio: 'I love dogs.',
    }
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        foster_parents: [
          { data: { id: FOSTER_ID, user_id: USER_ID } },
          { single: { data: updated, error: null } },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    // Capture the update payload to assert sanitized values reach
    // Supabase. The mock returns a chainable object via `.from(table)`;
    // we wrap `.update` to record the argument before delegating.
    let capturedUpdatePayload: Record<string, unknown> | null = null
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'foster_parents') {
        const originalUpdate = chain.update.bind(chain)
        chain.update = ((payload: Record<string, unknown>) => {
          // Only capture the actual mutation, not the lookup (which
          // calls `.select()` first and never reaches `.update`).
          capturedUpdatePayload = payload
          return originalUpdate(payload)
        }) as typeof chain.update
      }
      return chain
    }) as typeof client.from

    const res = await callRoute(
      happyBody({
        bio: 'I <script>alert(1)</script> love <b>dogs</b>.',
        first_name: '<b>Pat</b>',
        location: 'Austin<script></script>, TX',
      }),
    )
    expect(res.status).toBe(200)

    expect(capturedUpdatePayload).not.toBeNull()
    const payload = capturedUpdatePayload as unknown as Record<string, unknown>
    expect(payload.bio).toBe('I alert(1) love dogs.')
    expect(payload.first_name).toBe('Pat')
    expect(payload.location).toBe('Austin, TX')
  })

  it('does not include email in the update payload', async () => {
    // email is removed from fosterProfilePatchSchema so a body-supplied
    // email can never overwrite foster_parents.email. Email changes must
    // go through Supabase Auth updateUser which triggers re-verification.
    const updated = { id: FOSTER_ID, user_id: USER_ID, first_name: 'Pat' }
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        foster_parents: [
          { data: { id: FOSTER_ID, user_id: USER_ID } },
          { single: { data: updated, error: null } },
        ],
      },
    })

    let capturedUpdatePayload: Record<string, unknown> | null = null
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'foster_parents') {
        const originalUpdate = chain.update.bind(chain)
        chain.update = ((payload: Record<string, unknown>) => {
          capturedUpdatePayload = payload
          return originalUpdate(payload)
        }) as typeof chain.update
      }
      return chain
    }) as typeof client.from

    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute(happyBody({ email: 'hacker@attacker.com' }))
    expect(res.status).toBe(200)
    expect(capturedUpdatePayload).not.toBeNull()
    expect('email' in (capturedUpdatePayload as unknown as Record<string, unknown>)).toBe(false)
  })

  it('strips HTML tags from the bio field before update', async () => {
    // Dedicated sanitization assertion that mirrors PR #15's pattern:
    // submit a bio with HTML tags and assert the captured update payload
    // has tags stripped. Per `sanitizeMultiline`, tag-shaped substrings
    // are dropped but the inner text is preserved.
    const updated = { id: FOSTER_ID, user_id: USER_ID, bio: '' }
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        foster_parents: [
          { data: { id: FOSTER_ID, user_id: USER_ID } },
          { single: { data: updated, error: null } },
        ],
      },
    })

    let capturedUpdatePayload: { bio?: string | null } | null = null
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'foster_parents') {
        const originalUpdate = chain.update.bind(chain)
        chain.update = ((payload: { bio?: string | null }) => {
          capturedUpdatePayload = payload
          return originalUpdate(payload)
        }) as typeof chain.update
      }
      return chain
    }) as typeof client.from

    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute(
      happyBody({
        bio: 'Hi <script>alert(1)</script> <b>there</b>',
      }),
    )

    expect(res.status).toBe(200)
    expect(capturedUpdatePayload).not.toBeNull()
    expect(capturedUpdatePayload!.bio).toBe('Hi alert(1) there')
  })
})
