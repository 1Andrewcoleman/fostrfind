import type { Metadata } from 'next'
import { AuthGuard } from '@/components/auth-guard'
import { RoleGuard } from '@/components/role-guard'
import { FosterPortalShell } from '@/components/foster-portal-shell'
import { getPortalLayoutData } from '@/lib/portal-layout-data'

export const metadata: Metadata = {
  title: {
    template: '%s — Fostr Fix',
    default: 'Foster Portal — Fostr Fix',
  },
}

export default async function FosterLayout({ children }: { children: React.ReactNode }) {
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
