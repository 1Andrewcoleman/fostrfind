'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * PublicThemeLock — force the light palette on public marketing pages.
 *
 * Per `.impeccable.md`: public pages (`/`, `/terms`, `/privacy`, auth,
 * onboarding, shelter public profiles) are *light-only*. Marketing
 * copy, photography, and the three-pastel identity are calibrated
 * against the light palette; they must render the same regardless of
 * whether a visitor's OS prefers dark mode or whether they just came
 * from an authenticated portal that had `next-themes` set
 * `<html class="dark">`.
 *
 * `next-themes` (mounted only inside the `(foster)` and `(shelter)`
 * route groups) does not clear the `dark` class when the portal
 * layout unmounts on navigation, so this component strips it on
 * mount and via a MutationObserver in case a lingering hydration
 * pass or stray effect re-adds it.
 *
 * Mounted from the root layout so every route sees it, but early-
 * bails (and disconnects the observer) on portal routes so it never
 * fights `PortalThemeProvider`. Renders nothing — side-effect only.
 */
export function PublicThemeLock() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname?.startsWith('/foster') || pathname?.startsWith('/shelter')) {
      return
    }
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
  }, [pathname])

  return null
}
