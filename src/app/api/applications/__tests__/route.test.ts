import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})
// Stub the side-effect helpers so tests stay deterministic and so we
// can assert on email/notification payloads. The route fires both as
// fire-and-forget; mocking lets us inspect the call args without
// hitting Resend or the service-role client.
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
  getAppUrl: () => 'http://localhost:3000',
}))
vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'
import { createNotification } from '@/lib/notifications'
import { POST } from '@/app/api/applications/route'

const SHELTER_USER_ID = '44444444-4444-4444-8444-444444444444'
const SHELTER_EMAIL = 'shelter@example.com'
const SHELTER_NAME = 'Test Shelter'
const DOG_NAME = 'Buddy'
const FOSTER_FIRST = 'Pat'
const FOSTER_LAST = 'Doe'

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
  vi.mocked(rateLimit).mockResolvedValue({
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
        foster_parents: [
          { data: { id: FOSTER_ID, first_name: FOSTER_FIRST, last_name: FOSTER_LAST } },
        ],
        dogs: [
          {
            data: {
              id: DOG_ID,
              shelter_id: SHELTER_ID,
              status: 'available',
              name: DOG_NAME,
              shelter: { user_id: SHELTER_USER_ID, email: SHELTER_EMAIL, name: SHELTER_NAME },
            },
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

  it('fires the application-submitted email and notification on success', async () => {
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
        foster_parents: [
          { data: { id: FOSTER_ID, first_name: FOSTER_FIRST, last_name: FOSTER_LAST } },
        ],
        dogs: [
          {
            data: {
              id: DOG_ID,
              shelter_id: SHELTER_ID,
              status: 'available',
              name: DOG_NAME,
              shelter: { user_id: SHELTER_USER_ID, email: SHELTER_EMAIL, name: SHELTER_NAME },
            },
          },
        ],
        applications: [
          { data: null },
          { single: { data: inserted, error: null } },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(201)

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({
      to: SHELTER_EMAIL,
      subject: expect.stringContaining(DOG_NAME),
    })

    expect(createNotification).toHaveBeenCalledTimes(1)
    expect(vi.mocked(createNotification).mock.calls[0][0]).toMatchObject({
      userId: SHELTER_USER_ID,
      type: 'application_submitted',
      link: `/shelter/applications/${inserted.id}`,
    })
  })

  it('does NOT send email when shelter email is missing, but still fires notification', async () => {
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
        foster_parents: [
          { data: { id: FOSTER_ID, first_name: FOSTER_FIRST, last_name: FOSTER_LAST } },
        ],
        dogs: [
          {
            data: {
              id: DOG_ID,
              shelter_id: SHELTER_ID,
              status: 'available',
              name: DOG_NAME,
              // Email missing — shelter row exists (so the notification
              // still fires) but has no contact address. Email path skips.
              shelter: { user_id: SHELTER_USER_ID, email: null, name: SHELTER_NAME },
            },
          },
        ],
        applications: [
          { data: null },
          { single: { data: inserted, error: null } },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute()
    expect(res.status).toBe(201)
    expect(sendEmail).not.toHaveBeenCalled()
    expect(createNotification).toHaveBeenCalledTimes(1)
  })
})
