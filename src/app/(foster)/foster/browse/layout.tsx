import type { Metadata } from 'next'

/**
 * Sibling layout for the browse page, which must stay `'use client'`
 * because its filter state + URL sync needs hooks. A client page can't
 * export `metadata`, so we attach the static title at this layer and
 * pass children through untouched.
 */
export const metadata: Metadata = { title: 'Browse Dogs' }

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
