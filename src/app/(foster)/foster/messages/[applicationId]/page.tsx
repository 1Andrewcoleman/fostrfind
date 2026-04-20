import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { MessageThread } from '@/components/messages/message-thread'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import type { Message } from '@/types/database'

interface FosterMessageThreadPageProps {
  params: { applicationId: string }
}

export default async function FosterMessageThreadPage({
  params,
}: FosterMessageThreadPageProps): Promise<React.JSX.Element> {
  if (DEV_MODE) {
    return (
      <div className="max-w-2xl space-y-4">
        <Link
          href="/foster/messages"
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
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) redirect('/login')

  // Fetch the application with dog + shelter names and verify foster ownership
  const { data: application } = await supabase
    .from('applications')
    .select(
      'id, status, foster_id, dog:dogs(name), shelter:shelters(name), foster:foster_parents(user_id)',
    )
    .eq('id', params.applicationId)
    .single()

  if (!application) notFound()

  // Ensure the logged-in foster owns this application
  const fosterRecord = application.foster as unknown as { user_id: string }
  if (fosterRecord.user_id !== user.id) redirect('/foster/messages')

  // Only accepted/completed applications have message threads
  if (!['accepted', 'completed'].includes(application.status)) {
    redirect('/foster/messages')
  }

  // Fetch messages ordered oldest-first for display
  const { data: messagesData } = await supabase
    .from('messages')
    .select('*')
    .eq('application_id', params.applicationId)
    .order('created_at', { ascending: true })

  const initialMessages = (messagesData ?? []) as Message[]

  // Mark all unread shelter messages as read now that the foster is viewing
  const unreadIds = initialMessages
    .filter((m) => m.sender_role === 'shelter' && !m.read)
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
  const shelter = application.shelter as unknown as { name: string }
  const dogName = dog.name
  const shelterName = shelter.name

  return (
    <div className="space-y-4">
      <Link
        href="/foster/messages"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Messages
      </Link>

      <MessageThread
        applicationId={params.applicationId}
        myUserId={user.id}
        myRole="foster"
        initialMessages={markedMessages}
        dogName={dogName}
        otherPartyName={shelterName}
      />
    </div>
  )
}
