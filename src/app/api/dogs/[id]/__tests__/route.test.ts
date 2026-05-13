import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { DELETE, PATCH } from '@/app/api/dogs/[id]/route'

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
    params: Promise.resolve({ id: DOG_ID }),
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

// ---------- PATCH /api/dogs/[id] ----------

function callPatch(body: unknown): Promise<Response> {
  return PATCH(
    new Request('http://localhost/api/dogs/dog-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: DOG_ID }) },
  )
}

describe('PATCH /api/dogs/[id]', () => {
  it('returns 503 on auth error', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null, { message: 'down' }) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callPatch({ name: 'Buddy' })).status).toBe(503)
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callPatch({ name: 'Buddy' })).status).toBe(401)
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
    expect((await callPatch({ name: 'Buddy' })).status).toBe(429)
  })

  it('returns 404 when the dog is not found', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { dogs: [{ data: null, error: null }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callPatch({ name: 'Buddy' })
    expect(res.status).toBe(404)
  })

  it('returns 403 when the caller does not own the dog', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: 'other-user' }),
      tableResults: { dogs: [{ data: happyDog() }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callPatch({ name: 'Buddy' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when the body is not valid JSON', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { dogs: [{ data: happyDog() }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await PATCH(
      new Request('http://localhost/api/dogs/dog-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      }),
      { params: Promise.resolve({ id: DOG_ID }) },
    )
    expect(res.status).toBe(400)
  })

  it('returns 422 when a submitted field is invalid', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { dogs: [{ data: happyDog() }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    // `age` must be one of the DOG_AGES enum values; "ancient" is invalid.
    const res = await callPatch({ age: 'ancient' })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.details.age).toBeDefined()
  })

  it('returns 422 when the submitted name collapses to empty after sanitisation', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { dogs: [{ data: happyDog() }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callPatch({ name: '<b></b>' })
    expect(res.status).toBe(422)
  })

  it('returns 200 with the updated row on the happy path', async () => {
    const updated = {
      id: DOG_ID,
      shelter_id: 'shelter-1',
      name: 'Buddy II',
      description: 'New description',
    }
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        dogs: [
          { data: happyDog() },
          { single: { data: updated, error: null } },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callPatch({ name: 'Buddy II', description: 'New description' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: DOG_ID, name: 'Buddy II' })
  })

  it('strips HTML tags from text fields before update', async () => {
    // Capture the update payload to assert the sanitised value made it
    // through. Same wrap-the-mock pattern as the POST sanitisation test
    // (and PR #15's foster-invites test).
    type UpdatePayload = {
      name?: string
      description?: string | null
      temperament?: string | null
    }
    let capturedUpdatePayload: UpdatePayload | null = null
    const updated = {
      id: DOG_ID,
      shelter_id: 'shelter-1',
      name: 'Buddy',
    }
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        dogs: [
          { data: happyDog() },
          { single: { data: updated, error: null } },
        ],
      },
    })
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'dogs') {
        const originalUpdate = chain.update.bind(chain)
        chain.update = ((payload: UpdatePayload) => {
          // The ownership-check select doesn't invoke .update — only the
          // mutation chain does — so this captures exactly one payload.
          capturedUpdatePayload = payload
          return originalUpdate(payload)
        }) as typeof chain.update
      }
      return chain
    }) as typeof client.from
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callPatch({
      name: '<b>Buddy</b>',
      temperament: '<i>Calm</i> and gentle',
      description: 'Line one <script>alert(1)</script>\n\nLine two',
    })

    expect(res.status).toBe(200)
    expect(capturedUpdatePayload).not.toBeNull()
    expect(capturedUpdatePayload!.name).toBe('Buddy')
    expect(capturedUpdatePayload!.temperament).toBe('Calm and gentle')
    expect(capturedUpdatePayload!.description).toBe('Line one alert(1)\n\nLine two')
  })

  it('does NOT include fields that were not submitted in the update payload', async () => {
    // Partial updates must leave omitted columns untouched. The handler
    // builds `updatePayload` from `'key' in data` checks; assert only the
    // submitted keys are present.
    type AnyPayload = Record<string, unknown>
    let capturedUpdatePayload: AnyPayload | null = null
    const updated = { id: DOG_ID, shelter_id: 'shelter-1', name: 'Buddy' }
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        dogs: [
          { data: happyDog() },
          { single: { data: updated, error: null } },
        ],
      },
    })
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'dogs') {
        const originalUpdate = chain.update.bind(chain)
        chain.update = ((payload: AnyPayload) => {
          capturedUpdatePayload = payload
          return originalUpdate(payload)
        }) as typeof chain.update
      }
      return chain
    }) as typeof client.from
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callPatch({ name: 'Buddy II' })
    expect(res.status).toBe(200)
    expect(capturedUpdatePayload).not.toBeNull()
    // Only `name` should be present — every other column is untouched.
    const payload = capturedUpdatePayload as AnyPayload | null
    expect(payload).not.toBeNull()
    expect(Object.keys(payload as AnyPayload)).toEqual(['name'])
    expect((payload as AnyPayload).name).toBe('Buddy II')
  })

  it('returns 500 when the update itself fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        dogs: [
          { data: happyDog() },
          { single: { data: null, error: { message: 'update boom' } } },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await callPatch({ name: 'Buddy II' })
      expect(res.status).toBe(500)
    } finally {
      errSpy.mockRestore()
    }
  })
})
