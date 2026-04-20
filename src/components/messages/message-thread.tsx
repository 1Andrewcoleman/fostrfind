'use client'

/**
 * MessageThread — interactive message list + send form.
 *
 * This is a pure client component. The parent server page handles initial
 * data fetching and a one-shot mark-as-read on the initial render; this
 * component manages sending, optimistic updates, and a Supabase Realtime
 * subscription that pushes new messages from the other party into the
 * list without a page refresh.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { sanitizeMultiline } from '@/lib/sanitize'
import type { Message } from '@/types/database'

// ---------------------------------------------------------------------------
// Typing indicator — three animated dots in an incoming-style bubble.
// Rendered when `showTypingIndicator` is true (wired to Realtime later).
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
            style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.8s' }}
          />
        ))}
      </div>
    </div>
  )
}

interface MessageThreadProps {
  applicationId: string
  /** auth.uid() of the logged-in user — used as sender_id on insert. */
  myUserId: string
  /** Determines message bubble alignment and sender_role on insert. */
  myRole: 'shelter' | 'foster'
  initialMessages: Message[]
  dogName: string
  otherPartyName: string
  /** Show animated typing indicator (wire to Realtime presence later). */
  showTypingIndicator?: boolean
}

export function MessageThread({
  applicationId,
  myUserId,
  myRole,
  initialMessages,
  dogName,
  otherPartyName,
  showTypingIndicator = false,
}: MessageThreadProps) {
  // Single browser Supabase client per mount — creating it inside render would
  // re-instantiate the websocket on every state change.
  const supabase = useMemo(() => createClient(), [])
  const scrollRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)

  // Scroll to the bottom whenever the message list grows
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Realtime: subscribe to INSERTs on `public.messages` for this application.
  // Own-sends arrive as Realtime events too, so we dedupe against the state
  // list (optimistic and confirmed rows both carry the same row id once the
  // server replies). Incoming messages from the other party are immediately
  // marked as read via a client-side UPDATE — RLS (20240104) lets the receiver
  // flip `read` to true on rows where `sender_id != auth.uid()`.
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${applicationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `application_id=eq.${applicationId}`,
        },
        (payload) => {
          const incoming = payload.new as Message
          const isMine = incoming.sender_id === myUserId

          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev
            if (isMine) {
              // Replace any still-pending optimistic row for this sender.
              const optimisticIdx = prev.findIndex((m) =>
                m.id.startsWith('optimistic-') && m.sender_id === myUserId,
              )
              if (optimisticIdx !== -1) {
                const next = prev.slice()
                next[optimisticIdx] = incoming
                return next
              }
            }
            return [...prev, incoming]
          })

          if (!isMine) {
            // Best-effort read receipt. Failures are harmless — the parent
            // server page's mark-as-read on next load will sweep the row up.
            void supabase
              .from('messages')
              .update({ read: true })
              .eq('id', incoming.id)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [applicationId, myUserId, supabase])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()

    // Sanitise before submit so we neither persist nor echo back raw
    // HTML. Next still escapes on render, but other surfaces (email
    // previews, exports) won't get that for free.
    const body = sanitizeMultiline(inputValue).slice(0, 4000)
    if (!body || isSending) return

    // Optimistically add the message before the network round-trip
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMsg: Message = {
      id: optimisticId,
      created_at: new Date().toISOString(),
      application_id: applicationId,
      sender_id: myUserId,
      sender_role: myRole,
      body,
      read: false,
    }

    setMessages((prev) => [...prev, optimisticMsg])
    setInputValue('')
    setIsSending(true)

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          application_id: applicationId,
          sender_id: myUserId,
          sender_role: myRole,
          body,
        })
        .select()
        .single()

      if (error) {
        // Roll back the optimistic message and restore the input
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        setInputValue(body)
        toast.error('Failed to send message. Please try again.')
        return
      }

      // Replace the optimistic placeholder with the confirmed server row
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? (data as Message) : m)),
      )
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setInputValue(body)
      toast.error('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="max-w-2xl flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)]">
      {/* Thread header */}
      <div className="pb-4 border-b mb-4 shrink-0">
        <h1 className="text-xl font-bold">
          {dogName} · {otherPartyName}
        </h1>
        <p className="text-sm text-muted-foreground">Foster application thread</p>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1"
        aria-label="Message history"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-4">
              <MessageCircle className="h-10 w-10 text-primary" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">Start the conversation</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Send a message to {otherPartyName} about {dogName}.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.sender_role === myRole
          const isOptimistic = msg.id.startsWith('optimistic-')

          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm transition-opacity ${
                  isOptimistic ? 'opacity-60' : 'opacity-100'
                } ${
                  isMine
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted rounded-bl-sm'
                }`}
              >
                <p>{msg.body}</p>
                <p
                  className={`text-xs mt-1 ${
                    isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}
                >
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )
        })}

        {showTypingIndicator && <TypingIndicator />}
      </div>

      {/* Send form */}
      <form onSubmit={handleSend} className="flex gap-2 shrink-0">
        <Input
          placeholder="Type a message…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isSending}
          className="flex-1"
          aria-label="Message input"
        />
        <Button type="submit" size="icon" disabled={isSending || !inputValue.trim()}>
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  )
}
