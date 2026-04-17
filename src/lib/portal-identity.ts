import { createClient } from '@/lib/supabase/server'
import { getPortalIdentityForUser } from '@/lib/portal-layout-data'
import { DEV_MODE } from '@/lib/constants'
import type { PortalIdentity } from '@/types/portal'

/**
 * Standalone convenience wrapper — creates its own Supabase client and
 * fetches the current user. Prefer `getPortalLayoutData()` in layouts
 * where unread counts are also needed to avoid a redundant `getUser()`.
 */
export async function getPortalIdentity(
  portal: 'shelter' | 'foster',
): Promise<PortalIdentity> {
  const roleLabel = portal === 'shelter' ? 'Shelter' as const : 'Foster' as const

  if (DEV_MODE) {
    return {
      displayName: portal === 'shelter' ? 'Happy Paws Rescue' : 'Jane Foster',
      avatarUrl: null,
      roleLabel,
    }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { displayName: 'Account', avatarUrl: null, roleLabel }
    }

    return getPortalIdentityForUser(portal, supabase, user)
  } catch {
    return { displayName: 'Account', avatarUrl: null, roleLabel }
  }
}
