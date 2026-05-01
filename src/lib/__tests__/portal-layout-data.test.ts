import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuth, buildMockClient } from '@/lib/__tests__/supabase-mock'

vi.mock('@/lib/constants', () => ({ DEV_MODE: false }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { getPortalLayoutData } from '@/lib/portal-layout-data'

const USER_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getPortalLayoutData', () => {
  it('includes unread notification count with the existing layout data', async () => {
    const { client } = buildMockClient({
      auth: buildAuth({ id: USER_ID }),
      tableResults: {
        shelters: [
          { data: { id: 'shelter-1' } },
          { single: { data: { name: 'Happy Paws Rescue', logo_url: null }, error: null } },
        ],
        applications: [{ data: [{ id: 'app-1' }] }],
        messages: [{ count: 2 }],
        notifications: [{ count: 5 }],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client)

    await expect(getPortalLayoutData('shelter')).resolves.toEqual({
      unreadMessages: 2,
      pendingInvites: 0,
      unreadNotifications: 5,
      identity: {
        displayName: 'Happy Paws Rescue',
        avatarUrl: null,
        roleLabel: 'Shelter',
      },
    })
  })
})
