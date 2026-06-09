'use client'

/**
 * Shared star-rating dialog used by both sides of the two-way trust loop:
 * shelter rates foster (`RatingDialog`) and foster rates shelter
 * (`ShelterRatingDialog`). The wrappers own the copy and endpoint; this
 * component owns the form state, double-close guard, and submit flow.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { StarRating } from '@/components/star-rating'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface RatingDialogBaseProps {
  applicationId: string
  endpoint: string
  title: string
  description: ReactNode
  commentPlaceholder: string
  /** Call router.refresh() after a successful submit so server-rendered
   *  "Rate" affordances pick up the new rating. */
  refreshOnSuccess?: boolean
  isOpen: boolean
  onClose: () => void
}

export function RatingDialogBase({
  applicationId,
  endpoint,
  title,
  description,
  commentPlaceholder,
  refreshOnSuccess = false,
  isOpen,
  onClose,
}: RatingDialogBaseProps) {
  const router = useRouter()
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Guards against handleClose being invoked twice in the same close cycle.
  // When handleSubmit calls handleClose() → onClose() → parent sets isOpen=false →
  // Radix fires onOpenChange(false) → handleClose() would be called a second
  // time. The ref is synchronous so it catches the second invocation in the
  // same event loop turn.
  const isClosingRef = useRef(false)

  // Re-arm the guard whenever the dialog is opened so it works on repeat uses.
  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false
    }
  }, [isOpen])

  function handleClose() {
    if (isClosingRef.current) return
    isClosingRef.current = true

    // Reset form state so the dialog is clean if it is opened again
    setScore(0)
    setComment('')
    onClose()
  }

  async function handleSubmit() {
    if (score === 0) {
      toast.error('Please select a star rating before submitting.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          score,
          comment: comment.trim() || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to submit rating.')
        return
      }

      toast.success('Rating submitted — thank you!')
      handleClose()
      if (refreshOnSuccess) router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Star selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Rating</p>
            <StarRating value={score} onChange={setScore} size="lg" />
            {score > 0 && (
              <p className="text-xs text-muted-foreground">
                {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][score]}
              </p>
            )}
          </div>

          {/* Optional comment */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Comment{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <Textarea
              placeholder={commentPlaceholder}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground text-right">{comment.length}/500</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={score === 0 || isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit rating'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
