'use client'

/**
 * ShelterRatingDialog — foster side of the two-way trust loop.
 *
 * Mirrors the shelter's `RatingDialog` but posts to `/api/shelter-ratings`
 * and speaks about rating the shelter, not the foster.
 */

import { useEffect, useRef, useState } from 'react'
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

interface ShelterRatingDialogProps {
  applicationId: string
  dogName: string
  shelterName: string
  isOpen: boolean
  onClose: () => void
}

export function ShelterRatingDialog({
  applicationId,
  dogName,
  shelterName,
  isOpen,
  onClose,
}: ShelterRatingDialogProps) {
  const router = useRouter()
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isClosingRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false
    }
  }, [isOpen])

  function handleClose() {
    if (isClosingRef.current) return
    isClosingRef.current = true
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
      const res = await fetch('/api/shelter-ratings', {
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
      router.refresh()
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
          <DialogTitle>Rate your shelter</DialogTitle>
          <DialogDescription>
            How did <strong>{shelterName}</strong> do with <strong>{dogName}</strong>&apos;s
            placement? Your feedback helps other fosters pick the right shelter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Rating</p>
            <StarRating value={score} onChange={setScore} size="lg" />
            {score > 0 && (
              <p className="text-xs text-muted-foreground">
                {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][score]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Comment{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <Textarea
              placeholder="Share a note about this shelter…"
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
