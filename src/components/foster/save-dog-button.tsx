'use client'

import { useState } from 'react'
import { Heart, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SaveDogButtonProps {
  dogId: string
  dogName: string
  initialSaved: boolean
  /** Compact icon-only treatment for browse cards; default is the full
   *  pill button used on dog detail. */
  compact?: boolean
}

/**
 * Phase 6.5 — heart toggle for fosters. Optimistic flip with revert on
 * error. Shelter-side aggregate counts are computed via the
 * `get_save_counts_for_my_dogs` RPC; this component only manages the
 * caller's own state.
 */
export function SaveDogButton({
  dogId,
  dogName,
  initialSaved,
  compact = false,
}: SaveDogButtonProps): React.JSX.Element {
  const [saved, setSaved] = useState(initialSaved)
  const [pending, setPending] = useState(false)

  async function toggle(): Promise<void> {
    if (pending) return
    const next = !saved
    setSaved(next)
    setPending(true)
    try {
      const res = await fetch(`/api/dogs/${dogId}/save`, {
        method: next ? 'POST' : 'DELETE',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaved(!next)
        toast.error(json?.error ?? 'Could not update save.')
        return
      }
      toast.success(next ? `Saved ${dogName}` : `Removed ${dogName} from saved`)
    } catch {
      setSaved(!next)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={saved ? `Remove ${dogName} from saved` : `Save ${dogName}`}
        aria-pressed={saved}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void toggle()
        }}
        disabled={pending}
        className="bg-background/80 backdrop-blur-sm hover:bg-background"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart
            className={cn(
              'h-4 w-4 transition-colors',
              saved ? 'fill-primary text-primary' : 'text-muted-foreground',
            )}
          />
        )}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant={saved ? 'default' : 'outline'}
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
    >
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Heart
          className={cn(
            'mr-2 h-4 w-4 transition-colors',
            saved && 'fill-current',
          )}
        />
      )}
      {saved ? 'Saved' : 'Save'}
    </Button>
  )
}
