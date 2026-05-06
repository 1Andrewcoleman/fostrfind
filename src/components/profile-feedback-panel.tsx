'use client'

import { useState } from 'react'
import { Loader2, MessageSquarePlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

interface ProfileFeedbackPanelProps {
  portal: 'foster' | 'shelter'
}

export function ProfileFeedbackPanel({ portal }: ProfileFeedbackPanelProps) {
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = message.trim()
    if (trimmed.length < 10) {
      toast.error('Please write at least a sentence.')
      return
    }

    setPending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, portal }),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
        mocked?: boolean
      }

      if (!res.ok) {
        toast.error(payload.error ?? 'Something went wrong.')
        setPending(false)
        return
      }

      toast.success(
        payload.mocked
          ? 'Feedback logged locally (email not configured in this environment).'
          : 'Thanks — we received your feedback.',
      )
      setMessage('')
    } catch {
      toast.error('Could not send feedback. Check your connection and try again.')
    }
    setPending(false)
  }

  return (
    <Card className="border-primary/15">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquarePlus className="h-5 w-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold leading-tight">Send feedback</CardTitle>
            <CardDescription>
              Bug reports, ideas, or confusing flows — we read everything sent from here.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            id="profile-feedback-message"
            name="message"
            rows={5}
            maxLength={4000}
            placeholder="What happened? What did you expect?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[120px] resize-y"
            disabled={pending}
            aria-label="Feedback message"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{message.trim().length}/4000</p>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit feedback
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
