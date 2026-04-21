'use client'

import { useEffect, useState } from 'react'
import { LogOut, Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/helpers'
import type { PortalIdentity } from '@/types/portal'

interface PortalSidebarUserProps {
  identity: PortalIdentity
}

export function PortalSidebarUser({ identity }: PortalSidebarUserProps) {
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch {
      toast.error('Sign out failed. Please try again.')
      setSigningOut(false)
    }
  }

  return (
    <div className="p-3 border-t shrink-0">
      <div className="flex items-center gap-2.5 px-1 group-data-[collapsed=true]:flex-col group-data-[collapsed=true]:gap-2 group-data-[collapsed=true]:px-0">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={identity.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(identity.displayName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 group-data-[collapsed=true]:hidden">
          <p className="text-sm font-medium truncate">{identity.displayName}</p>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
            {identity.roleLabel}
          </Badge>
        </div>

        <ThemeToggle />

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/**
 * Portal-only theme toggle. Renders as a static placeholder until mounted
 * to avoid the hydration-mismatch warning that `next-themes` documents for
 * SSR: server doesn't know the user's `resolvedTheme` until client hydrates.
 * Principle 5 ("motion responds to intent") — no cross-fade or rotate on
 * swap; the icon simply swaps.
 */
function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === 'dark'
  const Icon = isDark ? Sun : Moon

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={mounted ? (isDark ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle theme'}
      title={mounted ? (isDark ? 'Light mode' : 'Dark mode') : 'Toggle theme'}
      // Render the moon icon on the server so the button has stable
      // dimensions; swap to resolved after mount.
      suppressHydrationWarning
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}
