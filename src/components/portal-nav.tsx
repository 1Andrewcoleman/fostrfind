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
import type { PortalIdentity } from '@/types/portal'

// ---------------------------------------------------------------------------
// Nav item definitions (one source of truth per portal)
// ---------------------------------------------------------------------------

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  /** If true, the unreadMessages badge is shown on this item. */
  showUnreadBadge?: boolean
}

const SHELTER_NAV: NavItem[] = [
  { href: '/shelter/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/shelter/dogs', label: 'Dogs', icon: Dog },
  { href: '/shelter/applications', label: 'Applications', icon: FileText },
  { href: '/shelter/messages', label: 'Messages', icon: MessageCircle, showUnreadBadge: true },
  { href: '/shelter/settings', label: 'Settings', icon: Settings },
]

const FOSTER_NAV: NavItem[] = [
  { href: '/foster/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/foster/browse', label: 'Browse Dogs', icon: Search },
  { href: '/foster/applications', label: 'My Applications', icon: FileText },
  { href: '/foster/messages', label: 'Messages', icon: MessageCircle, showUnreadBadge: true },
  { href: '/foster/profile', label: 'My Profile', icon: User },
  { href: '/foster/history', label: 'History', icon: History },
]

type Portal = 'shelter' | 'foster'

// ---------------------------------------------------------------------------
// Shared link renderer
// ---------------------------------------------------------------------------

interface NavLinkItemProps {
  item: NavItem
  isActive: boolean
  unreadMessages: number
  /** Called when the link is clicked (e.g. to close a mobile sheet). */
  onClick?: () => void
}

function NavLinkItem({ item, isActive, unreadMessages, onClick }: NavLinkItemProps) {
  const { href, label, icon: Icon, showUnreadBadge } = item
  const badgeCount = showUnreadBadge ? unreadMessages : 0

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
        isActive
          ? 'bg-warm/25 text-foreground font-semibold'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {badgeCount > 0 && (
        <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
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
}

export function NavLinks({ portal, unreadMessages = 0 }: NavLinksProps) {
  const pathname = usePathname()
  const items = portal === 'shelter' ? SHELTER_NAV : FOSTER_NAV

  return (
    <>
      {items.map((item) => (
        <NavLinkItem
          key={item.href}
          item={item}
          isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
          unreadMessages={unreadMessages}
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
  identity?: PortalIdentity
}

export function MobileNav({ portal, portalLabel, unreadMessages = 0, identity }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const items = portal === 'shelter' ? SHELTER_NAV : FOSTER_NAV

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
              unreadMessages={unreadMessages}
              onClick={() => setOpen(false)}
            />
          ))}
        </nav>

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
