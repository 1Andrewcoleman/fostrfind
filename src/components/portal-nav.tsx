'use client'

/**
 * Portal navigation components shared by the shelter and foster layouts.
 *
 * Both NavLinks (desktop sidebar) and MobileNav (sheet overlay) are housed
 * here so the nav item definitions are defined once and stay in sync.
 */

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Dog,
  FileText,
  MessageCircle,
  Settings,
  Search,
  User,
  History,
  Menu,
  PawPrint,
  Mail,
  Users,
  Heart,
  Bell,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { PortalSidebarUser } from '@/components/portal-sidebar-user'
import { NotificationBell } from '@/components/notifications/notification-bell'
import type { PortalIdentity } from '@/types/portal'

// ---------------------------------------------------------------------------
// Nav item definitions (one source of truth per portal)
// ---------------------------------------------------------------------------

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  /**
   * Which counter (if any) drives the badge on this item. Kept as a
   * discriminated key rather than a direct count so the component
   * receives a single `counts` map and doesn't have to know about every
   * surface that might grow a badge.
   */
  badgeKey?: 'unreadMessages' | 'pendingInvites'
}

const SHELTER_NAV: NavItem[] = [
  { href: '/shelter/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/shelter/dogs', label: 'Dogs', icon: Dog },
  { href: '/shelter/applications', label: 'Applications', icon: FileText },
  { href: '/shelter/fosters', label: 'Fosters', icon: Users },
  { href: '/shelter/messages', label: 'Messages', icon: MessageCircle, badgeKey: 'unreadMessages' },
  { href: '/shelter/notifications', label: 'Notifications', icon: Bell },
  { href: '/shelter/settings', label: 'Settings', icon: Settings },
]

const FOSTER_NAV: NavItem[] = [
  { href: '/foster/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/foster/browse', label: 'Browse Dogs', icon: Search },
  { href: '/foster/saved', label: 'Saved', icon: Heart },
  { href: '/foster/applications', label: 'My Applications', icon: FileText },
  { href: '/foster/invites', label: 'Invites', icon: Mail, badgeKey: 'pendingInvites' },
  { href: '/foster/messages', label: 'Messages', icon: MessageCircle, badgeKey: 'unreadMessages' },
  { href: '/foster/notifications', label: 'Notifications', icon: Bell },
  { href: '/foster/profile', label: 'My Profile', icon: User },
  { href: '/foster/history', label: 'History', icon: History },
]

interface NavCounts {
  unreadMessages: number
  pendingInvites: number
  unreadNotifications: number
}

type Portal = 'shelter' | 'foster'

// ---------------------------------------------------------------------------
// Shared link renderer
// ---------------------------------------------------------------------------

interface NavLinkItemProps {
  item: NavItem
  isActive: boolean
  counts: NavCounts
  /** Called when the link is clicked (e.g. to close a mobile sheet). */
  onClick?: () => void
}

function NavLinkItem({ item, isActive, counts, onClick }: NavLinkItemProps) {
  const { href, label, icon: Icon, badgeKey } = item
  const badgeCount = badgeKey ? counts[badgeKey] : 0

  return (
    <Link
      href={href}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
        'group-data-[collapsed=true]:justify-center group-data-[collapsed=true]:px-2',
        isActive
          ? 'bg-warm/25 text-foreground font-semibold'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1 group-data-[collapsed=true]:hidden">{label}</span>
      {badgeCount > 0 && (
        <>
          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground group-data-[collapsed=true]:hidden">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 hidden h-2 w-2 rounded-full bg-primary group-data-[collapsed=true]:block"
          />
        </>
      )}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// NavLinks — desktop sidebar navigation
// ---------------------------------------------------------------------------

interface NavLinksProps {
  portal: Portal
  unreadMessages?: number
  pendingInvites?: number
  unreadNotifications?: number
}

export function NavLinks({
  portal,
  unreadMessages = 0,
  pendingInvites = 0,
  unreadNotifications = 0,
}: NavLinksProps) {
  const pathname = usePathname()
  const items = portal === 'shelter' ? SHELTER_NAV : FOSTER_NAV
  const counts: NavCounts = { unreadMessages, pendingInvites, unreadNotifications }

  return (
    <>
      {items.map((item) => (
        <NavLinkItem
          key={item.href}
          item={item}
          isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
          counts={counts}
        />
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// MobileNav — hamburger button + Sheet overlay for small screens
// ---------------------------------------------------------------------------

interface MobileNavProps {
  portal: Portal
  portalLabel: string
  unreadMessages?: number
  pendingInvites?: number
  unreadNotifications?: number
  identity?: PortalIdentity
}

export function MobileNav({
  portal,
  portalLabel,
  unreadMessages = 0,
  pendingInvites = 0,
  unreadNotifications = 0,
  identity,
}: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const items = portal === 'shelter' ? SHELTER_NAV : FOSTER_NAV
  const counts: NavCounts = { unreadMessages, pendingInvites, unreadNotifications }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-60 p-0 flex flex-col">
        <SheetHeader className="flex flex-row items-center gap-2.5 px-6 h-16 border-b shrink-0">
          <PawPrint className="h-6 w-6 text-primary" />
          <SheetTitle className="font-display font-bold text-lg">Fostr Fix</SheetTitle>
        </SheetHeader>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLinkItem
              key={item.href}
              item={item}
              isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              counts={counts}
              onClick={() => setOpen(false)}
            />
          ))}
        </nav>

        <div className="border-t px-3 py-2 shrink-0">
          <NotificationBell
            portal={portal}
            initialCount={unreadNotifications}
          />
        </div>

        {identity ? (
          <PortalSidebarUser identity={identity} />
        ) : (
          <div className="p-3 border-t shrink-0">
            <p className="text-xs text-muted-foreground px-3">{portalLabel}</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
