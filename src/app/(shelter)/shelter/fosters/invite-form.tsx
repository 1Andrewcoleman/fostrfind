'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/**
 * Small form card rendered at the top of the shelter-side fosters index.
 * Dispatches to `POST /api/shelter/foster-invites` which also sends the
 * notification email. The whole surface is additive — omitting this
 * component is a no-op.
 */
export function InviteFosterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      toast.error('Enter an email to invite.')
      return
    }
    setSubmitting(true)

    try {
      const res = await fetch('/api/shelter/foster-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          message: message.trim() || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body?.error === 'string' ? body.error : 'Could not send invite',
        )
      }
      if (body?.alreadyInRoster) {
        toast.success(`${trimmedEmail} is already on your roster.`)
      } else {
        toast.success(`Invite sent to ${trimmedEmail}`)
      }
      setEmail('')
      setMessage('')
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send invite')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Invite a foster</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Send an invite by email. If they already have a Fostr Find account,
          it shows up in their Invites tab immediately. Otherwise it waits
          until they sign up with that email.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="foster@example.com"
            autoComplete="off"
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-message">Note (optional)</Label>
          <Textarea
            id="invite-message"
            rows={3}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. we loved working with you — would you like to hear about future fosters?"
            disabled={submitting}
          />
        </div>
        <div className="flex items-center justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send invite
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}
