import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { MessageThread } from '@/components/messages/message-thread'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import type { Message } from '@/types/database'

interface ShelterMessageThreadPageProps {
  params: { applicationId: string }
}

export default async function ShelterMessageThreadPage({
  params,
}: ShelterMessageThreadPageProps): Promise<React.JSX.Element> {
  if (DEV_MODE) {
    return (
      <div className="max-w-2xl space-y-4">
        <Link
          href="/shelter/messages"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Messages
        </Link>
        <p className="text-sm text-muted-foreground">
          Messaging requires a live Supabase connection.
        </p>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch the application with dog + foster names and verify shelter ownership
  const { data: application } = await supabase
    .from('applications')
    .select(
      'id, status, shelter_id, dog:dogs(name), foster:foster_parents(first_name, last_name), shelter:shelters(user_id)',
    )
    .eq('id', params.applicationId)
    .single()

  if (!application) notFound()

  // Ensure the logged-in shelter owns this application
  const shelter = application.shelter as unknown as { user_id: string }
  if (shelter.user_id !== user.id) redirect('/shelter/messages')

  // Only accepted/completed applications have message threads
  if (!['accepted', 'completed'].includes(application.status)) {
    redirect('/shelter/messages')
  }

  // Fetch messages ordered oldest-first for display
  const { data: messagesData } = await supabase
    .from('messages')
    .select('*')
    .eq('application_id', params.applicationId)
    .order('created_at', { ascending: true })

  const initialMessages = (messagesData ?? []) as Message[]

  // Mark all unread foster messages as read now that the shelter is viewing
  const unreadIds = initialMessages
    .filter((m) => m.sender_role === 'foster' && !m.read)
    .map((m) => m.id)

  if (unreadIds.length > 0) {
    await supabase.from('messages').update({ read: true }).in('id', unreadIds)
  }

  // Mirror the DB update in the in-memory array so MessageThread receives
  // accurate initial state. Without this, messages still carry read: false
  // in the client even though the database now has read: true.
  const unreadIdSet = new Set(unreadIds)
  const markedMessages =
    unreadIds.length > 0
      ? initialMessages.map((m) => (unreadIdSet.has(m.id) ? { ...m, read: true } : m))
      : initialMessages

  const dog = application.dog as unknown as { name: string }
  const foster = application.foster as unknown as { first_name: string; last_name: string }
  const dogName = dog.name
  const fosterName = `${foster.first_name} ${foster.last_name}`

  return (
    <div className="space-y-4">
      <Link
        href="/shelter/messages"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Messages
      </Link>

      <MessageThread
        applicationId={params.applicationId}
        myUserId={user.id}
        myRole="shelter"
        initialMessages={markedMessages}
        dogName={dogName}
        otherPartyName={fosterName}
      />
    </div>
  )
}
