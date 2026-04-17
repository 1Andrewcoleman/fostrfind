import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'

interface AuthGuardProps {
  children: React.ReactNode
}

export async function AuthGuard({ children }: AuthGuardProps) {
  if (DEV_MODE) return <>{children}</>

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <>{children}</>
}
