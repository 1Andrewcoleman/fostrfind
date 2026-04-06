'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface MessageThreadPageProps {
  params: { applicationId: string }
}

// Placeholder messages — remove when Supabase is wired
const PLACEHOLDER_MESSAGES = [
  { id: '1', sender_role: 'foster', body: 'Hi! I would love to foster Buddy.', created_at: '2024-01-01T10:00:00Z' },
  { id: '2', sender_role: 'shelter', body: 'Great! We reviewed your profile and would love to chat.', created_at: '2024-01-01T11:00:00Z' },
]

export default function ShelterMessageThreadPage({ params }: MessageThreadPageProps) {
  const [newMessage, setNewMessage] = useState('')

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim()) return
    // TODO: insert message into Supabase and subscribe via Realtime
    console.log('Send message:', newMessage, 'for application:', params.applicationId)
    setNewMessage('')
  }

  return (
    <div className="max-w-2xl flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="pb-4 border-b mb-4">
        <h1 className="text-xl font-bold">Buddy · Jane Doe</h1>
        <p className="text-sm text-muted-foreground">Foster application thread</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {PLACEHOLDER_MESSAGES.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender_role === 'shelter' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${
                msg.sender_role === 'shelter'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted rounded-bl-sm'
              }`}
            >
              <p>{msg.body}</p>
              <p className={`text-xs mt-1 ${
                msg.sender_role === 'shelter' ? 'text-primary-foreground/70' : 'text-muted-foreground'
              }`}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {/* TODO: subscribe to supabase.channel('messages').on('postgres_changes', ...) */}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2">
        <Input
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
