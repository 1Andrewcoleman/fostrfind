'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import type { Notification } from '@/types/database'
import {
  groupNotificationsByDate,
  NotificationRow,
} from '@/components/notifications/notification-ui'

type Portal = 'foster' | 'shelter'

interface NotificationsListProps {
  notifications: Notification[]
  portal: Portal
}

async function markNotificationsRead(body: { ids: string[] } | { all: true }): Promise<boolean> {
  const res = await fetch('/api/notifications/read', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.ok
}

export function NotificationsList({ notifications, portal }: NotificationsListProps) {
  const router = useRouter()
  const [items, setItems] = useState(notifications)
  const unreadCount = items.filter((notification) => !notification.read).length
  const groups = useMemo(() => groupNotificationsByDate(items), [items])

  async function handleSelect(notification: Notification) {
    if (!notification.read) {
      const previous = items
      setItems((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
      )
      const ok = await markNotificationsRead({ ids: [notification.id] })
      if (!ok) {
        setItems(previous)
        toast.error('Could not mark notification as read.')
      } else {
        // Re-fetch the layout so the Notifications nav badge reflects the
        // newly-read row without forcing a hard reload. Optimistic state
        // already updated the local list above.
        router.refresh()
      }
    }

    if (notification.link) {
      router.push(notification.link)
    }
  }

  async function handleMarkAllRead() {
    const previous = items
    setItems((prev) => prev.map((notification) => ({ ...notification, read: true })))
    const ok = await markNotificationsRead({ all: true })
    if (!ok) {
      setItems(previous)
      toast.error('Could not mark notifications as read.')
      return
    }
    router.refresh()
  }

  if (items.length === 0) {
    return (
      <EmptyState
        illustration="notifications"
        title="You're all caught up"
        description={
          portal === 'foster'
            ? 'Application updates, messages, and shelter invites will appear here.'
            : 'Applications, messages, and foster roster updates will appear here.'
        }
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {unreadCount > 0 ? `${unreadCount} unread` : 'No unread notifications'}
        </p>
        {unreadCount > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={handleMarkAllRead}>
            Mark all as read
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.label} aria-labelledby={`notifications-${group.label}`}>
            <h2
              id={`notifications-${group.label}`}
              className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {group.label}
            </h2>
            <div className="space-y-1 rounded-xl border bg-card p-2">
              {group.notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
