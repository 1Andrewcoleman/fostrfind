import type { Metadata } from 'next'
import { NotificationsPage } from '@/components/notifications/notifications-page'

export const metadata: Metadata = { title: 'Notifications' }

export default function FosterNotificationsPage() {
  return <NotificationsPage portal="foster" />
}
