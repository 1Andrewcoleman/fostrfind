import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import type { PortalIdentity } from '@/types/portal'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type AuthUser = { id: string; email?: string }

const DEV_IDENTITY: Record<'shelter' | 'foster', PortalIdentity> = {
  shelter: { displayName: 'Happy Paws Rescue', avatarUrl: null, roleLabel: 'Shelter' },
  foster:  { displayName: 'Jane Foster',       avatarUrl: null, roleLabel: 'Foster' },
}

// ---------------------------------------------------------------------------
// Portal identity (takes an already-authenticated user)
// ---------------------------------------------------------------------------

export async function getPortalIdentityForUser(
  portal: 'shelter' | 'foster',
  supabase: SupabaseServerClient,
  user: AuthUser,
): Promise<PortalIdentity> {
  const roleLabel = portal === 'shelter' ? 'Shelter' as const : 'Foster' as const

  if (portal === 'shelter') {
    const { data: shelter } = await supabase
      .from('shelters')
      .select('name, logo_url')
      .eq('user_id', user.id)
      .single()

    return {
      displayName: shelter?.name || user.email || 'Account',
      avatarUrl: shelter?.logo_url ?? null,
      roleLabel,
    }
  }

  const { data: foster } = await supabase
    .from('foster_parents')
    .select('first_name, last_name, avatar_url')
    .eq('user_id', user.id)
    .single()

  const fullName = [foster?.first_name, foster?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()

  return {
    displayName: fullName || user.email || 'Account',
    avatarUrl: foster?.avatar_url ?? null,
    roleLabel,
  }
}

// ---------------------------------------------------------------------------
// Unread message counts (takes an already-authenticated user)
// ---------------------------------------------------------------------------

async function getUnreadCountForRole(
  supabase: SupabaseServerClient,
  user: AuthUser,
  portal: 'shelter' | 'foster',
): Promise<number> {
  const profileTable = portal === 'foster' ? 'foster_parents' : 'shelters'
  const idColumn     = portal === 'foster' ? 'foster_id'      : 'shelter_id'
  const senderRole   = portal === 'foster' ? 'shelter'        : 'foster'

  const { data: profileRow } = await supabase
    .from(profileTable)
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!profileRow) return 0

  const { data: apps } = await supabase
    .from('applications')
    .select('id')
    .eq(idColumn, profileRow.id)
    .in('status', ['accepted', 'completed'])

  const applicationIds = (apps ?? []).map((a: { id: string }) => a.id)
  if (applicationIds.length === 0) return 0

  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .in('application_id', applicationIds)
    .eq('sender_role', senderRole)
    .eq('read', false)

  return count ?? 0
}

// ---------------------------------------------------------------------------
// Combined fetch — single getUser() per layout render
// ---------------------------------------------------------------------------

export interface PortalLayoutData {
  unreadMessages: number
  identity: PortalIdentity
}

export async function getPortalLayoutData(
  portal: 'shelter' | 'foster',
): Promise<PortalLayoutData> {
  if (DEV_MODE) {
    return { unreadMessages: 0, identity: DEV_IDENTITY[portal] }
  }

  // A layout render can't fail the whole page for a transient auth or
  // query hiccup — the layout wraps every (shelter)/(foster) route, so
  // any uncaught throw here would replace the portal with error.tsx. We
  // fall back to an unauthenticated-looking identity on error and let
  // RoleGuard / individual pages re-check and redirect.
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('[portal-layout-data] getUser failed:', authError.message)
      return fallbackLayoutData(portal)
    }
    if (!user) {
      return fallbackLayoutData(portal)
    }

    const [unreadMessages, identity] = await Promise.all([
      getUnreadCountForRole(supabase, user, portal),
      getPortalIdentityForUser(portal, supabase, user),
    ])

    return { unreadMessages, identity }
  } catch (e) {
    // Re-throw Next control-flow errors (redirect / notFound / dynamic
    // server usage during build-time static analysis) so Next can do its
    // thing instead of us swallowing them into a generic fallback.
    if (isNextControlFlowError(e)) throw e
    console.error('[portal-layout-data] layout fetch failed:', e instanceof Error ? e.message : String(e))
    return fallbackLayoutData(portal)
  }
}

function fallbackLayoutData(portal: 'shelter' | 'foster'): PortalLayoutData {
  const roleLabel = portal === 'shelter' ? 'Shelter' as const : 'Foster' as const
  return {
    unreadMessages: 0,
    identity: { displayName: 'Account', avatarUrl: null, roleLabel },
  }
}
