import { createClient } from '@/lib/supabase/server'
import type { PortalIdentity } from '@/types/portal'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type AuthUser = { id: string; email?: string }

const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')

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

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const roleLabel = portal === 'shelter' ? 'Shelter' as const : 'Foster' as const
      return {
        unreadMessages: 0,
        identity: { displayName: 'Account', avatarUrl: null, roleLabel },
      }
    }

    const [unreadMessages, identity] = await Promise.all([
      getUnreadCountForRole(supabase, user, portal),
      getPortalIdentityForUser(portal, supabase, user),
    ])

    return { unreadMessages, identity }
  } catch {
    const roleLabel = portal === 'shelter' ? 'Shelter' as const : 'Foster' as const
    return {
      unreadMessages: 0,
      identity: { displayName: 'Account', avatarUrl: null, roleLabel },
    }
  }
}
