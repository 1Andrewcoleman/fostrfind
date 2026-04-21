'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface StickySaveBarProps {
  /** Whether the form is currently in-flight. Disables both buttons. */
  loading?: boolean
  /** Whether any field has diverged from its initial snapshot. When
   * false, the bar is removed from flow entirely so it never masks
   * content or stacks below-fold on a pristine form. */
  dirty: boolean
  /** Fires when the user clicks Discard. Caller is responsible for
   * resetting local state back to the initial snapshot. */
  onDiscard?: () => void
  /** Customisable button copy for the primary action. */
  saveLabel?: string
  /** Customisable copy for the pending state ("Saving…" by default). */
  savingLabel?: string
  /** Sets the Save button's `type`. Most callers want the default
   * "submit" so the enclosing <form onSubmit> handles it. */
  saveButtonType?: 'submit' | 'button'
  /** Optional explicit onClick for the save action when
   * `saveButtonType === 'button'`. */
  onSave?: () => void
}

/**
 * Sticky action bar that appears at the bottom of long forms once the
 * user has made at least one change. Uses position: sticky so it stays
 * inside the main-pane column (the portal layout scrolls on the page
 * body); bleeds to the gutters with negative margins so its border
 * extends edge-to-edge across the content area.
 *
 * Behaviour notes:
 *   - Hidden until `dirty` flips true; callers don't need to unmount
 *     manually.
 *   - Honors motion-reduce: no slide/fade animation, just visibility.
 */
export function StickySaveBar({
  loading = false,
  dirty,
  onDiscard,
  saveLabel = 'Save changes',
  savingLabel = 'Saving…',
  saveButtonType = 'submit',
  onSave,
}: StickySaveBarProps) {
  if (!dirty) return null
  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 -mx-6 md:-mx-8 mt-6',
        '-mb-6 md:-mb-8 border-t border-border bg-card/95 backdrop-blur',
        'px-6 md:px-8 py-3 flex items-center gap-3 shadow-[0_-4px_12px_-8px_oklch(var(--foreground)/0.18)]',
      )}
      data-print-hide
    >
      <span className="text-xs text-muted-foreground">Unsaved changes</span>
      <div className="ml-auto flex items-center gap-2">
        {onDiscard && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            disabled={loading}
          >
            Discard
          </Button>
        )}
        <Button
          type={saveButtonType}
          size="sm"
          onClick={saveButtonType === 'button' ? onSave : undefined}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {savingLabel}
            </>
          ) : (
            saveLabel
          )}
        </Button>
      </div>
    </div>
  )
}
