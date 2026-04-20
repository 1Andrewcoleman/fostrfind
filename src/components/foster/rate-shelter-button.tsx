'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StarRating } from '@/components/star-rating'
import { ShelterRatingDialog } from '@/components/foster/shelter-rating-dialog'
import type { ShelterRating } from '@/types/database'

interface RateShelterButtonProps {
  applicationId: string
  dogName: string
  shelterName: string
  existingRating?: ShelterRating
}

/**
 * Foster-side entry point into the two-way trust rating loop.
 * Renders either:
 *   - The previously-submitted rating (stars + optional comment), or
 *   - A "Rate shelter" button that opens `ShelterRatingDialog`.
 */
export function RateShelterButton({
  applicationId,
  dogName,
  shelterName,
  existingRating,
}: RateShelterButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (existingRating) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Your rating of {shelterName}:</span>
        <StarRating value={existingRating.score} size="sm" />
        {existingRating.comment && (
          <span className="italic">&ldquo;{existingRating.comment}&rdquo;</span>
        )}
      </div>
    )
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={() => setIsOpen(true)}
      >
        <Star className="h-3.5 w-3.5" />
        Rate shelter
      </Button>
      <ShelterRatingDialog
        applicationId={applicationId}
        dogName={dogName}
        shelterName={shelterName}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}
