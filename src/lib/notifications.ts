import { createServiceClient } from '@/lib/supabase/service'

export type NotificationType =
  | 'application_submitted'
  | 'application_reviewing'
  | 'application_accepted'
  | 'application_declined'
  | 'application_completed'
  | 'application_withdrawn'
  | 'new_message'
  | 'invite_received'
  | 'invite_accepted'
  | 'invite_declined'
  | 'invite_cancelled'
  | 'roster_joined'
  | 'roster_left'

export interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  body?: string
  link?: string
  metadata?: Record<string, unknown>
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('notifications').insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
      metadata: params.metadata ?? null,
    })

    if (error) {
      console.error('[notifications] createNotification failed:', {
        type: params.type,
        userId: params.userId,
        error: error.message,
      })
    }
  } catch (e) {
    console.error('[notifications] createNotification threw:', {
      type: params.type,
      userId: params.userId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
