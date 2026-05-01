import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { NotificationsList } from '@/components/notifications/notifications-list'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import type { Notification } from '@/types/database'

export const metadata: Metadata = { title: 'Notifications' }

export default async function ShelterNotificationsPage() {
  if (DEV_MODE) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Applications, messages, and foster roster updates will appear here.
          </p>
        </div>
        <NotificationsList notifications={[]} portal="shelter" />
      </div>
    )
  }

  let notifications: Notification[] = []
  let fetchError = false

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!user) redirect('/login')

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    notifications = (data ?? []) as unknown as Notification[]
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.error('[shelter/notifications] load failed:', e instanceof Error ? e.message : String(e))
    fetchError = true
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Applications, messages, and foster roster updates will appear here.
        </p>
      </div>

      {fetchError ? (
        <ServerErrorPanel />
      ) : (
        <NotificationsList notifications={notifications} portal="shelter" />
      )}
    </div>
  )
}
