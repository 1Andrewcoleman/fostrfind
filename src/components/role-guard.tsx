import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRole: 'shelter' | 'foster'
}

const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')

export async function RoleGuard({ children, allowedRole }: RoleGuardProps) {
  if (DEV_MODE) return <>{children}</>

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: shelter }, { data: foster }] = await Promise.all([
    supabase.from('shelters').select('id').eq('user_id', user.id).single(),
    supabase.from('foster_parents').select('id').eq('user_id', user.id).single(),
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
