import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMock = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => serviceMock)

import { createNotification } from '@/lib/notifications'

describe('createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts a notification through the service-role client', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const from = vi.fn(() => ({ insert }))
    serviceMock.createServiceClient.mockReturnValue({ from })

    await createNotification({
      userId: '11111111-1111-4111-8111-111111111111',
      type: 'new_message',
      title: 'New message from Happy Paws',
      body: 'Can you meet Buddy tomorrow?',
      link: '/foster/messages/22222222-2222-4222-8222-222222222222',
      metadata: { applicationId: '22222222-2222-4222-8222-222222222222' },
    })

    expect(from).toHaveBeenCalledWith('notifications')
    expect(insert).toHaveBeenCalledWith({
      user_id: '11111111-1111-4111-8111-111111111111',
      type: 'new_message',
      title: 'New message from Happy Paws',
      body: 'Can you meet Buddy tomorrow?',
      link: '/foster/messages/22222222-2222-4222-8222-222222222222',
      metadata: { applicationId: '22222222-2222-4222-8222-222222222222' },
    })
  })

  it('logs insert failures without throwing', async () => {
    const insert = vi.fn(async () => ({ error: { message: 'insert failed' } }))
    const from = vi.fn(() => ({ insert }))
    serviceMock.createServiceClient.mockReturnValue({ from })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(
        createNotification({
          userId: '11111111-1111-4111-8111-111111111111',
          type: 'application_submitted',
          title: 'New application from Jane Foster for Buddy',
        }),
      ).resolves.toBeUndefined()
      expect(errorSpy).toHaveBeenCalledWith(
        '[notifications] createNotification failed:',
        expect.objectContaining({
          type: 'application_submitted',
          userId: '11111111-1111-4111-8111-111111111111',
          error: 'insert failed',
        }),
      )
    } finally {
      errorSpy.mockRestore()
    }
  })
})
