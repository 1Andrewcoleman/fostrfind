import type { Metadata } from 'next'
import { PawPrint } from 'lucide-react'
import { AuthGuard } from '@/components/auth-guard'
import { RoleGuard } from '@/components/role-guard'
import { NavLinks, MobileNav } from '@/components/portal-nav'
import { PortalSidebar } from '@/components/portal-sidebar'
import { PortalSidebarUser } from '@/components/portal-sidebar-user'
import { PortalThemeProvider } from '@/components/portal-theme-provider'
import { getPortalLayoutData } from '@/lib/portal-layout-data'
import { DEV_MODE } from '@/lib/constants'

export const metadata: Metadata = {
  title: {
    template: '%s — Fostr Fix',
    default: 'Foster Portal — Fostr Fix',
  },
}

export default async function FosterLayout({ children }: { children: React.ReactNode }) {
  const { unreadMessages, identity } = await getPortalLayoutData('foster')

  return (
    <AuthGuard>
      <RoleGuard allowedRole="foster">
        <PortalThemeProvider>
        <div className="flex min-h-screen">
          {/* ── Desktop sidebar (collapsible) ── */}
          <PortalSidebar>
            <div className="flex items-center gap-2.5 px-6 h-16 border-b font-display font-bold text-lg group-data-[collapsed=true]:justify-center group-data-[collapsed=true]:px-2">
              <PawPrint className="h-6 w-6 text-primary flex-shrink-0" />
              <span className="group-data-[collapsed=true]:hidden">Fostr Fix</span>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1">
              <NavLinks portal="foster" unreadMessages={unreadMessages} />
            </nav>
            <PortalSidebarUser identity={identity} />
          </PortalSidebar>

          {/* ── Main content ── */}
          <main className="flex-1 flex flex-col min-w-0">
            {DEV_MODE && (
              <div className="bg-peach/40 text-foreground text-xs font-medium text-center py-1.5 px-4" data-print-hide>
                DEV MODE — auth bypassed, no Supabase credentials configured
              </div>
            )}

            {/* Mobile header (hamburger + wordmark) */}
            <header className="flex md:hidden items-center gap-3 px-4 h-14 border-b bg-background sticky top-0 z-50" data-print-hide>
              <MobileNav portal="foster" portalLabel="Foster Portal" unreadMessages={unreadMessages} identity={identity} />
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
      </RoleGuard>
    </AuthGuard>
  )
}
