import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
  getAppUrl: () => 'http://localhost:3000',
}))

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'
import { POST } from '@/app/api/shelter/foster-invites/route'

const SHELTER_USER_ID = 'user-shelter-1'
const SHELTER_ID = 'shelter-1'

function callRoute(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost/api/shelter/foster-invites', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
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

describe('POST /api/shelter/foster-invites', () => {
  it('returns 401 when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute({ email: 'foo@example.com' })).status).toBe(401)
  })

  it('returns 400 on invalid email', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: SHELTER_USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute({ email: 'not-an-email' })).status).toBe(400)
  })

  it('returns 403 when caller is not a shelter', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelters: [{ data: null, error: null }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute({ email: 'new@example.com' })
    expect(res.status).toBe(403)
  })

  it('creates a pending invite when the email is unknown (pre-signup)', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelters: [{ data: { id: SHELTER_ID, name: 'Happy Tails' } }],
        foster_parents: [{ data: null }],
        shelter_foster_invites: [
          {
            data: {
              id: 'invite-1',
              email: 'new@example.com',
              status: 'pending',
              foster_id: null,
              created_at: '2026-04-22T00:00:00Z',
            },
          },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute({ email: 'NEW@example.com', message: 'welcome!' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.invite.email).toBe('new@example.com')
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({
      to: 'new@example.com',
      subject: expect.stringContaining('Happy Tails'),
    })
  })

  it('pre-links foster_id when the email belongs to an existing foster', async () => {
    const { client, fromSpy } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelters: [{ data: { id: SHELTER_ID, name: 'Happy Tails' } }],
        foster_parents: [{ data: { id: 'foster-existing' } }],
        shelter_fosters: [{ data: null }],
        shelter_foster_invites: [
          {
            data: {
              id: 'invite-2',
              email: 'existing@example.com',
              status: 'pending',
              foster_id: 'foster-existing',
              created_at: '2026-04-22T00:00:00Z',
            },
          },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute({ email: 'existing@example.com' })
    expect(res.status).toBe(200)
    const tables = fromSpy.mock.calls.map((c) => c[0])
    expect(tables).toContain('foster_parents')
    expect(tables).toContain('shelter_fosters')
    expect(tables).toContain('shelter_foster_invites')
  })

  it('is a 200 no-op when the foster is already on the roster', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelters: [{ data: { id: SHELTER_ID, name: 'Happy Tails' } }],
        foster_parents: [{ data: { id: 'foster-existing' } }],
        shelter_fosters: [{ data: { shelter_id: SHELTER_ID } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute({ email: 'existing@example.com' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alreadyInRoster).toBe(true)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('returns 409 when a pending invite already exists (unique violation)', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelters: [{ data: { id: SHELTER_ID, name: 'Happy Tails' } }],
        foster_parents: [{ data: null }],
        shelter_foster_invites: [
          {
            data: null,
            error: { message: 'duplicate key value', code: '23505' },
          },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute({ email: 'new@example.com' })
    expect(res.status).toBe(409)
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
    const res = await callRoute({ email: 'new@example.com' })
    expect(res.status).toBe(429)
  })
})
