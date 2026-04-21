'use client'

import { useMemo } from 'react'

/**
 * Reports whether the current form value has diverged from its initial
 * snapshot. Used to show the sticky save bar only when the user has
 * actually changed something.
 *
 * Uses JSON.stringify rather than deep-equal because every form we
 * currently ship serialises cleanly (primitives, arrays, nested objects
 * of the same). Callers are expected to pass a stable (memoised or
 * prop-derived) `initial` — post-save, the parent RSC passes a new
 * `initial` with the persisted data, which correctly flips dirty back
 * to false.
 */
export function useDirtyState<T>(current: T, initial: T): boolean {
  return useMemo(
    () => JSON.stringify(current ?? null) !== JSON.stringify(initial ?? null),
    [current, initial],
  )
}
