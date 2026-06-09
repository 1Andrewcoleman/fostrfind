import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, rateLimit: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireApiUser } from '@/lib/api-auth'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const LIMIT = { key: 'test:route', limit: 5, windowMs: 60_000 }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(rateLimit).mockReturnValue({
    success: true,
    remaining: 4,
    resetAt: Date.now() + 60_000,
    retryAfter: 0,
  })
})

describe('requireApiUser', () => {
  it('returns 503 with the standard body when the auth service errors, and logs with the tag', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null, { message: 'down' }) })
    vi.mocked(createClient).mockResolvedValue(client)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const result = await requireApiUser('my-route/tag', LIMIT)
      expect(result.response).toBeDefined()
      expect(result.response!.status).toBe(503)
      expect(await result.response!.json()).toEqual({
        error: 'Authentication service unavailable',
      })
      expect(errSpy).toHaveBeenCalledWith('[my-route/tag] getUser failed:', 'down')
    } finally {
      errSpy.mockRestore()
    }
  })

  it('returns 401 with the standard body when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)

    const result = await requireApiUser('my-route/tag', LIMIT)
    expect(result.response!.status).toBe(401)
    expect(await result.response!.json()).toEqual({ error: 'Unauthorized' })
  })

  it('does not consume a rate-limit token for unauthenticated requests', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)

    await requireApiUser('my-route/tag', LIMIT)
    expect(rateLimit).not.toHaveBeenCalled()
  })

  it('returns 429 via rateLimitResponse when the bucket is exhausted', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)
    vi.mocked(rateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfter: 30,
    })

    const result = await requireApiUser('my-route/tag', LIMIT)
    expect(result.response!.status).toBe(429)
    expect(result.response!.headers.get('Retry-After')).toBe('30')
  })

  it('keys the rate limit on the route key and the authenticated user id', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)

    await requireApiUser('my-route/tag', LIMIT)
    expect(rateLimit).toHaveBeenCalledWith('test:route', USER_ID, {
      limit: 5,
      windowMs: 60_000,
    })
  })

  it('returns the supabase client and user on success', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)

    const result = await requireApiUser('my-route/tag', LIMIT)
    expect(result.response).toBeUndefined()
    expect(result.user!.id).toBe(USER_ID)
    expect(result.supabase).toBe(client)
  })

  it('skips rate limiting entirely when no limit is provided', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)

    const result = await requireApiUser('my-route/tag')
    expect(result.user!.id).toBe(USER_ID)
    expect(rateLimit).not.toHaveBeenCalled()
  })
})
