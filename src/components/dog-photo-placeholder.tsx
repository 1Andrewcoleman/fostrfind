import { PawPrint } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DogPhotoPlaceholderProps {
  /** 'card' for grid cards; 'detail' for the hero slot on detail pages
   * (larger glyph + a quiet caption). */
  size?: 'card' | 'detail'
  className?: string
}

/**
 * Shared fallback for dogs without photos. A warm two-pastel gradient
 * (powder-petal → cherry-blossom, both existing tokens) instead of the
 * previous flat grey boxes — photo-less dogs are exactly the ones that
 * need the warmth. Fills its parent, so callers keep their own aspect
 * wrappers. No 'use client': purely presentational, safe in RSC trees.
 */
export function DogPhotoPlaceholder({
  size = 'card',
  className,
}: DogPhotoPlaceholderProps) {
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-2',
        'bg-gradient-to-br from-peach/40 to-primary/15',
        className,
      )}
    >
      <PawPrint
        aria-hidden
        className={
          size === 'detail'
            ? 'h-16 w-16 text-foreground/30'
            : 'h-12 w-12 text-foreground/30'
        }
      />
      {size === 'detail' && (
        <p className="text-xs text-muted-foreground">Photos coming soon</p>
      )}
    </div>
  )
}
