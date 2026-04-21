import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from '@/app/api/shelter/foster-notes/route'

const SHELTER_USER_ID = 'user-shelter-1'
const SHELTER_ID = 'shelter-1'
const FOSTER_ID = '123e4567-e89b-42d3-a456-426614174000'

function callRoute(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost/api/shelter/foster-notes', {
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
    remaining: 59,
    resetAt: Date.now() + 60_000,
    retryAfter: 0,
  })
})

describe('POST /api/shelter/foster-notes', () => {
  it('returns 401 when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute({ fosterId: FOSTER_ID, body: 'hi' })).status).toBe(401)
  })

  it('returns 400 on empty note', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: SHELTER_USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute({ fosterId: FOSTER_ID, body: '   ' })).status).toBe(400)
  })

  it('returns 400 on missing fosterId', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: SHELTER_USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute({ body: 'hello' })).status).toBe(400)
  })

  it('returns 403 when caller is not a shelter', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: { shelters: [{ data: null }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute({ fosterId: FOSTER_ID, body: 'hi' })).status).toBe(403)
  })

  it('returns 403 when foster is not on roster', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelters: [{ data: { id: SHELTER_ID } }],
        shelter_fosters: [{ data: null }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute({ fosterId: FOSTER_ID, body: 'hi' })).status).toBe(403)
  })

  it('returns 200 on happy path', async () => {
    const { client, fromSpy } = buildMockClient({
      auth: buildAuth({ id: SHELTER_USER_ID }),
      tableResults: {
        shelters: [{ data: { id: SHELTER_ID } }],
        shelter_fosters: [{ data: { shelter_id: SHELTER_ID } }],
        shelter_foster_notes: [
          {
            data: {
              id: 'note-1',
              created_at: '2026-04-22T00:00:00Z',
              body: 'solid foster',
              author_user: SHELTER_USER_ID,
            },
          },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute({ fosterId: FOSTER_ID, body: 'solid foster' })
    expect(res.status).toBe(200)
    expect(fromSpy).toHaveBeenCalledWith('shelter_foster_notes')
  })
})
