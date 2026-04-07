import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/helpers'
import type { Message } from '@/types/database'

const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')

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

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: fosterRow } = await supabase
    .from('foster_parents')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!fosterRow) redirect('/onboarding')

  const { data: raw } = await supabase
    .from('applications')
    .select(
      'id, status, dog:dogs(name), shelter:shelters(name), messages(id, body, created_at, read, sender_role)',
    )
    .eq('foster_id', fosterRow.id)
    .in('status', ['accepted', 'completed'])
    .order('created_at', { ascending: false })

  const threads: ThreadSummary[] = ((raw ?? []) as unknown as RawApplicationRow[])
    .map(toThreadSummary)
    .sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
      return bTime - aTime
    })

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Messages</h1>

      {threads.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Once a shelter accepts your application, you'll be able to message them here."
        />
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <Link
              key={thread.applicationId}
              href={`/foster/messages/${thread.applicationId}`}
              className="block"
            >
              <Card className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <MessageCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {thread.dogName} · {thread.shelterName}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {thread.lastMessageBody ?? (
                            <span className="italic">No messages yet — start the conversation</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {thread.lastMessageAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(thread.lastMessageAt)}
                        </span>
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
