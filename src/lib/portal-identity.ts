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
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('[portal-identity] getUser failed:', authError.message)
      return { displayName: 'Account', avatarUrl: null, roleLabel }
    }
    if (!user) {
      return { displayName: 'Account', avatarUrl: null, roleLabel }
    }

    return getPortalIdentityForUser(portal, supabase, user)
  } catch (e) {
    console.error('[portal-identity] identity fetch failed:', e instanceof Error ? e.message : String(e))
    return { displayName: 'Account', avatarUrl: null, roleLabel }
  }
}
