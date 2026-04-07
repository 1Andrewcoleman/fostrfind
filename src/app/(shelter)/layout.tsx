import { PawPrint } from 'lucide-react'
import { AuthGuard } from '@/components/auth-guard'
import { RoleGuard } from '@/components/role-guard'
import { NavLinks, MobileNav } from '@/components/portal-nav'
import { createClient } from '@/lib/supabase/server'

const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')

/**
 * Fetches the count of unread messages (sent by fosters) for the
 * authenticated shelter. Returns 0 in DEV_MODE or on any error.
 */
async function getUnreadMessageCount(): Promise<number> {
  if (DEV_MODE) return 0

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 0

    const { data: shelterRow } = await supabase
      .from('shelters')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!shelterRow) return 0

    // Collect accepted/completed application IDs belonging to this shelter
    const { data: apps } = await supabase
      .from('applications')
      .select('id')
      .eq('shelter_id', shelterRow.id)
      .in('status', ['accepted', 'completed'])

    const applicationIds = (apps ?? []).map((a) => a.id)
    if (applicationIds.length === 0) return 0

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('application_id', applicationIds)
      .eq('sender_role', 'foster')
      .eq('read', false)

    return count ?? 0
  } catch {
    return 0
  }
}

export default async function ShelterLayout({ children }: { children: React.ReactNode }) {
  const unreadMessages = await getUnreadMessageCount()

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
            <div className="p-3 border-t">
              <p className="text-xs text-muted-foreground px-3">Shelter Portal</p>
            </div>
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
              <MobileNav portal="shelter" portalLabel="Shelter Portal" unreadMessages={unreadMessages} />
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
