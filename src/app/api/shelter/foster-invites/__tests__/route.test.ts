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

  it('strips HTML tags from the message field before insert and email', async () => {
    // Capture the actual insert payload to assert the sanitized value made it
    // through to the row. Per `sanitizeMultiline` in src/lib/sanitize.ts, the
    // function strips tag-shaped substrings but keeps the text content — so
    // `<script>alert(1)</script>` becomes `alert(1)`.
    let capturedInsertPayload: { message?: string | null } | null = null
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelters: [{ data: { id: SHELTER_ID, name: 'Happy Tails' } }],
        foster_parents: [{ data: null }],
        shelter_foster_invites: [
          {
            data: {
              id: 'invite-3',
              email: 'safe@example.com',
              status: 'pending',
              foster_id: null,
              created_at: '2026-04-22T00:00:00Z',
            },
          },
        ],
      },
    })
    // Wrap the insert chain to capture its argument. The mock returns a
    // chainable object via `.from(table)`; we intercept `.insert` to record
    // the payload before delegating to the existing implementation.
    const originalFrom = client.from.bind(client)
    client.from = ((table: string) => {
      const chain = originalFrom(table)
      if (table === 'shelter_foster_invites') {
        const originalInsert = chain.insert.bind(chain)
        chain.insert = ((payload: { message?: string | null }) => {
          capturedInsertPayload = payload
          return originalInsert(payload)
        }) as typeof chain.insert
      }
      return chain
    }) as typeof client.from

    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute({
      email: 'safe@example.com',
      message: 'Hi <script>alert(1)</script> <b>there</b>',
    })

    expect(res.status).toBe(200)
    expect(capturedInsertPayload).not.toBeNull()
    expect(capturedInsertPayload!.message).toBe('Hi alert(1) there')

    // The email template must receive the same sanitized value — no raw input
    // can ever leak via that path either.
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const emailCall = vi.mocked(sendEmail).mock.calls[0][0]
    const reactEl = emailCall.react as { props: { message?: string | null } }
    expect(reactEl.props.message).toBe('Hi alert(1) there')
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
