import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from '@/app/api/dogs/route'

const SHELTER_USER_ID = 'user-shelter-1'
const SHELTER_ID = '33333333-3333-4333-8333-333333333333'
const DOG_ID = '22222222-2222-4222-8222-222222222222'

function happyBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Buddy',
    breed: 'Lab Mix',
    age: 'young',
    size: 'medium',
    gender: 'male',
    temperament: 'Calm, gentle.',
    medical_status: 'Vaccinated, neutered.',
    special_needs: 'Slow intro to cats.',
    description: 'A friendly pup looking for a foster home.',
    photos: ['https://example.com/photos/buddy-1.jpg'],
    ...overrides,
  }
}

function callRoute(body: unknown = happyBody()): Promise<Response> {
  return POST(
    new Request('http://localhost/api/dogs', {
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
    remaining: 29,
    resetAt: Date.now() + 60_000,
    retryAfter: 0,
  })
})

describe('POST /api/dogs', () => {
  it('returns 503 when auth service errors', async () => {
    const { client } = buildMockClient({
      auth: buildAuth(null, { message: 'down' }),
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

  it('returns 403 when the caller does not own a shelter', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { shelters: [{ data: null }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Caller is not a shelter' })
  })

  it('returns 400 when the body is not valid JSON', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { shelters: [{ data: { id: SHELTER_ID } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await POST(
      new Request('http://localhost/api/dogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 422 when required fields are missing or invalid', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { shelters: [{ data: { id: SHELTER_ID } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    // Missing `name` — required field.
    const res = await callRoute(happyBody({ name: '' }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
    expect(body.details.name).toBeDefined()
  })

  it('returns 422 when photos exceed the max', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { shelters: [{ data: { id: SHELTER_ID } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    // 6 photos > MAX_DOG_PHOTOS (5).
    const tooMany = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}.jpg`)
    const res = await callRoute(happyBody({ photos: tooMany }))
    expect(res.status).toBe(422)
  })

  it('returns 422 when a photo URL is malformed', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { shelters: [{ data: { id: SHELTER_ID } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute(happyBody({ photos: ['not a url'] }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.details.photos).toBeDefined()
  })

  it('returns 500 when the insert itself fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelters: [{ data: { id: SHELTER_ID } }],
        dogs: [{ single: { data: null, error: { message: 'insert boom' } } }],
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

  it('returns 201 with the inserted row on the happy path', async () => {
    const inserted = {
      id: DOG_ID,
      shelter_id: SHELTER_ID,
      name: 'Buddy',
      breed: 'Lab Mix',
      status: 'available',
    }
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelters: [{ data: { id: SHELTER_ID } }],
        dogs: [{ single: { data: inserted, error: null } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute()
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ id: DOG_ID, name: 'Buddy' })
  })

  it('forces shelter_id from the resolved shelter row, ignoring the request body', async () => {
    // Even if the client submits a shelter_id, the server MUST use the one
    // it resolved from auth.uid(). Capture the insert payload to assert.
    type InsertPayload = { shelter_id?: string }
    let capturedInsertPayload: InsertPayload | null = null
    const inserted = {
      id: DOG_ID,
      shelter_id: SHELTER_ID,
      name: 'Buddy',
    }
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelters: [{ data: { id: SHELTER_ID } }],
        dogs: [{ single: { data: inserted, error: null } }],
      },
    })
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'dogs') {
        const originalInsert = chain.insert.bind(chain)
        chain.insert = ((payload: InsertPayload) => {
          capturedInsertPayload = payload
          return originalInsert(payload)
        }) as typeof chain.insert
      }
      return chain
    }) as typeof client.from
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute(
      happyBody({ shelter_id: 'attacker-supplied-shelter-id' }),
    )
    expect(res.status).toBe(201)
    expect(capturedInsertPayload).not.toBeNull()
    expect(capturedInsertPayload!.shelter_id).toBe(SHELTER_ID)
  })

  it('strips HTML tags from text fields before insert', async () => {
    // sanitizeText strips tag-shaped substrings and collapses whitespace.
    // sanitizeMultiline preserves paragraph breaks. Capture the insert
    // payload and assert each field reflects the sanitised value — the
    // same pattern PR #15 (foster-invites) uses for its sanitisation test.
    type TextPayload = {
      name?: string
      breed?: string | null
      temperament?: string | null
      medical_status?: string | null
      special_needs?: string | null
      description?: string | null
    }
    let capturedInsertPayload: TextPayload | null = null
    const inserted = {
      id: DOG_ID,
      shelter_id: SHELTER_ID,
      name: 'Buddy',
    }
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelters: [{ data: { id: SHELTER_ID } }],
        dogs: [{ single: { data: inserted, error: null } }],
      },
    })
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'dogs') {
        const originalInsert = chain.insert.bind(chain)
        chain.insert = ((payload: TextPayload) => {
          capturedInsertPayload = payload
          return originalInsert(payload)
        }) as typeof chain.insert
      }
      return chain
    }) as typeof client.from
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute(
      happyBody({
        name: '<b>Buddy</b> the <script>alert(1)</script>Brave',
        breed: '<i>Lab</i> Mix',
        temperament: '<span>Calm</span> and gentle',
        medical_status: '<b>Vaccinated</b>',
        special_needs: '<em>Slow intro</em> to cats',
        description: 'Line one <script>alert(1)</script>\n\nLine two <b>bold</b>',
      }),
    )

    expect(res.status).toBe(201)
    expect(capturedInsertPayload).not.toBeNull()
    expect(capturedInsertPayload!.name).toBe('Buddy the alert(1)Brave')
    expect(capturedInsertPayload!.breed).toBe('Lab Mix')
    expect(capturedInsertPayload!.temperament).toBe('Calm and gentle')
    expect(capturedInsertPayload!.medical_status).toBe('Vaccinated')
    expect(capturedInsertPayload!.special_needs).toBe('Slow intro to cats')
    // sanitizeMultiline preserves the blank line between paragraphs.
    expect(capturedInsertPayload!.description).toBe(
      'Line one alert(1)\n\nLine two bold',
    )
  })

  it('returns 422 when the name collapses to empty after sanitisation', async () => {
    // A name made entirely of tag-shaped substrings sanitises to '' which
    // cannot satisfy the NOT NULL column. The route surfaces this as 422.
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { shelters: [{ data: { id: SHELTER_ID } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute(happyBody({ name: '<b></b>' }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.details.name).toBeDefined()
  })
})
