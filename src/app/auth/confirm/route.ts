import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { EmailOtpType } from '@supabase/supabase-js'
import { getPostAuthDestination } from '@/lib/auth-routing'

/**
 * Email confirmation handler using the token_hash + verifyOtp flow.
 *
 * This route is used by Supabase auth emails (signup confirmation,
 * password recovery, email change). The Supabase email template should
 * point at this route with the token hash and type:
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
 *
 * We deliberately do NOT use the PKCE /verify → /auth/callback flow for
 * email links because Supabase's PKCE flow_state expires in ~5 minutes,
 * which is shorter than most users take to open their inbox. The
 * token_hash flow uses the email confirmation token directly and has a
 * much longer TTL.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  // Use the trusted env var as redirect base rather than the request-derived
  // origin, which can be spoofed via Host/X-Forwarded-Host headers.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const base = appUrl?.startsWith('http')
    ? new URL(appUrl).origin
    : 'http://localhost:3000'

  if (!token_hash || !type) {
    return NextResponse.redirect(`${base}/login?error=invalid_confirmation_link`)
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
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )

  const { error } = await supabase.auth.verifyOtp({ type, token_hash })
  if (error) {
    console.error('[auth/confirm] verifyOtp failed:', error.message)
    return NextResponse.redirect(`${base}/login?error=verification_failed`)
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) {
    console.error('[auth/confirm] getUser failed:', authError.message)
    return NextResponse.redirect(`${base}/login?error=auth_service_unavailable`)
  }

  const rawDest = user ? await getPostAuthDestination(supabase, user.id) : '/login'
  const safeDest =
    typeof rawDest === 'string' && rawDest.startsWith('/') && !rawDest.includes('://')
      ? rawDest
      : '/login'
  return NextResponse.redirect(`${base}${safeDest}`)
}
