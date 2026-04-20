import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { DEV_MODE } from '@/lib/constants'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Skip Supabase session refresh if credentials are not yet configured
  if (DEV_MODE) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not remove this line. A failure here (auth
  // service unavailable, transient DNS, etc.) must not crash every
  // request, so we log and continue. Downstream RLS / guards will
  // reject the request if the session truly isn't valid.
  const { error: authError } = await supabase.auth.getUser()
  if (authError) {
    console.error('[middleware] getUser failed:', authError.message)
  }

  return supabaseResponse
}
