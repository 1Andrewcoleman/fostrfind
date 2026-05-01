import { PawPrint } from 'lucide-react'
import { NavLinks, MobileNav } from '@/components/portal-nav'
import { PortalSidebar } from '@/components/portal-sidebar'
import { PortalSidebarUser } from '@/components/portal-sidebar-user'
import { PortalThemeProvider } from '@/components/portal-theme-provider'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { DEV_MODE } from '@/lib/constants'
import type { PortalIdentity } from '@/types/portal'

interface FosterPortalShellProps {
  unreadMessages: number
  unreadNotifications?: number
  /**
   * Count of pending shelter->foster invites awaiting this foster's
   * response. Drives the badge on the /foster/invites nav item. Default
   * 0 keeps the prop optional for callers (e.g. the public dog teaser)
   * that don't have a logged-in foster context.
   */
  pendingInvites?: number
  identity: PortalIdentity
  children: React.ReactNode
}

/**
 * FosterPortalShell — the visual chrome for the foster portal (sidebar,
 * mobile header, DEV_MODE banner, theme provider, main container).
 *
 * Extracted from `(foster)/layout.tsx` so it can be reused by
 * `/foster/dog/[id]` — a route that must live *outside* the `(foster)`
 * route group (to accept anonymous viewers for the public teaser) while
 * still rendering identical chrome when the viewer is an authenticated
 * foster.
 *
 * The shell takes preloaded `unreadMessages` + `identity` instead of
 * calling `getPortalLayoutData` itself. This keeps the auth / getUser
 * round trip colocated with the guard that already ran, and lets the
 * dog-detail server page compose shell + data fetch in whatever order
 * the branching logic requires.
 */
export function FosterPortalShell({
  unreadMessages,
  unreadNotifications = 0,
  pendingInvites = 0,
  identity,
  children,
}: FosterPortalShellProps) {
  return (
    <PortalThemeProvider>
      <div className="flex min-h-screen">
        {/* ── Desktop sidebar (collapsible) ── */}
        <PortalSidebar>
          <div className="flex items-center gap-2.5 px-6 h-16 border-b font-display font-bold text-lg group-data-[collapsed=true]:justify-center group-data-[collapsed=true]:px-2">
            <PawPrint className="h-6 w-6 text-primary flex-shrink-0" />
            <span className="group-data-[collapsed=true]:hidden">Fostr Fix</span>
          </div>
          <nav className="flex-1 py-4 px-3 space-y-1">
            <NavLinks
              portal="foster"
              unreadMessages={unreadMessages}
              unreadNotifications={unreadNotifications}
              pendingInvites={pendingInvites}
            />
          </nav>
          <div className="border-t px-3 py-2 group-data-[collapsed=true]:px-2">
            <NotificationBell
              portal="foster"
              initialCount={unreadNotifications}
              className="group-data-[collapsed=true]:mx-auto"
            />
          </div>
          <PortalSidebarUser identity={identity} />
        </PortalSidebar>

        {/* ── Main content ── */}
        <main className="flex-1 flex flex-col min-w-0">
          {DEV_MODE && (
            <div
              className="bg-peach/40 text-foreground text-xs font-medium text-center py-1.5 px-4"
              data-print-hide
            >
              DEV MODE — auth bypassed, no Supabase credentials configured
            </div>
          )}

          {/* Mobile header (hamburger + wordmark) */}
          <header
            className="flex md:hidden items-center gap-3 px-4 h-14 border-b bg-background sticky top-0 z-50"
            data-print-hide
          >
            <MobileNav
              portal="foster"
              portalLabel="Foster Portal"
              unreadMessages={unreadMessages}
              unreadNotifications={unreadNotifications}
              pendingInvites={pendingInvites}
              identity={identity}
            />
            <div className="flex items-center gap-2 font-display font-bold text-base">
              <PawPrint className="h-5 w-5 text-primary" />
              Fostr Fix
            </div>
          </header>

          <div className="flex-1 p-6 md:p-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </div>
        </main>
      </div>
    </PortalThemeProvider>
  )
}
