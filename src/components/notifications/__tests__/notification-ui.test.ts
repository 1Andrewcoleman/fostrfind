import { describe, expect, it, vi } from 'vitest'
import type { Notification } from '@/types/database'
import {
  groupNotificationsByDate,
  truncateNotificationBody,
} from '@/components/notifications/notification-ui'

function notification(id: string, createdAt: string): Notification {
  return {
    id,
    created_at: createdAt,
    user_id: '11111111-1111-4111-8111-111111111111',
    type: 'new_message',
    title: `Notification ${id}`,
    body: null,
    link: null,
    read: false,
    read_at: null,
    metadata: null,
  }
}

describe('notification UI helpers', () => {
  it('truncates long bodies at 80 characters with an ellipsis', () => {
    const body = 'A'.repeat(81)
    expect(truncateNotificationBody(body)).toBe(`${'A'.repeat(80)}...`)
  })

  it('does not truncate short or missing bodies', () => {
    expect(truncateNotificationBody('Short update')).toBe('Short update')
    expect(truncateNotificationBody(null)).toBeNull()
  })

  it('groups notifications into Today, Yesterday, This Week, and Earlier', () => {
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'))
    try {
      const grouped = groupNotificationsByDate([
        notification('today', '2026-05-01T08:00:00Z'),
        notification('yesterday', '2026-04-30T08:00:00Z'),
        notification('week', '2026-04-28T08:00:00Z'),
        notification('earlier', '2026-04-20T08:00:00Z'),
      ])

      expect(grouped).toEqual([
        { label: 'Today', notifications: [expect.objectContaining({ id: 'today' })] },
        { label: 'Yesterday', notifications: [expect.objectContaining({ id: 'yesterday' })] },
        { label: 'This Week', notifications: [expect.objectContaining({ id: 'week' })] },
        { label: 'Earlier', notifications: [expect.objectContaining({ id: 'earlier' })] },
      ])
    } finally {
      vi.useRealTimers()
    }
  })
})
