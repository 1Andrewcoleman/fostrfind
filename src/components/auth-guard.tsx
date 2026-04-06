import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface AuthGuardProps {
  children: React.ReactNode
}

const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')

export async function AuthGuard({ children }: AuthGuardProps) {
  if (DEV_MODE) return <>{children}</>

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <>{children}</>
}
