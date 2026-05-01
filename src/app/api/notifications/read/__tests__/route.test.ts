import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { PATCH } from '@/app/api/notifications/read/route'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const NOTIFICATION_ID = '22222222-2222-4222-8222-222222222222'

function callRoute(body: unknown): Promise<Response> {
  return PATCH(
    new Request('http://localhost/api/notifications/read', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/notifications/read', () => {
  it('returns 503 when auth service errors', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null, { message: 'down' }) })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute({ all: true })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'Authentication service unavailable' })
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = buildMockClient({ auth: buildAuth(null) })
    vi.mocked(createClient).mockResolvedValue(client)

    expect((await callRoute({ all: true })).status).toBe(401)
  })

  it('returns 400 when the body is not valid JSON', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)

    expect((await callRoute('{not json')).status).toBe(400)
  })

  it('returns 422 when neither ids nor all is provided', async () => {
    const { client } = buildMockClient({ auth: buildAuth({ id: USER_ID }) })
    vi.mocked(createClient).mockResolvedValue(client)

    expect((await callRoute({ ids: [] })).status).toBe(422)
  })

  it('marks all unread notifications as read', async () => {
    const { client, fromSpy } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: { notifications: [{ error: null }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute({ all: true })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(fromSpy).toHaveBeenCalledWith('notifications')
  })

  it('marks selected notifications as read', async () => {
    const { client, fromSpy } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: { notifications: [{ error: null }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    const res = await callRoute({ ids: [NOTIFICATION_ID] })

    expect(res.status).toBe(200)
    expect(fromSpy).toHaveBeenCalledWith('notifications')
  })

  it('returns 500 when the update fails', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: { notifications: [{ error: { message: 'update failed' } }] },
    })
    vi.mocked(createClient).mockResolvedValue(client)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      expect((await callRoute({ all: true })).status).toBe(500)
    } finally {
      errorSpy.mockRestore()
    }
  })
})
