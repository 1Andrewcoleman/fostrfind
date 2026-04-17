import { PawPrint } from 'lucide-react'
import { AuthGuard } from '@/components/auth-guard'
import { RoleGuard } from '@/components/role-guard'
import { NavLinks, MobileNav } from '@/components/portal-nav'
import { PortalSidebarUser } from '@/components/portal-sidebar-user'
import { getPortalLayoutData } from '@/lib/portal-layout-data'
import { DEV_MODE } from '@/lib/constants'

export default async function ShelterLayout({ children }: { children: React.ReactNode }) {
  const { unreadMessages, identity } = await getPortalLayoutData('shelter')

  return (
    <AuthGuard>
      <RoleGuard allowedRole="shelter">
        <div className="flex min-h-screen">
          {/* ── Desktop sidebar ── */}
          <aside className="hidden md:flex w-60 flex-col border-r bg-background">
            <div className="flex items-center gap-2.5 px-6 h-16 border-b font-display font-bold text-lg">
              <PawPrint className="h-6 w-6 text-warm" />
              Fostr Fix
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1">
              <NavLinks portal="shelter" unreadMessages={unreadMessages} />
            </nav>
            <PortalSidebarUser identity={identity} />
          </aside>

          {/* ── Main content ── */}
          <main className="flex-1 flex flex-col min-w-0">
            {DEV_MODE && (
              <div className="bg-yellow-400 text-yellow-900 text-xs font-medium text-center py-1.5 px-4">
                DEV MODE — auth bypassed, no Supabase credentials configured
              </div>
            )}

            {/* Mobile header (hamburger + wordmark) */}
            <header className="flex md:hidden items-center gap-3 px-4 h-14 border-b bg-background sticky top-0 z-50">
              <MobileNav portal="shelter" portalLabel="Shelter Portal" unreadMessages={unreadMessages} identity={identity} />
              <div className="flex items-center gap-2 font-display font-bold text-base">
                <PawPrint className="h-5 w-5 text-warm" />
                Fostr Fix
              </div>
            </header>

            <div className="flex-1 p-6 md:p-8">{children}</div>
          </main>
        </div>
      </RoleGuard>
    </AuthGuard>
  )
}
