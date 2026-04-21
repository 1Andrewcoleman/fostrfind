import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from '@/app/api/shelter/foster-invites/[id]/accept/route'

const FOSTER_USER_ID = 'user-foster-1'
const FOSTER_ID = 'foster-1'
const SHELTER_ID = 'shelter-1'
const INVITE_ID = 'invite-123'

function callRoute(): Promise<Response> {
  return POST(
    new Request(`http://localhost/api/shelter/foster-invites/${INVITE_ID}/accept`, {
      method: 'POST',
    }),
    { params: { id: INVITE_ID } },
  )
}

function buildMockServiceClient(opts: { shouldFail?: boolean; shouldThrow?: boolean } = {}) {
  const upsertSpy = vi.fn(() =>
    Promise.resolve({
      data: null,
      error: opts.shouldFail ? { message: 'permission denied' } : null,
    }),
  )
  const fromSpy = vi.fn(() => ({ upsert: upsertSpy }))
  const svc = { from: fromSpy }
  vi.mocked(createServiceClient).mockImplementation(() => {
    if (opts.shouldThrow) throw new Error('service client unavailable')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return svc as any
  })
  return { upsertSpy, fromSpy }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(rateLimit).mockReturnValue({
    success: true,
    remaining: 29,
    resetAt: Date.now() + 60_000,
    retryAfter: 0,
  })
  buildMockServiceClient()
})

describe('POST /api/shelter/foster-invites/[id]/accept', () => {
  it('returns 401 when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(401)
  })

  it('returns 403 when the caller is not a foster', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: null }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(403)
  })

  it('returns 404 when the invite is not visible (RLS denied / missing)', async () => {
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

  it('returns 409 when the invite is no longer pending', async () => {
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
              status: 'accepted',
            },
          },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(409)
  })

  it('returns 403 when the invite row does not match the caller by id or email', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID, email: 'jane@example.com' } }],
        shelter_foster_invites: [
          {
            data: {
              id: INVITE_ID,
              shelter_id: SHELTER_ID,
              email: 'someone-else@example.com',
              foster_id: 'foster-other',
              status: 'pending',
            },
          },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(403)
  })

  it('accepts via foster_id match and inserts the roster row (happy path)', async () => {
    const { upsertSpy } = buildMockServiceClient()
    const { client, fromSpy } = buildMockClient({
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
          // update
          { data: null, error: null },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const res = await callRoute()
    expect(res.status).toBe(200)
    expect(upsertSpy).toHaveBeenCalledWith(
      { shelter_id: SHELTER_ID, foster_id: FOSTER_ID, source: 'invite_accepted' },
      { onConflict: 'shelter_id,foster_id', ignoreDuplicates: true },
    )
    expect(fromSpy).toHaveBeenCalledWith('shelter_foster_invites')
  })

  it('accepts via email match when foster_id is null (pre-signup invite)', async () => {
    const { upsertSpy } = buildMockServiceClient()
    const { client } = buildMockClient({
      auth: buildAuth({ id: FOSTER_USER_ID }),
      tableResults: {
        foster_parents: [{ data: { id: FOSTER_ID, email: 'JANE@example.com' } }],
        shelter_foster_invites: [
          {
            data: {
              id: INVITE_ID,
              shelter_id: SHELTER_ID,
              email: 'jane@example.com',
              foster_id: null,
              status: 'pending',
            },
          },
          { data: null, error: null },
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    expect((await callRoute()).status).toBe(200)
    expect(upsertSpy).toHaveBeenCalled()
  })

  it('still returns 200 if roster upsert soft-fails (idempotent side effect)', async () => {
    buildMockServiceClient({ shouldFail: true })
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
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect((await callRoute()).status).toBe(200)
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('roster upsert failed'),
        expect.any(String),
      )
    } finally {
      errSpy.mockRestore()
    }
  })
})
