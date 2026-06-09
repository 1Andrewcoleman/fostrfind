'use client'

/**
 * ShelterRatingDialog — foster side of the two-way trust loop.
 *
 * Mirrors the shelter's `RatingDialog` but posts to `/api/shelter-ratings`
 * and speaks about rating the shelter, not the foster.
 */

import { RatingDialogBase } from '@/components/rating-dialog-base'

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
  return (
    <RatingDialogBase
      applicationId={applicationId}
      endpoint="/api/shelter-ratings"
      title="Rate your shelter"
      description={
        <>
          How did <strong>{shelterName}</strong> do with <strong>{dogName}</strong>&apos;s
          placement? Your feedback helps other fosters pick the right shelter.
        </>
      }
      commentPlaceholder="Share a note about this shelter…"
      refreshOnSuccess
      isOpen={isOpen}
      onClose={onClose}
    />
  )
}
