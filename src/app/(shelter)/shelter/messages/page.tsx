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
  foster: { first_name: string; last_name: string }
  messages: Message[]
}

interface ThreadSummary {
  applicationId: string
  dogName: string
  fosterName: string
  status: string
  lastMessageBody: string | null
  lastMessageAt: string | null
  lastMessageSenderRole: 'shelter' | 'foster' | null
  unreadCount: number
}

/**
 * Converts a raw application row (with nested messages) into a flat
 * ThreadSummary sorted by most-recent message time.
 */
function toThreadSummary(app: RawApplicationRow): ThreadSummary {
  const sorted = [...(app.messages ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const last = sorted[0] ?? null
  const unreadCount = sorted.filter((m) => m.sender_role === 'foster' && !m.read).length

  return {
    applicationId: app.id,
    dogName: app.dog.name,
    fosterName: `${app.foster.first_name} ${app.foster.last_name}`,
    status: app.status,
    lastMessageBody: last?.body ?? null,
    lastMessageAt: last?.created_at ?? null,
    lastMessageSenderRole: last?.sender_role ?? null,
    unreadCount,
  }
}

export default async function ShelterMessagesPage() {
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

    const { data: shelterRow, error: shelterError } = await supabase
      .from('shelters')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (shelterError) throw shelterError
    if (!shelterRow) redirect('/onboarding')

    const { data: raw, error: rawError } = await supabase
      .from('applications')
      .select(
        'id, status, dog:dogs(name), foster:foster_parents(first_name, last_name), messages(id, body, created_at, read, sender_role)',
      )
      .eq('shelter_id', shelterRow.id)
      .in('status', ['accepted', 'completed'])
      .order('created_at', { ascending: false })

    if (rawError) throw rawError

    threads = ((raw ?? []) as unknown as RawApplicationRow[])
      .map(toThreadSummary)
      .sort((a, b) => {
        // Threads with messages float to the top, sorted by most-recent message
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
        return bTime - aTime
      })
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.error('[shelter/messages] load failed:', e instanceof Error ? e.message : String(e))
    fetchError = true
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Messages</h1>

      {fetchError ? (
        <ServerErrorPanel />
      ) : threads.length === 0 ? (
        <EmptyState
          title="No message threads yet"
          description="Messaging opens automatically when you accept a foster application."
          action={{ label: 'View applications', href: '/shelter/applications' }}
        />
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <Link
              key={thread.applicationId}
              href={`/shelter/messages/${thread.applicationId}`}
              className="block"
            >
              <Card className={`transition-shadow hover:shadow-sm ${thread.unreadCount > 0 ? 'bg-primary/5 border-primary/20' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <MessageCircle className={`h-5 w-5 mt-0.5 shrink-0 ${thread.unreadCount > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="min-w-0">
                        <p className={`truncate ${thread.unreadCount > 0 ? 'font-semibold' : 'font-medium'}`}>
                          {thread.dogName} · {thread.fosterName}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {thread.lastMessageBody ? (
                            <>
                              {thread.lastMessageSenderRole === 'shelter' && (
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
