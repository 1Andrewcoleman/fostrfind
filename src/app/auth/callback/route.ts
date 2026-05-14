import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPostAuthDestination } from '@/lib/auth-routing'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  // Use the trusted env var as redirect base rather than the request-derived
  // origin, which can be spoofed via Host/X-Forwarded-Host headers on a
  // misconfigured proxy. Fall back to a hardcoded localhost default for local
  // dev — never derive the base from request.url, which reflects the Host header.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const base = appUrl?.startsWith('http')
    ? new URL(appUrl).origin
    : 'http://localhost:3000'

  if (!code) {
    return NextResponse.redirect(`${base}/login`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${base}/login`)
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) {
    console.error('[auth/callback] getUser failed:', authError.message)
    return NextResponse.redirect(`${base}/login?error=auth_service_unavailable`)
  }
  const rawDest = user ? await getPostAuthDestination(supabase, user.id) : '/onboarding'
  // Defensive: ensure dest is always a relative path — guards against
  // any future change to getPostAuthDestination() returning an absolute URL.
  const safeDest =
    typeof rawDest === 'string' && rawDest.startsWith('/') && !rawDest.includes('://')
      ? rawDest
      : '/login'
  return NextResponse.redirect(`${base}${safeDest}`)
}
