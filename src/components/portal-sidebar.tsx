'use client'

import { useEffect, useState } from 'react'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'portal-sidebar-collapsed'

interface PortalSidebarProps {
  children: React.ReactNode
}

/**
 * Desktop-only collapsible sidebar wrapper for authenticated portals.
 *
 * Collapse state is persisted per-browser via `localStorage`. The aside
 * exposes a `data-collapsed` attribute and a `group` class so nested
 * children (NavLinks, PortalSidebarUser, the brand header) can use
 * `group-data-[collapsed=true]:<class>` Tailwind variants to hide labels
 * or adjust padding without having to thread the collapsed boolean down
 * through the component tree.
 *
 * The width animates with `transition-[width]`, which is opted-out
 * automatically for users with `prefers-reduced-motion: reduce` because
 * `motion-reduce:transition-none` is applied.
 */
export function PortalSidebar({ children }: PortalSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === 'true')
    } catch {
      // localStorage unavailable; fall through with collapsed=false
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, String(collapsed))
    } catch {
      // ignore quota / disabled-storage errors
    }
  }, [collapsed, hydrated])

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'group hidden md:flex flex-col border-r bg-background',
        'transition-[width] duration-200 motion-reduce:transition-none',
        collapsed ? 'w-16' : 'w-60',
      )}
      data-print-hide
    >
      {children}

      <div className="p-2 border-t shrink-0">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            'flex h-8 w-full items-center justify-center gap-2 rounded-md text-muted-foreground',
            'hover:bg-accent hover:text-foreground focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
