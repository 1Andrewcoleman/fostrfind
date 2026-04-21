import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { DELETE } from '@/app/api/foster/shelter-roster/[shelterId]/route'

const FOSTER_USER_ID = 'user-foster-1'
const FOSTER_ID = 'foster-1'
const SHELTER_ID = 'shelter-1'

function callRoute(): Promise<Response> {
  return DELETE(
    new Request(`http://localhost/api/foster/shelter-roster/${SHELTER_ID}`, {
      method: 'DELETE',
    }),
    { params: { shelterId: SHELTER_ID } },
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

describe('DELETE /api/foster/shelter-roster/[shelterId]', () => {
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

  it('returns 404 when the pair does not exist / is not owned by caller', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID } }],
        shelter_fosters: [{ data: null }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(404)
  })

  it('returns 200 and deletes the row on the happy path', async () => {
    const { client, fromSpy } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID } }],
        shelter_fosters: [
          { data: { shelter_id: SHELTER_ID } },
          { data: null, error: null },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute()
    expect(res.status).toBe(200)
    // Two shelter_fosters accesses: precheck + delete.
    expect(fromSpy.mock.calls.filter((c) => c[0] === 'shelter_fosters').length).toBe(2)
  })

  it('returns 500 when delete errors', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID } }],
        shelter_fosters: [
          { data: { shelter_id: SHELTER_ID } },
          { data: null, error: { message: 'boom' } },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(500)
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
    expect((await callRoute()).status).toBe(429)
  })
})
