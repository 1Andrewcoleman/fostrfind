'use client'

import {
  Award,
  Bell,
  CheckCircle2,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  Undo2,
  UserCheck,
  UserMinus,
  Users,
  UserX,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { RelativeTime } from '@/components/relative-time'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types/database'
import type { NotificationType } from '@/lib/notifications'

export interface NotificationGroup {
  label: 'Today' | 'Yesterday' | 'This Week' | 'Earlier'
  notifications: Notification[]
}

interface NotificationVisual {
  icon: LucideIcon
  className: string
}

export const NOTIFICATION_VISUALS: Record<NotificationType, NotificationVisual> = {
  application_submitted: { icon: FileText, className: 'text-accent-peach-foreground' },
  application_reviewing: { icon: Eye, className: 'text-accent-peach-foreground' },
  application_accepted: { icon: CheckCircle2, className: 'text-warm-foreground' },
  application_declined: { icon: XCircle, className: 'text-destructive' },
  application_completed: { icon: Award, className: 'text-warm-foreground' },
  application_withdrawn: { icon: Undo2, className: 'text-muted-foreground' },
  new_message: { icon: MessageCircle, className: 'text-primary' },
  invite_received: { icon: Mail, className: 'text-primary' },
  invite_accepted: { icon: UserCheck, className: 'text-warm-foreground' },
  invite_declined: { icon: UserX, className: 'text-destructive' },
  invite_cancelled: { icon: X, className: 'text-muted-foreground' },
  roster_joined: { icon: Users, className: 'text-warm-foreground' },
  roster_left: { icon: UserMinus, className: 'text-muted-foreground' },
}

export function truncateNotificationBody(body: string | null, maxLength = 80): string | null {
  if (!body) return null
  return body.length > maxLength ? `${body.slice(0, maxLength)}...` : body
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function notificationDateGroup(
  dateString: string,
  now: Date = new Date(),
): NotificationGroup['label'] {
  const today = startOfDay(now)
  const date = startOfDay(new Date(dateString))
  const daysAgo = Math.floor((today.getTime() - date.getTime()) / 86_400_000)

  if (daysAgo <= 0) return 'Today'
  if (daysAgo === 1) return 'Yesterday'
  if (daysAgo < 7) return 'This Week'
  return 'Earlier'
}

export function groupNotificationsByDate(
  notifications: Notification[],
  now: Date = new Date(),
): NotificationGroup[] {
  const order: NotificationGroup['label'][] = ['Today', 'Yesterday', 'This Week', 'Earlier']
  const groups = new Map<NotificationGroup['label'], Notification[]>()

  for (const notification of notifications) {
    const label = notificationDateGroup(notification.created_at, now)
    groups.set(label, [...(groups.get(label) ?? []), notification])
  }

  return order
    .map((label) => ({ label, notifications: groups.get(label) ?? [] }))
    .filter((group) => group.notifications.length > 0)
}

interface NotificationRowProps {
  notification: Notification
  onSelect: (notification: Notification) => void
  compact?: boolean
}

export function NotificationRow({
  notification,
  onSelect,
  compact = false,
}: NotificationRowProps) {
  const visual = NOTIFICATION_VISUALS[notification.type] ?? {
    icon: Bell,
    className: 'text-muted-foreground',
  }
  const Icon = visual.icon
  const body = truncateNotificationBody(notification.body)

  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={cn(
        'group flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors',
        'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !notification.read && 'bg-primary/5',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted',
          !notification.read && 'bg-primary/10',
        )}
        aria-hidden
      >
        <Icon className={cn('h-4 w-4', visual.className)} />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-start gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 text-sm leading-snug',
              notification.read ? 'font-medium' : 'font-semibold',
            )}
          >
            {notification.title}
          </span>
          {!notification.read && (
            <span
              aria-label="Unread"
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
            />
          )}
        </span>
        {body && (
          <span className="block text-xs leading-relaxed text-muted-foreground">{body}</span>
        )}
        <RelativeTime
          dateString={notification.created_at}
          className={cn('block text-[11px] text-muted-foreground', compact && 'text-[10px]')}
        />
      </span>
    </button>
  )
}
