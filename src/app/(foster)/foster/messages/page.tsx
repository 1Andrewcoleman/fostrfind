import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MessageCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'Messages' }
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { createClient } from '@/lib/supabase/server'
import { RelativeTime } from '@/components/relative-time'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import type { Message } from '@/types/database'

interface RawApplicationRow {
  id: string
  status: string
  dog: { name: string }
  shelter: { name: string }
  messages: Message[]
}

interface ThreadSummary {
  applicationId: string
  dogName: string
  shelterName: string
  status: string
  lastMessageBody: string | null
  lastMessageAt: string | null
  lastMessageSenderRole: 'shelter' | 'foster' | null
  unreadCount: number
}

function toThreadSummary(app: RawApplicationRow): ThreadSummary {
  const sorted = [...(app.messages ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const last = sorted[0] ?? null
  // Unread for a foster = messages sent by the shelter that haven't been read
  const unreadCount = sorted.filter((m) => m.sender_role === 'shelter' && !m.read).length

  return {
    applicationId: app.id,
    dogName: app.dog.name,
    shelterName: app.shelter.name,
    status: app.status,
    lastMessageBody: last?.body ?? null,
    lastMessageAt: last?.created_at ?? null,
    lastMessageSenderRole: last?.sender_role ?? null,
    unreadCount,
  }
}

export default async function FosterMessagesPage() {
  if (DEV_MODE) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-sm text-muted-foreground">
          Messaging requires a live Supabase connection. Set{' '}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> in your environment.
        </p>
      </div>
    )
  }

  let threads: ThreadSummary[] = []
  let fetchError = false

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!user) redirect('/login')

    const { data: fosterRow, error: fosterError } = await supabase
      .from('foster_parents')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (fosterError) throw fosterError
    if (!fosterRow) redirect('/onboarding')

    const { data: raw, error: rawError } = await supabase
      .from('applications')
      .select(
        'id, status, dog:dogs(name), shelter:shelters(name), messages(id, body, created_at, read, sender_role)',
      )
      .eq('foster_id', fosterRow.id)
      .in('status', ['accepted', 'completed'])
      .order('created_at', { ascending: false })

    if (rawError) throw rawError

    threads = ((raw ?? []) as unknown as RawApplicationRow[])
      .map(toThreadSummary)
      .sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
        return bTime - aTime
      })
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.error('[foster/messages] load failed:', e instanceof Error ? e.message : String(e))
    fetchError = true
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Messages</h1>

      {fetchError ? (
        <ServerErrorPanel />
      ) : threads.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Once a shelter accepts your application, you'll be able to message them here."
          action={{ label: 'View applications', href: '/foster/applications' }}
        />
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <Link
              key={thread.applicationId}
              href={`/foster/messages/${thread.applicationId}`}
              className="block"
            >
              <Card className={`transition-shadow hover:shadow-sm ${thread.unreadCount > 0 ? 'bg-primary/5 border-primary/20' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <MessageCircle className={`h-5 w-5 mt-0.5 shrink-0 ${thread.unreadCount > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="min-w-0">
                        <p className={`truncate ${thread.unreadCount > 0 ? 'font-semibold' : 'font-medium'}`}>
                          {thread.dogName} · {thread.shelterName}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {thread.lastMessageBody ? (
                            <>
                              {thread.lastMessageSenderRole === 'foster' && (
                                <span className="text-muted-foreground/70">You: </span>
                              )}
                              {thread.lastMessageBody}
                            </>
                          ) : (
                            <span className="italic">No messages yet — start the conversation</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {thread.lastMessageAt && (
                        <RelativeTime
                          dateString={thread.lastMessageAt}
                          className="text-xs text-muted-foreground"
                        />
                      )}
                      {thread.unreadCount > 0 && (
                        <Badge className="text-[10px] h-5 px-1.5">
                          {thread.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
