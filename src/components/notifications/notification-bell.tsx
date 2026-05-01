'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types/database'
import { NotificationRow } from '@/components/notifications/notification-ui'

type Portal = 'foster' | 'shelter'

interface NotificationBellProps {
  initialCount: number
  portal: Portal
  className?: string
}

function badgeLabel(count: number): string {
  return count > 9 ? '9+' : String(count)
}

export function NotificationBell({ initialCount, portal, className }: NotificationBellProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadNotifications() {
    if (loading || notifications.length > 0) return
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8)

    if (fetchError) {
      console.error('[notification-bell] load failed:', fetchError.message)
      setError('Notifications could not be loaded.')
      setLoading(false)
      return
    }

    setNotifications(((data ?? []) as unknown as Notification[]))
    setLoading(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      void loadNotifications()
    }
  }

  async function markRead(ids: string[]): Promise<boolean> {
    const res = await fetch('/api/notifications/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    return res.ok
  }

  async function handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      const previous = notifications
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      )
      setCount((current) => Math.max(0, current - 1))

      const ok = await markRead([notification.id])
      if (!ok) {
        setNotifications(previous)
        setCount((current) => current + 1)
        toast.error('Could not mark notification as read.')
      }
    }

    setOpen(false)
    if (notification.link) {
      router.push(notification.link)
    }
  }

  async function handleMarkAllRead() {
    const previous = notifications
    const unreadCount = notifications.filter((n) => !n.read).length
    setCount(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))

    const res = await fetch('/api/notifications/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })

    if (!res.ok) {
      setNotifications(previous)
      setCount(unreadCount)
      toast.error('Could not mark notifications as read.')
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('relative h-9 w-9 text-muted-foreground hover:text-foreground', className)}
          aria-label={count > 0 ? `${count} unread notifications` : 'Notifications'}
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {badgeLabel(count)}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={8} className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {count > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-2 p-2" aria-label="Loading notifications">
              {Array.from({ length: 3 }).map((_, idx) => (
                <Skeleton key={idx} className="h-14 w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{error}</p>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            <div className="space-y-1">
              {notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  compact
                  onSelect={handleNotificationClick}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3">
          <Link
            href={`/${portal}/notifications`}
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            See all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
