import Link from 'next/link'
import { PawPrint, LayoutDashboard, Dog, FileText, MessageCircle, Settings } from 'lucide-react'
import { AuthGuard } from '@/components/auth-guard'
import { RoleGuard } from '@/components/role-guard'

const navItems = [
  { href: '/shelter/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/shelter/dogs', label: 'Dogs', icon: Dog },
  { href: '/shelter/applications', label: 'Applications', icon: FileText },
  { href: '/shelter/messages', label: 'Messages', icon: MessageCircle },
  { href: '/shelter/settings', label: 'Settings', icon: Settings },
]

export default function ShelterLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <RoleGuard allowedRole="shelter">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden md:flex w-60 flex-col border-r bg-background">
            <div className="flex items-center gap-2 px-6 h-16 border-b font-bold text-lg">
              <PawPrint className="h-5 w-5 text-primary" />
              Fostr Fix
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="p-3 border-t">
              <p className="text-xs text-muted-foreground px-3">Shelter Portal</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 flex flex-col min-w-0">
            {!process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http') && (
              <div className="bg-yellow-400 text-yellow-900 text-xs font-medium text-center py-1.5 px-4">
                DEV MODE — auth bypassed, no Supabase credentials configured
              </div>
            )}
            <div className="flex-1 p-6 md:p-8">
              {children}
            </div>
          </main>
        </div>
      </RoleGuard>
    </AuthGuard>
  )
}
