import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from '@/app/api/shelter/foster-invites/[id]/decline/route'

const FOSTER_USER_ID = 'user-foster-1'
const FOSTER_ID = 'foster-1'
const SHELTER_ID = 'shelter-1'
const INVITE_ID = 'invite-123'

function callRoute(): Promise<Response> {
  return POST(
    new Request(`http://localhost/api/shelter/foster-invites/${INVITE_ID}/decline`, {
      method: 'POST',
    }),
    { params: { id: INVITE_ID } },
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

describe('POST /api/shelter/foster-invites/[id]/decline', () => {
  it('returns 401 when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(401)
  })

  it('returns 403 when caller is not a foster', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: { foster_parents: [{ data: null }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(403)
  })

  it('returns 404 when invite is not visible', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID, email: 'jane@example.com' } }],
        shelter_foster_invites: [{ data: null }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(404)
  })

  it('returns 409 when invite is not pending', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID, email: 'jane@example.com' } }],
        shelter_foster_invites: [
          {
            data: {
              id: INVITE_ID,
              shelter_id: SHELTER_ID,
              email: 'jane@example.com',
              foster_id: FOSTER_ID,
              status: 'declined',
            },
          },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(409)
  })

  it('returns 200 and transitions to declined on the happy path', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID, email: 'jane@example.com' } }],
        shelter_foster_invites: [
          {
            data: {
              id: INVITE_ID,
              shelter_id: SHELTER_ID,
              email: 'jane@example.com',
              foster_id: FOSTER_ID,
              status: 'pending',
            },
          },
          { data: null, error: null },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(200)
  })
})
