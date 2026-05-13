import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { PATCH } from '@/app/api/shelters/[id]/route'

const USER_ID = 'user-shelter-1'
const OTHER_USER_ID = 'user-shelter-2'
const SHELTER_ID = '33333333-3333-4333-8333-333333333333'

// Happy-path body matches the shelterSettingsSchema shape exactly. Tests
// override individual fields by spreading `overrides`.
function happyBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Happy Tails Rescue',
    slug: 'happy-tails-rescue',
    email: 'hello@happytails.example',
    phone: '555-1212',
    location: 'Austin, TX',
    bio: 'We rehome wonderful dogs.',
    website: 'https://happytails.example',
    instagram: '@happytails',
    logo_url: 'https://example.com/logo.png',
    ...overrides,
  }
}

function callRoute(
  body: unknown = happyBody(),
  id: string = SHELTER_ID,
): Promise<Response> {
  return PATCH(
    new Request(`http://localhost/api/shelters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
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

describe('PATCH /api/shelters/[id]', () => {
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

  it('returns 404 when the shelter is missing', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: { shelters: [{ data: null }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(404)
  })

  it('returns 403 when the caller does not own the shelter row', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        shelters: [{ data: { id: SHELTER_ID, user_id: OTHER_USER_ID } }],
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
        shelters: [{ data: { id: SHELTER_ID, user_id: USER_ID } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await PATCH(
      new Request(`http://localhost/api/shelters/${SHELTER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      }),
      { params: Promise.resolve({ id: SHELTER_ID }) },
    )
    expect(res.status).toBe(400)
  })

  it('returns 422 when required fields are missing or invalid', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        shelters: [{ data: { id: SHELTER_ID, user_id: USER_ID } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute(
      happyBody({
        name: '',
        slug: 'BAD SLUG WITH SPACES',
        email: 'not-an-email',
      }),
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
    expect(body.details.name).toBeDefined()
    expect(body.details.slug).toBeDefined()
    expect(body.details.email).toBeDefined()
  })

  it('returns 200 with the updated row on the happy path and sanitizes fields', async () => {
    const updated = {
      id: SHELTER_ID,
      user_id: USER_ID,
      name: 'Happy Tails Rescue',
      bio: 'We rehome wonderful dogs.',
    }
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        shelters: [
          { data: { id: SHELTER_ID, user_id: USER_ID } },
          { single: { data: updated, error: null } },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    // Capture the update payload to assert sanitized values reach Supabase.
    let capturedUpdatePayload: Record<string, unknown> | null = null
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'shelters') {
        const originalUpdate = chain.update.bind(chain)
        chain.update = ((payload: Record<string, unknown>) => {
          capturedUpdatePayload = payload
          return originalUpdate(payload)
        }) as typeof chain.update
      }
      return chain
    }) as typeof client.from

    const res = await callRoute(
      happyBody({
        name: 'Happy <b>Tails</b> Rescue',
        location: 'Austin<script>x</script>, TX',
      }),
    )
    expect(res.status).toBe(200)

    expect(capturedUpdatePayload).not.toBeNull()
    const payload = capturedUpdatePayload as unknown as Record<string, unknown>
    expect(payload.name).toBe('Happy Tails Rescue')
    expect(payload.location).toBe('Austin, TX')
  })

  it('strips HTML tags from the bio field before update', async () => {
    // Dedicated sanitization assertion that mirrors PR #15's pattern:
    // submit a bio with HTML tags and assert the captured update payload
    // has tags stripped. Per `sanitizeMultiline`, tag-shaped substrings
    // are dropped but the inner text is preserved.
    const updated = { id: SHELTER_ID, user_id: USER_ID, bio: '' }
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        shelters: [
          { data: { id: SHELTER_ID, user_id: USER_ID } },
          { single: { data: updated, error: null } },
        ],
      },
    })

    let capturedUpdatePayload: { bio?: string | null } | null = null
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'shelters') {
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
