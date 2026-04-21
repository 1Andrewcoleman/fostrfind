import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthGuard } from '@/components/auth-guard'
import { RoleGuard } from '@/components/role-guard'
import { FosterPortalShell } from '@/components/foster-portal-shell'
import { getPortalLayoutData } from '@/lib/portal-layout-data'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'

export const metadata: Metadata = {
  title: {
    template: '%s — Fostr Fix',
    default: 'Foster Portal — Fostr Fix',
  },
}

export default async function FosterLayout({ children }: { children: React.ReactNode }) {
  // Gate at the layout level so the redirect fires from a top-level
  // server component and Next can reliably intercept the NEXT_REDIRECT
  // throw. AuthGuard / RoleGuard remain as belt-and-braces inside the
  // tree but the authoritative bounce happens here.
  if (!DEV_MODE) {
    const supabase = await createClient()
    let userId: string | null = null
    try {
      const { data, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.warn('[foster-layout] getUser returned error:', authError.message)
      } else {
        userId = data.user?.id ?? null
      }
    } catch (e) {
      console.warn(
        '[foster-layout] getUser threw:',
        e instanceof Error ? e.message : String(e),
      )
    }
    if (!userId) redirect('/login')
  }

  const { unreadMessages, pendingInvites, identity } = await getPortalLayoutData('foster')

  return (
    <AuthGuard>
      <RoleGuard allowedRole="foster">
        <FosterPortalShell
          unreadMessages={unreadMessages}
          pendingInvites={pendingInvites}
          identity={identity}
        >
          {children}
        </FosterPortalShell>
      </RoleGuard>
    </AuthGuard>
  )
}
