'use client'

/**
 * MessageThread — interactive message list + send form.
 *
 * This is a pure client component. The parent server page handles initial
 * data fetching and mark-as-read; this component manages the send interaction
 * and optimistically appends new messages to the local list.
 *
 * Realtime subscription is intentionally omitted. Users see new messages on
 * page refresh or navigation.
 */

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import type { Message } from '@/types/database'

interface MessageThreadProps {
  applicationId: string
  /** auth.uid() of the logged-in user — used as sender_id on insert. */
  myUserId: string
  /** Determines message bubble alignment and sender_role on insert. */
  myRole: 'shelter' | 'foster'
  initialMessages: Message[]
  dogName: string
  otherPartyName: string
}

export function MessageThread({
  applicationId,
  myUserId,
  myRole,
  initialMessages,
  dogName,
  otherPartyName,
}: MessageThreadProps) {
  const supabase = createClient()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)

  // Scroll to the bottom whenever the message list grows
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()

    const body = inputValue.trim()
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
          <p className="text-sm text-center text-muted-foreground py-8">
            No messages yet. Say hello!
          </p>
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
