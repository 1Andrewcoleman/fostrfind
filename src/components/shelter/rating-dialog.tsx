'use client'

/**
 * RatingDialog — shown by AcceptDeclineButtons after a shelter marks a
 * placement as completed. Collects a 1–5 star score and an optional comment,
 * then submits to POST /api/ratings.
 */

import { RatingDialogBase } from '@/components/rating-dialog-base'

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
  return (
    <RatingDialogBase
      applicationId={applicationId}
      endpoint="/api/ratings"
      title="Rate your foster"
      description={
        <>
          How did <strong>{fosterName}</strong> do fostering <strong>{dogName}</strong>?
          Your feedback helps other shelters make informed decisions.
        </>
      }
      commentPlaceholder="Share a note about this foster parent…"
      isOpen={isOpen}
      onClose={onClose}
    />
  )
}
