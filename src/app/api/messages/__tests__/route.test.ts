import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn(() => Promise.resolve()) }))

import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from '@/app/api/messages/route'

const APP_ID = '22222222-2222-4222-8222-222222222222'
const MESSAGE_ID = '33333333-3333-4333-8333-333333333333'
const FOSTER_USER_ID = '44444444-4444-4444-8444-444444444444'
const SHELTER_USER_ID = '55555555-5555-4555-8555-555555555555'

function applicationRow() {
  return {
    id: APP_ID,
    foster: {
      id: 'foster-1',
      user_id: FOSTER_USER_ID,
      first_name: 'Jane',
      last_name: 'Foster',
    },
    shelter: {
      id: 'shelter-1',
      user_id: SHELTER_USER_ID,
      name: 'Happy Paws Rescue',
    },
  }
}

function callRoute(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

const validBody = {
  applicationId: APP_ID,
  body: 'Can we schedule a pickup tomorrow?',
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

describe('POST /api/messages', () => {
  it('returns 503 when auth service errors', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null, { message: 'down' }) })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute(validBody)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'Authentication service unavailable' })
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

    const res = await callRoute(validBody)
    expect(res.status).toBe(429)
    expect(rateLimit).toHaveBeenCalledWith('messages:create', FOSTER_USER_ID, {
      limit: 30,
      windowMs: 60_000,
    })
  })

  it('returns 400 when the body is not valid JSON', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: FOSTER_USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)

    expect((await callRoute('{not json')).status).toBe(400)
  })

  it('returns 422 when validation fails', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: FOSTER_USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)

    expect((await callRoute({ applicationId: 'bad', body: '' })).status).toBe(422)
  })

  it('returns 404 when the application is not found', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: { applications: [{ single: { data: null, error: { message: 'no rows' } } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    expect((await callRoute(validBody)).status).toBe(404)
  })

  it('returns 403 when the caller is not on the application', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: '66666666-6666-4666-8666-666666666666' }),
      tableResults: { applications: [{ single: { data: applicationRow(), error: null } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    expect((await callRoute(validBody)).status).toBe(403)
  })

  it('returns 500 when message insert fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        applications: [{ single: { data: applicationRow(), error: null } }],
        messages: [{ single: { data: null, error: { message: 'insert failed' } } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      expect((await callRoute(validBody)).status).toBe(500)
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('sends a foster message and notifies the shelter', async () => {
    const inserted = {
      id: MESSAGE_ID,
      application_id: APP_ID,
      sender_id: FOSTER_USER_ID,
      sender_role: 'foster',
      body: 'Can we schedule a pickup tomorrow?',
      read: false,
      created_at: '2026-05-01T00:00:00Z',
    }
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        applications: [{ single: { data: applicationRow(), error: null } }],
        messages: [{ single: { data: inserted, error: null } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute(validBody)

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ id: MESSAGE_ID, sender_role: 'foster' })
    expect(createNotification).toHaveBeenCalledWith({
      userId: SHELTER_USER_ID,
      type: 'new_message',
      title: 'New message from Jane Foster',
      body: 'Can we schedule a pickup tomorrow?',
      link: `/shelter/messages/${APP_ID}`,
      metadata: { applicationId: APP_ID, messageId: MESSAGE_ID },
    })
  })

  it('sends a shelter message and notifies the foster', async () => {
    const inserted = {
      id: MESSAGE_ID,
      application_id: APP_ID,
      sender_id: SHELTER_USER_ID,
      sender_role: 'shelter',
      body: 'Tomorrow works for us.',
      read: false,
      created_at: '2026-05-01T00:00:00Z',
    }
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        applications: [{ single: { data: applicationRow(), error: null } }],
        messages: [{ single: { data: inserted, error: null } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute({ applicationId: APP_ID, body: 'Tomorrow works for us.' })

    expect(res.status).toBe(201)
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: FOSTER_USER_ID,
        title: 'New message from Happy Paws Rescue',
        link: `/foster/messages/${APP_ID}`,
      }),
    )
  })
})
