'use client'
import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function RealtimeNotificationWatcher({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          router.refresh()
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [userId, supabase, router])

  return null
}
