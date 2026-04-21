import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRole: 'shelter' | 'foster'
}

/**
 * Role-scoped gate sitting inside AuthGuard. Same unauth handling
 * contract as AuthGuard — any failure to resolve a user bounces to
 * /login rather than surfacing a runtime error. See auth-guard.tsx
 * for the rationale.
 */
export async function RoleGuard({ children, allowedRole }: RoleGuardProps) {
  if (DEV_MODE) return <>{children}</>

  const supabase = await createClient()

  // Same pattern as auth-guard: resolve user or null inside a try/catch
  // that cannot swallow a redirect(); issue the redirect afterwards.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  try {
    const { data, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.warn('[role-guard] getUser returned error:', authError.message)
    } else {
      user = data.user
    }
  } catch (e) {
    console.warn(
      '[role-guard] getUser threw:',
      e instanceof Error ? e.message : String(e),
    )
  }

  if (!user) {
    redirect('/login')
  }
  const userId = user.id

  const [{ data: shelter }, { data: foster }] = await Promise.all([
    supabase.from('shelters').select('id').eq('user_id', userId).single(),
    supabase.from('foster_parents').select('id').eq('user_id', userId).single(),
  ])

  const isShelter = !!shelter
  const isFoster = !!foster

  // Neither role set up yet
  if (!isShelter && !isFoster) {
    redirect('/onboarding')
  }

  // Wrong role — redirect to correct dashboard
  if (allowedRole === 'shelter' && !isShelter) {
    redirect('/foster/browse')
  }
  if (allowedRole === 'foster' && !isFoster) {
    redirect('/shelter/dashboard')
  }

  return <>{children}</>
}
