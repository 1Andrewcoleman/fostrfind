'use client'

/**
 * RatingDialog — shown by AcceptDeclineButtons after a shelter marks a
 * placement as completed. Collects a 1–5 star score and an optional comment,
 * then submits to POST /api/ratings.
 */

import { useEffect, useRef, useState } from 'react'
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

interface RatingDialogProps {
  applicationId: string
  dogName: string
  fosterName: string
  isOpen: boolean
  onClose: () => void
}

export function RatingDialog({
  applicationId,
  dogName,
  fosterName,
  isOpen,
  onClose,
}: RatingDialogProps) {
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Guards against handleClose being invoked twice in the same close cycle.
  // When handleSubmit calls handleClose() → onClose() → parent sets isOpen=false →
  // Radix fires onOpenChange(false) → handleClose() would be called a second time,
  // causing router.refresh() to execute twice. The ref is synchronous so it
  // catches the second invocation in the same event loop turn.
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

    // Reset form state so the dialog is clean if the shelter opens it again
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
      const res = await fetch('/api/ratings', {
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
          <DialogTitle>Rate your foster</DialogTitle>
          <DialogDescription>
            How did <strong>{fosterName}</strong> do fostering <strong>{dogName}</strong>?
            Your feedback helps other shelters make informed decisions.
          </DialogDescription>
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
              placeholder="Share a note about this foster parent…"
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
            {isSubmitting ? 'Submitting…' : 'Submit Rating'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
