'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ComponentProps } from 'react'

/**
 * Authenticated-portal theme provider.
 *
 * Per `.impeccable.md` → "Dark (authenticated portals only, phase 2)" —
 * dark mode is intentionally scoped to the shelter and foster portals.
 * The public landing stays light-only so marketing copy, photography,
 * and the three-pastel identity render consistently for first-time
 * visitors regardless of their OS preference.
 *
 * This component is a thin wrapper around `next-themes` so the portal
 * layouts can opt in with a single import, and so the configuration
 * (attribute=`class`, system default, no flash) lives in one place.
 */
export function PortalThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
