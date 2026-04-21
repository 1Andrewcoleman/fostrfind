import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from '@/app/api/shelter/foster-invites/[id]/cancel/route'

const SHELTER_USER_ID = 'user-shelter-1'
const INVITE_ID = 'invite-123'

function callRoute(): Promise<Response> {
  return POST(
    new Request(`http://localhost/api/shelter/foster-invites/${INVITE_ID}/cancel`, {
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

describe('POST /api/shelter/foster-invites/[id]/cancel', () => {
  it('returns 401 when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(401)
  })

  it('returns 404 when the invite is not visible (other shelter / missing)', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelter_foster_invites: [{ data: null }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(404)
  })

  it('returns 409 when invite already cancelled/accepted/declined', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelter_foster_invites: [
          { data: { id: INVITE_ID, status: 'cancelled' } },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(409)
  })

  it('returns 200 on happy path', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelter_foster_invites: [
          { data: { id: INVITE_ID, status: 'pending' } },
          { data: null, error: null },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(200)
  })
})
