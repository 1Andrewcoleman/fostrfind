'use client'

import { useEffect } from 'react'

/**
 * Path-agnostic sibling of \`PublicThemeLock\`.
 *
 * \`PublicThemeLock\` early-bails on \`/foster/*\` and \`/shelter/*\` so it
 * never fights the portal's \`PortalThemeProvider\`. That carve-out is
 * correct for the authenticated portals, but the public dog teaser
 * lives at \`/foster/dog/[id]\` — a portal-aliased path that is
 * explicitly public. If an anonymous visitor arrives from a tab where
 * they just had the portal mounted in dark mode (or if their OS hints
 * dark mode and some future code path adds the \`dark\` class), the
 * teaser would inherit dark chrome that its art / copy isn't
 * calibrated against.
 *
 * Mount this component inside any specific public surface under
 * \`/foster\` or \`/shelter\` that needs to guarantee light mode. It
 * strips the \`dark\` class on mount and via a MutationObserver, and
 * forces \`color-scheme: light\` so form control chrome matches.
 *
 * Renders nothing — side effect only.
 */
export function ForceLightTheme() {
  useEffect(() => {
    const root = document.documentElement
    const clear = () => {
      if (root.classList.contains('dark')) {
        root.classList.remove('dark')
      }
      root.style.colorScheme = 'light'
    }
    clear()
    const observer = new MutationObserver(clear)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return null
}
