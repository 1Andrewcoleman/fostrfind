import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPostAuthDestination } from '@/lib/auth-routing'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login`)
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
    return NextResponse.redirect(`${origin}/login`)
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) {
    console.error('[auth/callback] getUser failed:', authError.message)
    return NextResponse.redirect(`${origin}/login?error=auth_service_unavailable`)
  }
  const dest = user ? await getPostAuthDestination(supabase, user.id) : '/onboarding'
  return NextResponse.redirect(`${origin}${dest}`)
}
