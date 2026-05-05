'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
}

// Filled-star color. The previous `fill-peach text-peach` rendered as
// near-cream on the light off-white background — ratings were
// effectively invisible. Amber is the universal star convention and
// has sufficient contrast on both light and dark surfaces.
const FILLED_STAR = 'fill-amber-400 text-amber-500 dark:fill-amber-300 dark:text-amber-300'
const EMPTY_STAR = 'fill-transparent text-muted-foreground'

export function StarRating({ value, onChange, size = 'md', className }: StarRatingProps) {
  const isInteractive = !!onChange

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!isInteractive}
          onClick={() => onChange?.(star)}
          className={cn(
            'transition-colors',
            isInteractive ? 'cursor-pointer hover:scale-110' : 'cursor-default'
          )}
        >
          <Star className={cn(sizeClasses[size], star <= value ? FILLED_STAR : EMPTY_STAR)} />
        </button>
      ))}
    </div>
  )
}
