'use client'

import { useEffect, useState } from 'react'
import { formatDateShort, formatRelativeTime } from '@/lib/helpers'

interface RelativeTimeProps {
  dateString: string
  className?: string
}

/**
 * Client component that renders a live-updating relative timestamp.
 * Re-computes every 60 s so "5m ago" ticks to "6m ago" without a page reload.
 *
 * Initial render uses a stable short date (no `Date.now()`) to avoid
 * SSR/client hydration mismatches; the relative string replaces it
 * immediately after mount.
 */
export function RelativeTime({ dateString, className }: RelativeTimeProps) {
  const [text, setText] = useState(() => formatDateShort(dateString))

  useEffect(() => {
    setText(formatRelativeTime(dateString))
    const id = setInterval(() => setText(formatRelativeTime(dateString)), 60_000)
    return () => clearInterval(id)
  }, [dateString])

  return (
    <time dateTime={dateString} className={className}>
      {text}
    </time>
  )
}
