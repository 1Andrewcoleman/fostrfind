'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface InviteActionsProps {
  inviteId: string
  shelterName: string
}

export function InviteActions({ inviteId, shelterName }: InviteActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Separate flags so a click on one button shows a spinner on only that
  // button, not both. Declarative: one in-flight action at a time.
  const [action, setAction] = useState<'accept' | 'decline' | null>(null)

  async function run(endpoint: 'accept' | 'decline') {
    if (action) return
    setAction(endpoint)
    try {
      const res = await fetch(`/api/shelter/foster-invites/${inviteId}/${endpoint}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(
          typeof body?.error === 'string' ? body.error : 'Something went wrong',
        )
      }
      toast.success(
        endpoint === 'accept'
          ? `Joined ${shelterName}'s roster`
          : `Declined ${shelterName}'s invite`,
      )
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setAction(null)
    }
  }

  const busy = action !== null || isPending

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => run('decline')}
        disabled={busy}
      >
        {action === 'decline' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <X className="h-4 w-4" />
        )}
        Decline
      </Button>
      <Button type="button" size="sm" onClick={() => run('accept')} disabled={busy}>
        {action === 'accept' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        Accept
      </Button>
    </>
  )
}
