import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { MessageThread } from '@/components/messages/message-thread'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
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

  let userId = ''
  let dogName = ''
  let shelterName = ''
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

    // Resolve the caller's foster id first so the application query can
    // filter on foster_id directly, keeping ownership enforcement explicit
    // rather than relying on a post-fetch user_id comparison plus RLS.
    const { data: fosterRow, error: fosterRowError } = await supabase
      .from('foster_parents')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (fosterRowError) throw fosterRowError
    if (!fosterRow) redirect('/onboarding')

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select(
        'id, status, foster_id, dog:dogs(name), shelter:shelters(name)',
      )
      .eq('id', params.applicationId)
      .eq('foster_id', fosterRow.id)
      .maybeSingle()

    if (appError) throw appError
    if (!application) notFound()

    if (!['accepted', 'completed'].includes(application.status)) {
      redirect('/foster/messages')
    }

    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('application_id', params.applicationId)
      .order('created_at', { ascending: true })

    if (messagesError) throw messagesError
    const initialMessages = (messagesData ?? []) as Message[]

    const unreadIds = initialMessages
      .filter((m) => m.sender_role === 'shelter' && !m.read)
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
    const shelter = application.shelter as unknown as { name: string }
    dogName = dog.name
    shelterName = shelter.name
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.error('[foster/messages/:id] load failed:', e instanceof Error ? e.message : String(e))
    fetchError = true
  }

  return (
    <div className="space-y-4">
      <Link
        href="/foster/messages"
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
          myRole="foster"
          initialMessages={markedMessages}
          dogName={dogName}
          otherPartyName={shelterName}
        />
      )}
    </div>
  )
}
