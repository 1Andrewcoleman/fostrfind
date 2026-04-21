import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { MessageThread } from '@/components/messages/message-thread'

export const metadata: Metadata = { title: 'Thread' }
import { ServerErrorPanel } from '@/components/server-error-panel'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
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

  let userId = ''
  let dogName = ''
  let fosterName = ''
  let fosterAvatarUrl: string | null = null
  let markedMessages: Message[] = []
  let fetchError = false

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!user) redirect('/login')

    userId = user.id

    // Resolve the caller's shelter id first so the application query can
    // filter on shelter_id directly. Without this, the thread fetch relies
    // on the post-fetch user_id check and RLS alone to enforce ownership.
    const { data: shelterRow, error: shelterRowError } = await supabase
      .from('shelters')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (shelterRowError) throw shelterRowError
    if (!shelterRow) redirect('/onboarding')

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select(
        'id, status, shelter_id, dog:dogs(name), foster:foster_parents(first_name, last_name, avatar_url)',
      )
      .eq('id', params.applicationId)
      .eq('shelter_id', shelterRow.id)
      .maybeSingle()

    if (appError) throw appError
    if (!application) notFound()

    if (!['accepted', 'completed'].includes(application.status)) {
      redirect('/shelter/messages')
    }

    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('application_id', params.applicationId)
      .order('created_at', { ascending: true })

    if (messagesError) throw messagesError
    const initialMessages = (messagesData ?? []) as Message[]

    const unreadIds = initialMessages
      .filter((m) => m.sender_role === 'foster' && !m.read)
      .map((m) => m.id)

    if (unreadIds.length > 0) {
      await supabase.from('messages').update({ read: true }).in('id', unreadIds)
    }

    const unreadIdSet = new Set(unreadIds)
    markedMessages =
      unreadIds.length > 0
        ? initialMessages.map((m) => (unreadIdSet.has(m.id) ? { ...m, read: true } : m))
        : initialMessages

    const dog = application.dog as unknown as { name: string }
    const foster = application.foster as unknown as {
      first_name: string
      last_name: string
      avatar_url: string | null
    }
    dogName = dog.name
    fosterName = `${foster.first_name} ${foster.last_name}`
    fosterAvatarUrl = foster.avatar_url ?? null
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.error('[shelter/messages/:id] load failed:', e instanceof Error ? e.message : String(e))
    fetchError = true
  }

  return (
    <div className="space-y-4">
      <Link
        href="/shelter/messages"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Messages
      </Link>

      {fetchError ? (
        <ServerErrorPanel />
      ) : (
        <MessageThread
          applicationId={params.applicationId}
          myUserId={userId}
          myRole="shelter"
          initialMessages={markedMessages}
          dogName={dogName}
          otherPartyName={fosterName}
          otherPartyAvatarUrl={fosterAvatarUrl}
        />
      )}
    </div>
  )
}
