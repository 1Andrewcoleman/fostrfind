'use client'

import { usePathname } from 'next/navigation'
import { ForceLightTheme } from '@/components/force-light-theme'

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
 * layout unmounts on navigation, so this mounts `ForceLightTheme`
 * (strip `dark` class + MutationObserver) on every route except the
 * portals, where it must not fight `PortalThemeProvider`.
 *
 * Mounted from the root layout. Renders nothing visible — side-effect only.
 */
export function PublicThemeLock() {
  const pathname = usePathname()

  if (pathname?.startsWith('/foster') || pathname?.startsWith('/shelter')) {
    return null
  }
  return <ForceLightTheme />
}
