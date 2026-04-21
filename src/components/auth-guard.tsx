import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'

interface AuthGuardProps {
  children: React.ReactNode
}

/**
 * Gate for every protected portal route. If the caller is not
 * authenticated — for ANY reason, including Supabase rejecting with
 * `AuthSessionMissingError` when cookies have been cleared or gone
 * stale — the right UX is always "bounce them to /login", not an
 * unhandled runtime error boundary.
 *
 * The SDK can surface an unauthenticated state in three different
 * ways, all of which end up here:
 *
 *   1. `data.user === null` with no error — classic logged-out case.
 *   2. `error` present on the return value — Supabase service hiccup.
 *   3. The promise *rejects* with `AuthSessionMissingError` — common
 *      right after sign-out or when cookies expire between requests.
 *
 * Previously (1) redirected, (2) re-threw to error.tsx, and (3)
 * bypassed the destructure entirely and bubbled up to the user as a
 * red overlay. All three now redirect.
 */
export async function AuthGuard({ children }: AuthGuardProps) {
  if (DEV_MODE) return <>{children}</>

  const supabase = await createClient()

  // Resolve to either `user` or null. Swallow Supabase SDK errors here so
  // we can issue the redirect *outside* the try/catch — that way there's
  // no chance of a control-flow error getting caught by our own catch,
  // and Next's redirect() throw propagates cleanly.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  try {
    const { data, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.warn('[auth-guard] getUser returned error:', authError.message)
    } else {
      user = data.user
    }
  } catch (e) {
    console.warn(
      '[auth-guard] getUser threw:',
      e instanceof Error ? e.message : String(e),
    )
  }

  if (!user) {
    redirect('/login')
  }

  return <>{children}</>
}
