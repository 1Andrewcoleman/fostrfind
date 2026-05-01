import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { POST, DELETE } from '@/app/api/dogs/[id]/save/route'

const FOSTER_USER_ID = 'user-foster-1'
const FOSTER_ID = 'foster-1'
const DOG_ID = 'dog-1'

function call(method: 'POST' | 'DELETE'): Promise<Response> {
  const handler = method === 'POST' ? POST : DELETE
  return handler(new Request(`http://localhost/api/dogs/${DOG_ID}/save`, { method }), {
    params: { id: DOG_ID },
  })
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

describe('POST /api/dogs/[id]/save', () => {
  it('returns 503 on auth service error', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null, { message: 'down' }) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await call('POST')).status).toBe(503)
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await call('POST')).status).toBe(401)
  })

  it('returns 403 when caller has no foster profile', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: { foster_parents: [{ data: null }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await call('POST')).status).toBe(403)
  })

  it('returns 429 when rate limited', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: { foster_parents: [{ data: { id: FOSTER_ID } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    vi.mocked(rateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfter: 30,
    })
    expect((await call('POST')).status).toBe(429)
  })

  it('returns 500 when the upsert fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID } }],
        dogs: [{ data: null, error: null }],
        dog_saves: [{ data: null, error: { message: 'boom' } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await call('POST')).status).toBe(500)
  })

  it('returns 200 on the happy path', async () => {
    const { client, fromSpy } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID } }],
        dogs: [{ data: null, error: null }],
        dog_saves: [{ data: null, error: null }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await call('POST')
    expect(res.status).toBe(200)
    expect(fromSpy).toHaveBeenCalledWith('dog_saves')
  })
})

describe('DELETE /api/dogs/[id]/save', () => {
  it('returns 401 when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await call('DELETE')).status).toBe(401)
  })

  it('returns 200 even if no row existed (idempotent)', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID } }],
        dog_saves: [{ data: null, error: null }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await call('DELETE')).status).toBe(200)
  })

  it('returns 500 when the delete fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID } }],
        dog_saves: [{ data: null, error: { message: 'boom' } }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await call('DELETE')).status).toBe(500)
  })
})
