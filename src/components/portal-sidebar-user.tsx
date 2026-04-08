'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
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
      <div className="flex items-center gap-2.5 px-1">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={identity.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(identity.displayName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{identity.displayName}</p>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
            {identity.roleLabel}
          </Badge>
        </div>

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
