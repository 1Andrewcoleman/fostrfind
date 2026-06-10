'use client'

import { useEffect, useState } from 'react'
import { getGreeting } from '@/lib/helpers'

interface DashboardGreetingProps {
  /** Omit when unknown — the greeting renders without a name suffix. */
  name?: string
  className?: string
}

/**
 * Renders a time-of-day greeting in the user's local timezone.
 * SSR initial value is a neutral "Hello" to avoid hydration mismatches;
 * the correct local greeting replaces it immediately after mount.
 */
export function DashboardGreeting({ name, className }: DashboardGreetingProps) {
  const [greeting, setGreeting] = useState('Hello')

  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  return (
    <span className={className}>
      {greeting}
      {name ? `, ${name}` : ''}
    </span>
  )
}
